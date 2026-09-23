import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 保存 JSON 数据到文件
 */
export function saveJson(filepath: string, data: any): void {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 从文件加载 JSON 数据
 */
export function loadJson<T = any>(filepath: string): T {
  const content = readFileSync(filepath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * 打乱数组顺序
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 划分数据集为训练集和验证集
 */
export function splitDataset<T>(
  data: T[],
  trainRatio: number = 0.8,
): { train: T[]; val: T[] } {
  const shuffled = shuffle(data);
  const trainSize = Math.floor(shuffled.length * trainRatio);
  return {
    train: shuffled.slice(0, trainSize),
    val: shuffled.slice(trainSize),
  };
}
