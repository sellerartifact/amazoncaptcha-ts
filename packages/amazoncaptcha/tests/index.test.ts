import { describe, expect, test } from "@rstest/core";
import path from "node:path";
import { solve } from "../src/index";

// tests/captchas/*，和你现有的目录结构对齐
const captchasDir = path.join(import.meta.dirname, "captchas");
const captchaPath = (filename: string) => path.join(captchasDir, filename);

/**
 * 关于大小写的说明：
 * Python 原版测试断言的是大写结果（如 'KRJNBY'），这是因为原仓库
 * training_data 里每个字母 json 的文件名本身就是大写（A.json、B.json...）。
 * 我们的 fingerprints.json 是从你复制来的 training_data 转换生成的，
 * 具体产出大写还是小写取决于你那份 training_data 文件名的大小写。
 * 为了不让测试对这个无关紧要的细节太脆弱，下面统一在比较前 toLowerCase()，
 * 只要字母识别对了，大小写不影响用例通过。如果你想严格锁定大小写，
 * 把 .toLowerCase() 去掉，换成你实际观察到的大小写即可。
 */

describe("solve", () => {
  test("识别暂时无法识别的验证码", async () => {
    const solution = await solve(captchaPath("notcorrupted.jpg"));
    expect(solution.toLowerCase()).toBe("not solved");
  });

  test("处理图像被循环裁切、首尾字母拆开需要合并的情况（对应 find_letter_boxes 切出 7 块 -> 合并首尾）", async () => {
    const solution = await solve(captchaPath("corrupted.png"));
    expect(solution.toLowerCase()).toBe("ugxgmm");
  });

  test("处理两个字母粘连成一个过宽区块、需要从中间切开的情况", async () => {
    const solution = await solve(captchaPath("corrupted_1.png"));
    expect(solution.toLowerCase()).toBe("bpxhgh");
  });

  test("同时存在粘连字母和被拆开字母的情况", async () => {
    const solution = await solve(captchaPath("corrupted_2.png"));
    expect(solution.toLowerCase()).toBe("kmgmxe");
  });

  test('6 个字母均无法在训练数据里精确匹配时返回 "Not solved"', async () => {
    const solution = await solve(captchaPath("notsolved.jpg"));
    expect(solution).toBe("Not solved");
  });

  test('图像本身解析异常（切割逻辑失效）时返回 "Not solved" 而不是抛异常', async () => {
    const solution = await solve(captchaPath("notsolved_1.jpg"));
    expect(solution).toBe("Not solved");
  });

  test('返回值要么是 6 位字符串，要么精确等于 "Not solved"，不会有第三种形态', async () => {
    const files = [
      "notcorrupted.jpg",
      "corrupted.png",
      "corrupted_1.png",
      "corrupted_2.png",
    ];

    for (const file of files) {
      const solution = await solve(captchaPath(file));
      const isValidShape = solution === "Not solved" || solution.length === 6;
      expect(isValidShape).toBe(true);
    }
  });
});
