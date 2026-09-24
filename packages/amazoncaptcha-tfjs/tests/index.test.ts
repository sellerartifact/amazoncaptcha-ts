import { expect, test, describe, beforeAll, afterAll } from "@rstest/core";
import * as tf from "@tensorflow/tfjs";
import path from "path";
import {
  buildModel,
  compileModel,
  loadModel,
  predictLetter,
  predictLetters,
  preprocessLetter,
  letterToIndex,
  indexToLetter,
  solve,
} from "../src/index";

describe("Model Building", () => {
  test("buildModel creates a valid model", () => {
    const model = buildModel();
    expect(model).toBeDefined();
    expect(model.layers.length).toBeGreaterThan(0);

    // 检查输入形状 [28, 28, 1]
    const inputShape = model.inputs[0].shape;
    expect(inputShape[1]).toBe(28);
    expect(inputShape[2]).toBe(28);
    expect(inputShape[3]).toBe(1);

    // 检查输出形状 [batch, 26] - 26个字母分类
    const outputShape = model.outputs[0].shape;
    expect(outputShape[1]).toBe(26);
  });

  test("compileModel compiles without errors", () => {
    const model = buildModel();
    expect(() => compileModel(model)).not.toThrow();
    expect(model.optimizer).toBeDefined();
    expect(model.loss).toBeDefined();
  });

  test("compileModel accepts custom learning rate", () => {
    const model = buildModel();
    compileModel(model, 0.01);
    expect(model.optimizer).toBeDefined();
  });
});

describe("Preprocessing Functions", () => {
  test("letterToIndex converts letters correctly", () => {
    expect(letterToIndex("a")).toBe(0);
    expect(letterToIndex("b")).toBe(1);
    expect(letterToIndex("z")).toBe(25);
    expect(letterToIndex("A")).toBe(0); // 大写也应该工作
    expect(letterToIndex("Z")).toBe(25);
  });

  test("letterToIndex throws on invalid input", () => {
    expect(() => letterToIndex("1")).toThrow();
    expect(() => letterToIndex("@")).toThrow();
    expect(() => letterToIndex("")).toThrow();
  });

  test("indexToLetter converts indices correctly", () => {
    expect(indexToLetter(0)).toBe("a");
    expect(indexToLetter(1)).toBe("b");
    expect(indexToLetter(25)).toBe("z");
  });

  test("indexToLetter throws on invalid input", () => {
    expect(() => indexToLetter(-1)).toThrow();
    expect(() => indexToLetter(26)).toThrow();
    expect(() => indexToLetter(100)).toThrow();
  });

  test("letterToIndex and indexToLetter are inverse operations", () => {
    for (let i = 0; i < 26; i++) {
      const letter = indexToLetter(i);
      expect(letterToIndex(letter)).toBe(i);
    }
  });

  test("preprocessLetter creates correct tensor shape", () => {
    // 创建一个简单的 10x10 矩阵
    const matrix = Array(10)
      .fill(0)
      .map(() => Array(10).fill(0));

    const tensor = preprocessLetter(matrix);

    expect(tensor).toBeDefined();
    expect(tensor.shape).toEqual([1, 28, 28, 1]); // [batch, height, width, channels]

    tensor.dispose();
  });

  test("preprocessLetter normalizes pixel values correctly", async () => {
    // 创建黑白混合矩阵
    const matrix = [
      [0, 255],
      [255, 0],
    ];

    const tensor = preprocessLetter(matrix);
    const values = await tensor.data();

    // 验证归一化: 0(黑) -> 1.0, 255(白) -> 0.0
    expect(values.some((v) => v > 0.5)).toBe(true); // 应该有接近1的值
    expect(values.some((v) => v < 0.5)).toBe(true); // 应该有接近0的值

    tensor.dispose();
  });

  test("preprocessLetter throws on empty matrix", () => {
    expect(() => preprocessLetter([])).toThrow();
    expect(() => preprocessLetter([[]])).toThrow();
  });

  test("preprocessLetter accepts custom target size", () => {
    const matrix = Array(10)
      .fill(0)
      .map(() => Array(10).fill(0));

    const tensor = preprocessLetter(matrix, [32, 32]);
    expect(tensor.shape).toEqual([1, 32, 32, 1]);

    tensor.dispose();
  });
});

describe("Model Loading and Prediction", () => {
  const modelPath = path.resolve(__dirname, "../models/captcha_model");
  let model: tf.LayersModel;

  beforeAll(async () => {
    // 加载训练好的模型
    model = await loadModel(modelPath);
  });

  test("loadModel loads the trained model", async () => {
    const loadedModel = await loadModel(modelPath);
    expect(loadedModel).toBeDefined();
    expect(loadedModel.layers.length).toBeGreaterThan(0);
  });

  test("model has correct input/output shapes", () => {
    const inputShape = model.inputs[0].shape;
    expect(inputShape[1]).toBe(28);
    expect(inputShape[2]).toBe(28);
    expect(inputShape[3]).toBe(1);

    const outputShape = model.outputs[0].shape;
    expect(outputShape[1]).toBe(26); // 26个字母
  });

  test("predictLetter returns valid prediction", async () => {
    // 创建一个测试矩阵
    const matrix = Array(20)
      .fill(0)
      .map(() => Array(20).fill(0));

    const result = await predictLetter(matrix, model);

    expect(result).toBeDefined();
    expect(result.letter).toBeDefined();
    expect(result.letter.length).toBe(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(/[a-z]/.test(result.letter)).toBe(true);
  });

  test("predictLetters handles multiple letters", async () => {
    const matrices = [
      Array(20)
        .fill(0)
        .map(() => Array(20).fill(0)),
      Array(20)
        .fill(0)
        .map(() => Array(20).fill(255)),
      Array(20)
        .fill(0)
        .map(() => Array(20).fill(0)),
    ];

    const results = await predictLetters(matrices, model);

    expect(results).toBeDefined();
    expect(results.length).toBe(3);

    results.forEach((result) => {
      expect(result.letter).toBeDefined();
      expect(result.letter.length).toBe(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(/[a-z]/.test(result.letter)).toBe(true);
    });
  });

  test("predictLetters handles empty array", async () => {
    const results = await predictLetters([], model);
    expect(results).toEqual([]);
  });

  test("prediction confidence is in valid range", async () => {
    const matrix = Array(20)
      .fill(0)
      .map(() => Array(20).fill(0));

    const result = await predictLetter(matrix, model);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.confidence)).toBe(true);
  });
});

describe("Integration Tests", () => {
  const testImagesPath = path.resolve(__dirname, "../training-data");

  test("solve function returns valid result or 'Not solved'", async () => {
    // 使用第一个训练图片进行测试
    const testImagePath = path.join(
      testImagesPath,
      "dl_sgkknrsjhmfbeuunyv_ACMMUG.png",
    );

    const result = await solve(testImagePath);

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");

    // 结果要么是6个字母，要么是 "Not solved"
    if (result !== "Not solved") {
      expect(result.length).toBe(6);
      expect(/^[a-z]{6}$/.test(result)).toBe(true);
    }
  }, 30000); // 增加超时时间

  test("solve respects confidence threshold", async () => {
    const testImagePath = path.join(
      testImagesPath,
      "dl_sgkknrsjhmfbeuunyv_ACMMUG.png",
    );

    // 使用很高的置信度阈值，更可能返回 "Not solved"
    const highThresholdResult = await solve(testImagePath, 0.99);
    expect(highThresholdResult).toBeDefined();

    // 使用低置信度阈值，更可能返回结果
    const lowThresholdResult = await solve(testImagePath, 0.1);
    expect(lowThresholdResult).toBeDefined();
  }, 30000);

  test("solve handles multiple test images", async () => {
    const testImages = [
      "dl_sgkknrsjhmfbeuunyv_ACMMUG.png",
      "dl_yniigayfnnvfwljifz_NMPNHG.png",
      "dl_lqbiackdrwnogypykv_HRGLFP.png",
    ];

    for (const imageName of testImages) {
      const imagePath = path.join(testImagesPath, imageName);
      const result = await solve(imagePath, 0.5);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      if (result !== "Not solved") {
        expect(result.length).toBe(6);
        expect(/^[a-z]{6}$/.test(result)).toBe(true);
      }
    }
  }, 60000);
});

describe("Model Accuracy Tests", () => {
  const testImagesPath = path.resolve(__dirname, "../training-data");

  test("model predicts correct labels from filenames", async () => {
    // 从文件名提取真实标签进行验证
    const testCases = [
      { file: "dl_sgkknrsjhmfbeuunyv_ACMMUG.png", expected: "acmmug" },
      { file: "dl_yniigayfnnvfwljifz_NMPNHG.png", expected: "nmpnhg" },
      { file: "dl_lqbiackdrwnogypykv_HRGLFP.png", expected: "hrglfp" },
    ];

    let correct = 0;
    const results: Array<{ file: string; expected: string; predicted: string }> = [];

    for (const testCase of testCases) {
      const imagePath = path.join(testImagesPath, testCase.file);
      const predicted = await solve(imagePath, 0.3);

      results.push({
        file: testCase.file,
        expected: testCase.expected,
        predicted,
      });

      if (predicted === testCase.expected) {
        correct++;
      }
    }

    // 输出结果用于调试
    console.log("\n模型预测结果:");
    results.forEach((r) => {
      const status = r.predicted === r.expected ? "✓" : "✗";
      console.log(`${status} ${r.file}: expected="${r.expected}", predicted="${r.predicted}"`);
    });

    const accuracy = correct / testCases.length;
    console.log(`\n准确率: ${(accuracy * 100).toFixed(1)}% (${correct}/${testCases.length})`);

    // 至少要有一个预测正确（模型不是完全随机的）
    expect(correct).toBeGreaterThan(0);
  }, 60000);
});

describe("Memory Management", () => {
  test("tensors are properly disposed after prediction", async () => {
    const initialTensors = tf.memory().numTensors;

    const matrix = Array(20)
      .fill(0)
      .map(() => Array(20).fill(0));

    await predictLetter(matrix);

    const finalTensors = tf.memory().numTensors;

    // 张量数量不应该大幅增加（允许模型缓存）
    expect(finalTensors - initialTensors).toBeLessThan(10);
  });

  test("batch prediction manages memory correctly", async () => {
    const initialTensors = tf.memory().numTensors;

    const matrices = Array(6)
      .fill(0)
      .map(() =>
        Array(20)
          .fill(0)
          .map(() => Array(20).fill(0)),
      );

    await predictLetters(matrices);

    const finalTensors = tf.memory().numTensors;

    // 张量数量不应该大幅增加
    expect(finalTensors - initialTensors).toBeLessThan(20);
  });
});
