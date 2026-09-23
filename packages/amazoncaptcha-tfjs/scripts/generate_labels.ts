/**
 * 从 training-data 目录生成标签文件
 * 文件名格式: dl_xxx_LABEL.png
 */

import { readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const trainingDataDir = join(process.cwd(), "training-data");
const outputPath = join(process.cwd(), "data", "labels.json");

console.log("🏷️  Generating labels.json from training-data...\n");

// 读取所有 PNG 文件
const files = readdirSync(trainingDataDir).filter((f) =>
  f.toLowerCase().endsWith(".png"),
);

console.log(`Found ${files.length} images`);

// 解析文件名提取标签
const labels: Record<string, string> = {};
let skipped = 0;

for (const filename of files) {
  // 文件名格式: dl_lqbiackdrhjanthegi_TMYGRG.png
  // 提取最后一个下划线后的部分（去掉 .png）
  const parts = filename.replace(".png", "").split("_");
  const label = parts[parts.length - 1];

  // 验证标签格式：应该是 6 个字母
  if (label.length === 6 && /^[A-Za-z]+$/.test(label)) {
    labels[filename] = label.toLowerCase();
  } else {
    console.warn(`  ⚠️  Skipping ${filename}: invalid label "${label}"`);
    skipped++;
  }
}

console.log(`\n✅ Parsed ${Object.keys(labels).length} valid labels`);
if (skipped > 0) {
  console.log(`⚠️  Skipped ${skipped} files with invalid labels`);
}

// 保存 labels.json
writeFileSync(outputPath, JSON.stringify(labels, null, 2), "utf-8");

console.log(`\n💾 Saved to: ${outputPath}`);

// 统计字母分布
const letterCounts: Record<string, number> = {};
for (const label of Object.values(labels)) {
  for (const letter of label) {
    letterCounts[letter] = (letterCounts[letter] || 0) + 1;
  }
}

console.log("\n📊 Letter distribution:");
Object.entries(letterCounts)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([letter, count]) => {
    console.log(`   ${letter}: ${count}`);
  });

console.log(
  `\n🎯 Next step: pnpm run prepare-data (to extract individual letters)`,
);
