import * as tf from "@tensorflow/tfjs";
import { loadModelFromDirectory } from "./model-io.js";
import { preprocessLetter, indexToLetter } from "./preprocessing.js";

let cachedModel: tf.LayersModel | null = null;

/**
 * 加载训练好的模型（惰性加载 + 缓存）
 */
export async function loadModel(
  modelPath: string = "./models/captcha_model",
): Promise<tf.LayersModel> {
  if (!cachedModel) {
    console.log(`Loading model from: ${modelPath}`);
    cachedModel = await loadModelFromDirectory(modelPath);
  }
  return cachedModel;
}

/**
 * 预测单个字母
 * @param letterMatrix 像素矩阵 (width x height)
 * @param model 可选的模型实例，如果不提供则使用缓存的模型
 * @returns 预测的字母和置信度
 */
export async function predictLetter(
  letterMatrix: number[][],
  model?: tf.LayersModel,
): Promise<{ letter: string; confidence: number }> {
  const modelToUse = model || (await loadModel());

  // 预处理
  const inputTensor = preprocessLetter(letterMatrix);

  // 预测
  const prediction = modelToUse.predict(inputTensor) as tf.Tensor;

  // 获取结果
  const probabilities = await prediction.data();
  const predictedIndex = (await prediction.argMax(-1).data())[0];
  const confidence = probabilities[predictedIndex];

  // 清理 tensors
  inputTensor.dispose();
  prediction.dispose();

  return {
    letter: indexToLetter(predictedIndex),
    confidence,
  };
}

/**
 * 批量预测多个字母
 */
export async function predictLetters(
  letterMatrices: number[][][],
  model?: tf.LayersModel,
): Promise<Array<{ letter: string; confidence: number }>> {
  const modelToUse = model || (await loadModel());

  const results: Array<{ letter: string; confidence: number }> = [];

  for (const matrix of letterMatrices) {
    const result = await predictLetter(matrix, modelToUse);
    results.push(result);
  }

  return results;
}
