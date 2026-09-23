/**
 * 下载训练数据的脚本
 *
 * 从 amazon-captcha-database 仓库下载训练数据
 * 或者手动收集验证码图片
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

console.log("📦 Training Data Download Script\n");

console.log("⚠️  Training data options:\n");
console.log("Option 1: Download from amazon-captcha-database");
console.log("  GitHub: https://github.com/a-maliarov/amazon-captcha-database");
console.log("  Clone this repo and extract captcha images\n");

console.log("Option 2: Manually collect captchas");
console.log("  1. Visit Amazon pages that show captchas");
console.log("  2. Save captcha images to: data/raw/");
console.log("  3. Create labels.json with format:");
console.log('     { "captcha1.jpg": "abcdef", "captcha2.jpg": "ghijkl" }\n');

console.log("Option 3: Use test captchas from amazoncaptcha package");
console.log("  We'll use the existing test images for initial training\n");

// 创建示例 labels.json
const dataDir = join(process.cwd(), "data");
const rawDir = join(dataDir, "raw");

if (!existsSync(rawDir)) {
  mkdirSync(rawDir, { recursive: true });
}

const exampleLabels = {
  "notcorrupted.jpg": "krjnby",
  // 添加更多标注...
  // "captcha1.jpg": "example",
  // "captcha2.jpg": "abcdef",
};

const labelsPath = join(dataDir, "labels.json");
writeFileSync(labelsPath, JSON.stringify(exampleLabels, null, 2), "utf-8");

console.log(`✅ Created example labels file: ${labelsPath}`);
console.log("\n📝 Next steps:");
console.log("  1. Add more captcha images to data/raw/");
console.log("  2. Update data/labels.json with correct labels");
console.log("  3. Run: pnpm run prepare-data");
