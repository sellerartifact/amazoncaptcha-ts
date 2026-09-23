/**
 * 准备训练数据脚本
 *
 * 该脚本从验证码图片中提取单个字母，生成训练数据集
 * 复用 amazoncaptcha 包的图像处理逻辑
 */

import { Jimp } from "jimp";
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

// 从 amazoncaptcha 包复制的核心函数
const MONOWEIGHT = 1;
const MAXIMUM_LETTER_LENGTH = 33;

type PixelMatrix = number[][];

async function toMonochromeMatrix(imagePath: string): Promise<PixelMatrix> {
  const image = await Jimp.read(imagePath);
  const width = image.width;
  const height = image.height;

  const matrix: PixelMatrix = [];

  for (let x = 0; x < width; x++) {
    const column: number[] = new Array(height);

    for (let y = 0; y < height; y++) {
      const color = image.getPixelColor(x, y);
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

  if (maxY === -1) return letter;

  return letter.map((column) => column.slice(minY, maxY + 1));
}

function mergeHorizontally(a: PixelMatrix, b: PixelMatrix): PixelMatrix {
  return [...a, ...b];
}

/**
 * 将像素矩阵保存为图片
 */
async function saveLetterImage(
  letter: PixelMatrix,
  outputPath: string,
): Promise<void> {
  const width = letter.length;
  const height = letter[0]?.length ?? 0;

  const image = new Jimp({ width, height });

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pixel = letter[x][y];
      const color =
        pixel === 0 ? 0x000000ff : 0xffffffff; // 黑色或白色
      image.setPixelColor(color, x, y);
    }
  }

  await image.write(outputPath);
}

interface TrainingDataItem {
  filename: string;
  label: string;
  captchaSource: string;
}

/**
 * 从验证码图片中提取字母
 */
async function extractLettersFromCaptcha(
  captchaPath: string,
  expectedLabel: string,
  outputDir: string,
): Promise<TrainingDataItem[]> {
  console.log(`Processing: ${captchaPath}`);

  try {
    const matrix = await toMonochromeMatrix(captchaPath);
    let letters = findLetterBoxes(matrix, MAXIMUM_LETTER_LENGTH);

    // 处理边界情况
    if (letters.length === 7) {
      letters[6] = mergeHorizontally(letters[6], letters[0]);
      letters = letters.slice(1);
    }

    if (letters.length !== 6) {
      console.warn(
        `  ⚠️  Expected 6 letters, got ${letters.length}. Skipping.`,
      );
      return [];
    }

    if (expectedLabel.length !== 6) {
      console.warn(
        `  ⚠️  Expected label length 6, got ${expectedLabel.length}. Skipping.`,
      );
      return [];
    }

    const trimmedLetters = letters.map(cutTheWhite);
    const captchaBasename = basename(captchaPath, ".jpg")
      .replace(".png", "")
      .replace(/[^a-zA-Z0-9]/g, "_");

    const results: TrainingDataItem[] = [];

    for (let i = 0; i < trimmedLetters.length; i++) {
      const letter = trimmedLetters[i];
      const label = expectedLabel[i].toLowerCase();
      const filename = `${captchaBasename}_${i}_${label}.png`;
      const outputPath = join(outputDir, filename);

      await saveLetterImage(letter, outputPath);

      results.push({
        filename,
        label,
        captchaSource: basename(captchaPath),
      });
    }

    console.log(`  ✓ Extracted ${results.length} letters`);
    return results;
  } catch (error) {
    console.error(`  ✗ Error processing ${captchaPath}:`, error);
    return [];
  }
}

/**
 * 主函数
 */
async function main() {
  const captchasDir = join(
    process.cwd(),
    "..",
    "amazoncaptcha",
    "tests",
    "captchas",
  );
  const outputDir = join(process.cwd(), "data", "processed");

  // 创建输出目录
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 验证码及其标签（从 amazoncaptcha 包的测试用例获取）
  const captchaLabels: Record<string, string> = {
    "notcorrupted.jpg": "krjnby",
    // 添加更多已知标签的验证码
    // 你需要手动标注或从已知数据集获取
  };

  console.log("🚀 Starting training data preparation...\n");

  const allTrainingData: TrainingDataItem[] = [];

  // 处理所有验证码
  for (const [filename, label] of Object.entries(captchaLabels)) {
    const captchaPath = join(captchasDir, filename);

    if (!existsSync(captchaPath)) {
      console.warn(`⚠️  File not found: ${captchaPath}`);
      continue;
    }

    const items = await extractLettersFromCaptcha(
      captchaPath,
      label,
      outputDir,
    );
    allTrainingData.push(...items);
  }

  // 保存训练数据索引
  const indexPath = join(process.cwd(), "data", "training_index.json");
  writeFileSync(indexPath, JSON.stringify(allTrainingData, null, 2), "utf-8");

  console.log(`\n✅ Done! Extracted ${allTrainingData.length} letters.`);
  console.log(`   Output: ${outputDir}`);
  console.log(`   Index: ${indexPath}`);

  // 统计每个字母的数量
  const letterCounts: Record<string, number> = {};
  for (const item of allTrainingData) {
    letterCounts[item.label] = (letterCounts[item.label] || 0) + 1;
  }

  console.log("\n📊 Letter distribution:");
  Object.entries(letterCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([letter, count]) => {
      console.log(`   ${letter}: ${count}`);
    });
}

main().catch(console.error);
