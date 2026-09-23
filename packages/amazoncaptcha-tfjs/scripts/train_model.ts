/**
 * 模型训练脚本
 *
 * 注意：使用纯 JS 版本的 TensorFlow.js 训练会比较慢
 * 如果需要更快的训练速度，建议：
 * 1. 在 Linux/Mac 上使用 @tensorflow/tfjs-node
 * 2. 或者使用 Python + TensorFlow 训练后转换模型
 */

import * as tf from "@tensorflow/tfjs";

// 使用默认的 CPU 后端（更稳定）
await tf.ready();
console.log(`Using backend: ${tf.getBackend()}`);
import { Jimp } from "jimp";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildModel, compileModel } from "../src/model.js";
import { letterToIndex, indexToLetter } from "../src/preprocessing.js";
import { shuffle } from "../src/utils.js";

interface TrainingDataItem {
  filename: string;
  label: string;
  captchaSource: string;
}

/**
 * 加载单个字母图片
 */
async function loadLetterImage(imagePath: string): Promise<number[][]> {
  const image = await Jimp.read(imagePath);
  const width = image.width;
  const height = image.height;

  const matrix: number[][] = [];

  for (let x = 0; x < width; x++) {
    const column: number[] = [];
    for (let y = 0; y < height; y++) {
      const color = image.getPixelColor(x, y);
      const r = (color >>> 24) & 0xff;
      // 简化：只看红色通道（因为是黑白图）
      column.push(r === 0 ? 0 : 255);
    }
    matrix.push(column);
  }

  return matrix;
}

/**
 * 将像素矩阵转换为 tensor
 */
function matrixToTensor(
  matrix: number[][],
  targetSize: [number, number] = [28, 28],
): tf.Tensor3D {
  const width = matrix.length;
  const height = matrix[0]?.length ?? 0;

  // 转换为 [height, width, 1] 格式
  const pixels: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push(matrix[x][y] === 0 ? 1.0 : 0.0); // 黑色=1, 白色=0
    }
  }

  const tensor = tf.tensor3d(pixels, [height, width, 1]);
  const resized = tf.image.resizeBilinear(tensor, targetSize);

  tensor.dispose();

  return resized as tf.Tensor3D;
}

/**
 * 加载训练数据
 */
async function loadTrainingData(
  dataDir: string,
  indexPath: string,
  trainRatio = 0.8,
) {
  console.log("📂 Loading training data...");

  const indexContent = readFileSync(indexPath, "utf-8");
  const trainingIndex: TrainingDataItem[] = JSON.parse(indexContent);

  if (trainingIndex.length === 0) {
    throw new Error("No training data found!");
  }

  console.log(`   Found ${trainingIndex.length} samples`);

  // 打乱数据
  const shuffled = shuffle(trainingIndex);

  // 划分训练集和验证集
  const trainSize = Math.floor(shuffled.length * trainRatio);
  const trainItems = shuffled.slice(0, trainSize);
  const valItems = shuffled.slice(trainSize);

  console.log(
    `   Train: ${trainItems.length}, Validation: ${valItems.length}`,
  );

  // 加载图片并转换为 tensors
  const loadDataset = async (items: TrainingDataItem[]) => {
    const images: tf.Tensor3D[] = [];
    const labels: number[] = [];

    for (const item of items) {
      const imagePath = join(dataDir, item.filename);
      try {
        const matrix = await loadLetterImage(imagePath);
        const tensor = matrixToTensor(matrix);
        images.push(tensor);
        labels.push(letterToIndex(item.label));
      } catch (error) {
        console.warn(`   ⚠️  Failed to load ${item.filename}:`, error);
      }
    }

    // 合并为 batch tensors
    const xs = tf.stack(images) as tf.Tensor4D;
    const ys = tf.oneHot(tf.tensor1d(labels, "int32"), 26);

    // 清理中间 tensors
    images.forEach((t) => t.dispose());

    return { xs, ys };
  };

  console.log("   Loading train images...");
  const trainData = await loadDataset(trainItems);

  console.log("   Loading validation images...");
  const valData = await loadDataset(valItems);

  return { trainData, valData };
}

/**
 * 训练模型
 */
async function train() {
  console.log("🧠 Amazon Captcha - TensorFlow.js Training\n");

  const dataDir = join(process.cwd(), "data", "processed");
  const indexPath = join(process.cwd(), "data", "training_index.json");
  const modelSavePath = "file://" + join(process.cwd(), "models", "captcha_model");

  // 加载数据
  const { trainData, valData } = await loadTrainingData(dataDir, indexPath);

  console.log(`\n📊 Data shapes:`);
  console.log(`   Train X: ${trainData.xs.shape}`);
  console.log(`   Train Y: ${trainData.ys.shape}`);
  console.log(`   Val X: ${valData.xs.shape}`);
  console.log(`   Val Y: ${valData.ys.shape}`);

  // 构建模型
  console.log("\n🏗️  Building model...");
  const model = buildModel();
  compileModel(model, 0.001);

  model.summary();

  // 训练参数
  const epochs = 50;
  const batchSize = 32;

  console.log("\n🏋️  Training...\n");

  await model.fit(trainData.xs, trainData.ys, {
    epochs,
    batchSize,
    validationData: [valData.xs, valData.ys],
    shuffle: true,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(
          `Epoch ${epoch + 1}/${epochs} - ` +
            `loss: ${logs?.loss.toFixed(4)} - ` +
            `acc: ${logs?.acc.toFixed(4)} - ` +
            `val_loss: ${logs?.val_loss.toFixed(4)} - ` +
            `val_acc: ${logs?.val_acc.toFixed(4)}`,
        );
      },
    },
  });

  // 保存模型
  console.log(`\n💾 Saving model to: ${modelSavePath}`);
  await model.save(modelSavePath);

  // 测试几个预测
  console.log("\n🧪 Testing predictions...");
  const testIndices = [0, 1, 2, 3, 4];
  for (const idx of testIndices) {
    const input = trainData.xs.slice(idx, 1);
    const prediction = model.predict(input) as tf.Tensor;
    const predictedIndex = (await prediction.argMax(-1).data())[0];
    const actualIndex = (await trainData.ys.slice(idx, 1).argMax(-1).data())[0];

    console.log(
      `   Sample ${idx}: Predicted=${indexToLetter(predictedIndex)}, Actual=${indexToLetter(actualIndex)}`,
    );

    input.dispose();
    prediction.dispose();
  }

  // 清理内存
  trainData.xs.dispose();
  trainData.ys.dispose();
  valData.xs.dispose();
  valData.ys.dispose();

  console.log("\n✅ Training complete!");
}

// 运行训练
train().catch(console.error);
