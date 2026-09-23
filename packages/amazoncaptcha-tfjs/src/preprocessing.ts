import * as tf from "@tensorflow/tfjs";

/**
 * 将像素矩阵预处理为模型输入的 tensor
 * @param letterMatrix 像素矩阵 (width x height)，0 为黑色，255 为白色
 * @param targetSize 目标尺寸 [width, height]
 * @returns 归一化后的 tensor [1, height, width, 1]
 */
export function preprocessLetter(
  letterMatrix: number[][],
  targetSize: [number, number] = [28, 28],
): tf.Tensor4D {
  const width = letterMatrix.length;
  const height = letterMatrix[0]?.length ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("Invalid letter matrix: empty dimensions");
  }

  // 转换为 [height, width] 的二维数组（符合图像习惯）
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 归一化: 0(黑) -> 1.0, 255(白) -> 0.0
      // 因为字母是黑色，我们希望黑色像素值更大
      pixels.push(letterMatrix[x][y] === 0 ? 1.0 : 0.0);
    }
  }

  // 创建 tensor [height, width, 1]
  const tensor = tf.tensor3d(pixels, [height, width, 1]);

  // 调整大小到目标尺寸
  const resized = tf.image.resizeBilinear(tensor, targetSize);

  // 添加 batch 维度 [1, height, width, 1]
  const batched = resized.expandDims(0) as tf.Tensor4D;

  // 清理中间 tensor
  tensor.dispose();
  resized.dispose();

  return batched;
}

/**
 * 字母转换为 one-hot 编码的索引
 * 'a' -> 0, 'b' -> 1, ..., 'z' -> 25
 */
export function letterToIndex(letter: string): number {
  const code = letter.toLowerCase().charCodeAt(0);
  if (code < 97 || code > 122) {
    throw new Error(`Invalid letter: ${letter}. Must be a-z.`);
  }
  return code - 97;
}

/**
 * 索引转换为字母
 * 0 -> 'a', 1 -> 'b', ..., 25 -> 'z'
 */
export function indexToLetter(index: number): string {
  if (index < 0 || index > 25) {
    throw new Error(`Invalid index: ${index}. Must be 0-25.`);
  }
  return String.fromCharCode(97 + index);
}

/**
 * 批量预处理字母矩阵
 */
export function preprocessLetterBatch(
  letterMatrices: number[][][],
  targetSize: [number, number] = [28, 28],
): tf.Tensor4D {
  const tensors = letterMatrices.map((matrix) =>
    preprocessLetter(matrix, targetSize),
  );

  // 合并为一个 batch
  const batched = tf.concat(tensors, 0) as tf.Tensor4D;

  // 清理中间 tensors
  tensors.forEach((t) => t.dispose());

  return batched;
}
