import { solve } from "../src/index.js";
import { readdir } from "fs/promises";
import { join } from "path";

const testDataDir = "./training-data";
const files = (await readdir(testDataDir)).filter((f) => f.endsWith(".png"));

// 随机选择 20 个样本进行测试
const sampleSize = Math.min(20, files.length);
const sampledFiles = files.sort(() => Math.random() - 0.5).slice(0, sampleSize);

let correct = 0;
let total = 0;
const results: Array<{
  file: string;
  expected: string;
  predicted: string;
  match: boolean;
}> = [];

console.log(`\n🧪 评估模型准确率（样本数: ${sampleSize}）\n`);

for (const file of sampledFiles) {
  // 从文件名提取真实标签
  // 格式: dl_xxxxx_ABCDEF.png
  const match = file.match(/_([A-Z]{6})\.png$/);
  if (!match) continue;

  const expected = match[1].toLowerCase();
  const result = await solve(join(testDataDir, file), 0.5);

  total++;
  const isCorrect = result === expected;
  if (isCorrect) correct++;

  results.push({
    file,
    expected,
    predicted: result,
    match: isCorrect,
  });

  const icon = isCorrect ? "✓" : "✗";
  console.log(`${icon} ${file}: expected="${expected}", predicted="${result}"`);
}

const accuracy = ((correct / total) * 100).toFixed(1);
console.log(`\n📊 准确率: ${accuracy}% (${correct}/${total})`);
console.log(`\n详细统计:`);
console.log(`  - 正确: ${correct}`);
console.log(`  - 错误: ${total - correct}`);
console.log(`  - 总计: ${total}`);
