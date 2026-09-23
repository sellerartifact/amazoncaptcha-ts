/**
 * 示例：使用训练好的模型识别验证码
 */

import { solve } from "../src/index.js";
import { join } from "node:path";

async function example() {
  console.log("🔮 Amazon Captcha TensorFlow.js Example\n");

  // 示例验证码路径
  const captchaPath = join(
    process.cwd(),
    "..",
    "amazoncaptcha",
    "tests",
    "captchas",
    "notcorrupted.jpg",
  );

  console.log(`Testing captcha: ${captchaPath}`);

  try {
    // 识别验证码
    const result = await solve(captchaPath);

    console.log(`\n✅ Result: ${result}`);
    console.log(`   Expected: krjnby`);
    console.log(
      `   Match: ${result === "krjnby" ? "✓ Correct!" : "✗ Wrong"}`,
    );
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

example().catch(console.error);
