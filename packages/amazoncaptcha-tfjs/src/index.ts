/**
 * Amazon Captcha TensorFlow.js Solver
 *
 * 使用深度学习（CNN）识别亚马逊验证码
 * 采用单字符识别方案：
 *   1. 使用传统方法分割验证码为 6 个字母
 *   2. 对每个字母使用 CNN 模型进行分类识别
 *   3. 组合结果得到完整验证码
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";

// 初始化 WASM 后端
setWasmPaths("node_modules/@tensorflow/tfjs-backend-wasm/dist/");
await tf.setBackend("wasm");
await tf.ready();

// 导出核心功能
export { buildModel, compileModel } from "./model.js";
export { saveModel } from "./model-io.js";
export { loadModel, predictLetter, predictLetters } from "./predict.js";
export {
  preprocessLetter,
  preprocessLetterBatch,
  letterToIndex,
  indexToLetter,
} from "./preprocessing.js";

// 从 amazoncaptcha 包导入分割逻辑（运行时动态导入）
async function importAmazoncaptcha() {
  try {
    // @ts-ignore
    return await import("amazoncaptcha");
  } catch (error) {
    throw new Error(
      "Failed to import 'amazoncaptcha' package. Make sure it's installed.",
    );
  }
}

/**
 * 主入口：识别验证码
 * @param source 验证码图片路径或 Buffer
 * @param confidenceThreshold 置信度阈值，低于此值返回 'Not solved'
 * @returns 识别结果或 'Not solved'
 */
export async function solve(
  source: string | Buffer,
  confidenceThreshold: number = 0.5,
): Promise<string> {
  // 动态导入 amazoncaptcha 的分割函数
  const amazoncaptcha = await importAmazoncaptcha();

  // 使用传统方法分割字母
  const matrix = await amazoncaptcha.toMonochromeMatrix(source);
  let letters = amazoncaptcha.findLetterBoxes(
    matrix,
    33, // MAXIMUM_LETTER_LENGTH
  );

  // 处理边界情况
  const looksBroken =
    (letters.length === 6 && letters[0].length < 14) || // MINIMUM_LETTER_LENGTH
    (letters.length !== 6 && letters.length !== 7);

  if (looksBroken) {
    return "Not solved";
  }

  if (letters.length === 7) {
    letters[6] = amazoncaptcha.mergeHorizontally(letters[6], letters[0]);
    letters = letters.slice(1);
  }

  // 裁剪空白
  const trimmedLetters = letters.map((l: any) => amazoncaptcha.cutTheWhite(l));

  // 使用 CNN 模型预测每个字母
  const { predictLetters } = await import("./predict.js");
  const predictions = await predictLetters(trimmedLetters);

  // 检查置信度
  for (const pred of predictions) {
    if (pred.confidence < confidenceThreshold) {
      return "Not solved";
    }
  }

  // 组合结果
  return predictions.map((p) => p.letter).join("");
}
