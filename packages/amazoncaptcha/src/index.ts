/**
 * 亚马逊验证码识别（Node.js + TypeScript 版）
 *
 * 算法与 a-maliarov/amazoncaptcha（Python 版）保持一致：
 *   1. 阈值二值化：灰度 <= MONOWEIGHT 记为黑(0)，否则记为白(255)
 *   2. 按列扫描切字母：找出连续含黑色像素的列区块；
 *      区块过宽（粘连字母）时在中间黑像素最少的一列处切开；
 *      切出 7 块时说明首尾字母被图像边界拆开，需要合并
 *   3. 裁边：去掉每个字母上下多余的白色区域
 *   4. 生成像素指纹：按行优先顺序遍历像素，黑=1 白=0，拼成 01 字符串
 *   5. 查表：在 fingerprints.json（由 convert_training_data.py 转换生成）
 *      中查找精确匹配的指纹，命中即为对应字母
 *
 * 训练数据格式：
 *   src/training_data/fingerprints.json
 *   { "<01像素指纹字符串>": "<字母>", ... }
 *
 * 注意：（`import { Jimp } from 'jimp'`，
 * `image.width` / `image.height` 为只读属性，`getPixelColor` 返回
 * 0xRRGGBBAA 格式的 32 位整数）。
 */

import { Jimp } from "jimp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONOWEIGHT = 1;
const MAXIMUM_LETTER_LENGTH = 33;
const MINIMUM_LETTER_LENGTH = 14;

// ---------------------------------------------------------------------------
// 训练数据加载（惰性加载 + 缓存，避免每次 solve 都读一次磁盘）

type FingerprintMap = Record<string, string>;

let cachedFingerprints: FingerprintMap | null = null;

function loadFingerprints(): FingerprintMap {
  if (!cachedFingerprints) {
    const path = join(__dirname, "../training_data", "fingerprints.json");
    const raw = readFileSync(path, "utf-8");
    cachedFingerprints = JSON.parse(raw) as FingerprintMap;
  }
  return cachedFingerprints;
}

// ---------------------------------------------------------------------------
// 像素矩阵表示：matrix[x][y] = 0(黑) | 255(白)
// 用数组下标直接表示坐标，方便后续按列切割 / 横向合并（数组拼接即可）

type PixelMatrix = number[][];

async function toMonochromeMatrix(
  source: string | Buffer,
): Promise<PixelMatrix> {
  const image = await Jimp.read(source as any);
  const width = image.width;
  const height = image.height;

  const matrix: PixelMatrix = [];

  for (let x = 0; x < width; x++) {
    const column: number[] = new Array(height);

    for (let y = 0; y < height; y++) {
      const color = image.getPixelColor(x, y); // 0xRRGGBBAA
      const r = (color >>> 24) & 0xff;
      const g = (color >>> 16) & 0xff;
      const b = (color >>> 8) & 0xff;
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      column[y] = gray <= MONOWEIGHT ? 0 : 255;
    }

    matrix.push(column);
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// 切字母：对应 Python utils.py 的 find_letter_boxes

function findLetterBoxes(
  matrix: PixelMatrix,
  maxLength: number,
): PixelMatrix[] {
  const width = matrix.length;

  const hasBlackPixel = (column: number[]) => column.some((v) => v === 0);

  const xPoints: number[] = [];
  for (let x = 0; x < width; x++) {
    if (hasBlackPixel(matrix[x])) xPoints.push(x);
  }

  const xPointsSet = new Set(xPoints);
  let xCoords = xPoints.filter(
    (x) => !xPointsSet.has(x - 1) || !xPointsSet.has(x + 1),
  );

  // 奇数个边界点说明有字母贴着图像边缘，复制第一个点凑成偶数对
  if (xCoords.length % 2 !== 0) {
    xCoords = [xCoords[0], xCoords[0], ...xCoords.slice(1)];
  }

  const boxes: PixelMatrix[] = [];

  for (let i = 0; i < xCoords.length; i += 2) {
    const start = xCoords[i];
    const end = Math.min(xCoords[i + 1] + 1, width - 1);

    if (end - start <= maxLength) {
      boxes.push(matrix.slice(start, end));
      continue;
    }

    // 区块过宽：两个字母粘连在一起，在中间区域找黑色像素最少的
    // 一列作为分割点（即两个字母之间连接最细的地方）
    const segment = matrix.slice(start + 5, end - 5);
    let minBlackCount = Infinity;
    let divider = 0;

    segment.forEach((column, idx) => {
      const blackCount = column.filter((v) => v === 0).length;
      if (blackCount < minBlackCount) {
        minBlackCount = blackCount;
        divider = idx;
      }
    });

    divider += 5;
    boxes.push(matrix.slice(start, start + divider));
    boxes.push(matrix.slice(start + divider + 1, end));
  }

  return boxes;
}

// ---------------------------------------------------------------------------
// 裁边：对应 Python utils.py 的 cut_the_white
// 找到黑色像素的最小外接矩形（这里只需要裁 y 方向，x 方向在切字母时已经裁好）

function cutTheWhite(letter: PixelMatrix): PixelMatrix {
  const height = letter[0]?.length ?? 0;
  let minY = height;
  let maxY = -1;

  for (const column of letter) {
    for (let y = 0; y < height; y++) {
      if (column[y] === 0) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxY === -1) return letter; // 理论上不该出现全白字母，兜底保留原样

  return letter.map((column) => column.slice(minY, maxY + 1));
}

// ---------------------------------------------------------------------------
// 合并两个字母（7 块情况）：对应 Python utils.py 的 merge_horizontally
// 因为矩阵是按列存储的数组，横向合并就是数组拼接

function mergeHorizontally(a: PixelMatrix, b: PixelMatrix): PixelMatrix {
  return [...a, ...b];
}

// ---------------------------------------------------------------------------
// 生成像素指纹：必须严格按“先行后列”的顺序（y 在外层，x 在内层）
// 拼接，这跟 Python 里 PIL Image.getdata() 的遍历顺序完全一致——
// 只有顺序对齐了，生成的指纹才能跟 fingerprints.json 里的记录匹配上

function toFingerprint(letter: PixelMatrix): string {
  const width = letter.length;
  const height = letter[0]?.length ?? 0;
  let bits = "";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      bits += letter[x][y] === 0 ? "1" : "0";
    }
  }

  return bits;
}

// ---------------------------------------------------------------------------
// 主流程

export async function solve(source: string | Buffer): Promise<string> {
  const matrix = await toMonochromeMatrix(source);
  let letters = findLetterBoxes(matrix, MAXIMUM_LETTER_LENGTH);

  const looksBroken =
    (letters.length === 6 && letters[0].length < MINIMUM_LETTER_LENGTH) ||
    (letters.length !== 6 && letters.length !== 7);

  if (looksBroken) {
    return "Not solved";
  }

  if (letters.length === 7) {
    // 图像循环裁切导致首尾字母被拆开，合并回一个完整字母
    letters[6] = mergeHorizontally(letters[6], letters[0]);
    letters = letters.slice(1);
  }

  const trimmedLetters = letters.map(cutTheWhite);
  const fingerprints = loadFingerprints();

  const result: string[] = [];

  for (const letter of trimmedLetters) {
    const fingerprint = toFingerprint(letter);
    const match = fingerprints[fingerprint];

    if (!match) {
      // 精确匹配失败：这里先照搬 Python 版的保守策略直接放弃。
      // 后面如果想要 Rust 版那种“总能给出一个猜测”的兜底，
      // 可以在这里加一个基于汉明距离的最近邻匹配。
      return "Not solved";
    }

    result.push(match);
  }

  return result.join("");
}
