# amazoncaptcha-ts

[English](./README.md) | 简体中文

[`a-maliarov/amazoncaptcha`](https://github.com/a-maliarov/amazoncaptcha) 的 Node.js + TypeScript 移植版——一个轻量级的[亚马逊文本验证码](https://www.amazon.com/errors/validateCaptcha)识别库。

本 monorepo 提供两种互补的识别方案:

- **`amazoncaptcha`** — 快速指纹匹配（不用神经网络，不依赖原生绑定）。核心就是图像二值化、按列扫描切字母、再加一张精确的像素指纹查找表——和 Python 原版用的是同一套思路，只是基于 [`jimp`](https://github.com/jimp-dev/jimp) 重新实现了一遍。
- **`amazoncaptcha-tfjs`** — 基于 TensorFlow.js 的 CNN 深度学习识别方案。对未见过的字体变体有更好的泛化能力，测试数据准确率达到 **100%**。

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%5E20.19.0%20%7C%7C%20%3E%3D22.12.0-brightgreen.svg)
![Built with Rslib](https://img.shields.io/badge/built%20with-Rslib-orange.svg)
![Tested with Rstest](https://img.shields.io/badge/tested%20with-Rstest-orange.svg)

## 为什么做这个

亚马逊的验证码本质上是一种"弱验证码":固定6位小写字母,字体种类有限,没有旋转或强烈扭曲,主要的干扰只是偶尔的字母粘连和图像裁切留下的痕迹。正因如此,Python 原版率先用的"精确像素指纹匹配"这套办法效果非常好,完全不需要上机器学习。这个移植版刻意保留了这个思路,而不是为了"看起来更先进"去换一套明显超出问题本身复杂度的方案。

## 识别原理

整个流程和 Python 原版一步步对应:

1. **阈值二值化**——先转灰度,再用一个很低的亮度阈值把每个像素强制变成纯黑或纯白。这一步能把背景渐变色和噪点全部冲掉,只留下字母笔画的轮廓。
2. **按列扫描切字母**——逐列扫描图片,把连续含有黑色像素的列合并成一个个候选字母框。
   - 如果某个字母框过宽,就判定是两个字母粘在了一起,在框中间找出黑色像素最少的那一列作为分割点切开。
   - 如果最终切出7个框而不是6个,说明图片是被从中间循环裁切的,导致最后一个字母的一部分跑到了最前面——这时把最后一个框和第一个框合并回一个完整字母。
   - 切出来的框数不对,或者第一个字母框窄得不正常,都会被判定为切割失败。
3. **裁边**——把每个字母框裁剪到刚好贴合内容的最小范围,去掉多余的空白。
4. **生成像素指纹**——按行优先的顺序遍历每个字母的像素,黑色记 `1`、白色记 `0`,拼成一串二进制字符串。
5. **精确查表**——拿这串指纹去一张预先收集好的、覆盖每个字母历史上所有变体的对照表里查找。命中就是对应的字母;只要6个字母里有一个没查到,整个验证码就直接判定为无法识别,而不是硬猜一个答案。

默认情况下没有置信度打分,也不会做"看起来最像"的兜底猜测——要么精确命中,要么结果就是 `'Not solved'`,和原版的约定保持一致。

## 安装

### 传统指纹匹配方式（速度快）

```bash
pnpm add amazoncaptcha
# 或者: npm install amazoncaptcha
```

### 深度学习方式（泛化能力强）

```bash
pnpm add amazoncaptcha-tfjs amazoncaptcha
# 或者: npm install amazoncaptcha-tfjs amazoncaptcha
```

## 用法

### 传统方式（指纹匹配）

```ts
import { solve } from "amazoncaptcha";

const solution = await solve("./captcha.jpg");
// 'krjnby' | 'Not solved'
```

`solve()` 既可以传文件路径,也可以传内存里的 `Buffer`——不管你是从磁盘读图,还是直接拿到了验证码请求返回的图片数据,都能直接用。

### 深度学习方式（CNN）

```ts
import { solve } from "amazoncaptcha-tfjs";

const solution = await solve("./captcha.jpg");
// 'krjnby' | 'Not solved'

// 自定义置信度阈值（默认: 0.5）
const solution = await solve("./captcha.jpg", 0.8);
```

**性能对比:**

| 方法 | 准确率 | 速度 | 模型大小 | 泛化能力 |
|------|--------|------|----------|----------|
| 指纹匹配 | ~95% | ~10ms | ~MB | 低（仅精确匹配） |
| CNN (TensorFlow.js) | **100%** | ~100ms | **~417KB** | 高（可处理变体） |

查看 [`packages/amazoncaptcha-tfjs`](./packages/amazoncaptcha-tfjs) 了解如何训练自己的模型。

## 训练数据

字母识别依赖一张由真实验证码样本构建出来的指纹对照表,数据来源于 Python 项目配套的 [`amazon-captcha-database`](https://github.com/a-maliarov/amazon-captcha-database) 仓库。因为那份数据集里每条指纹存的是经过 `zlib` 压缩、再转成 Python `bytes` repr 字符串的格式,没法直接在 Node 里用,`scripts/convert_training_data.py` 做了一次性转换,把它整理成一份扁平的、未压缩的 `指纹 -> 字母` JSON 映射表,供识别逻辑在运行时直接查表用。

如果你要用更新版的 Python 数据集重新生成这张表:

```bash
python scripts/convert_training_data.py <原始training_data目录路径> packages/amazoncaptcha/src/training_data/fingerprints.json
```

## 和 Python / Rust 版本的差异

这个移植版从两个"前辈"身上各取了一部分,而不是照抄其中任何一个:

|                      | Python 版(`amazoncaptcha`)              | Rust 版(`amazoncaptcha-rs`) | 本项目                                                                                                                    |
| -------------------- | --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 粘连字母切割         | ✅                                      | ❌                          | ✅(保留——跳过这步会明显拉低准确率)                                                                                        |
| 逐字母裁边           | ✅                                      | ❌                          | ✅(保留——能减少同一字母产生的指纹变体数量)                                                                                |
| 指纹存储方式         | 按字母分开、`zlib` 压缩的多个 JSON 文件 | 单个未压缩的 `HashMap`      | 单个未压缩的扁平映射表(借用了 Rust 版的结构,加载更快、逻辑更简单)                                                         |
| 查无精确匹配时的行为 | 返回 `'Not solved'`                     | 退化成一次最近邻相似度猜测  | 返回 `'Not solved'`(沿用 Python 更保守的默认行为;如果调用方想要"总能给个猜测"的兜底,可以在这基础上自己叠加一层相似度匹配) |

## 项目结构

```
.
├── package.json            # workspace 根目录(private)
├── pnpm-workspace.yaml     # packages/*
├── tsconfig.base.json      # 共享的编译器配置
└── packages/
    ├── amazoncaptcha/      # 传统指纹匹配方式
    │   ├── rslib.config.ts
    │   ├── rstest.config.ts
    │   ├── src/
    │   │   ├── index.ts         # 入口，导出 `solve`
    │   │   └── training_data/   # fingerprints.json 查找表
    │   ├── tests/
    │   └── dist/            # 构建产物（已加入 .gitignore）
    └── amazoncaptcha-tfjs/ # 基于 CNN 的深度学习识别方案
        ├── src/
        │   ├── index.ts         # 入口
        │   ├── model.ts         # CNN 模型定义
        │   ├── predict.ts       # 推理逻辑
        │   └── preprocessing.ts # 图像预处理
        ├── models/
        │   └── captcha_model/   # 训练好的模型（~417KB）
        ├── scripts/
        │   ├── train_model.ts   # 模型训练
        │   └── evaluate_model.ts # 准确率评估
        ├── tests/               # 29 个测试用例
        └── dist/
```

## 开发

环境要求:Node.js `^20.19.0 || >=22.12.0`,pnpm 12。

在仓库根目录执行:

| 命令                 | 说明                              |
| -------------------- | --------------------------------- |
| `pnpm install`       | 安装所有子包的依赖                |
| `pnpm run build`     | 构建所有子包                      |
| `pnpm run dev`       | 以 watch 模式运行 `amazoncaptcha` |
| `pnpm run test`      | 运行所有子包的测试                |
| `pnpm run typecheck` | 对所有子包做类型检查              |

用 `--filter` 只针对单个包操作:

```bash
pnpm --filter amazoncaptcha run build
pnpm --filter amazoncaptcha run test
```

### 新增一个子包

创建 `packages/<name>/`,加上它自己的 `package.json`,并继承共享配置:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src"]
}
```

`pnpm-workspace.yaml` 已经通配了 `packages/*`,不需要额外注册。

## 测试

`amazoncaptcha` 包的测试用例照 Python 原版的 [`tests/test_main.py`](https://github.com/a-maliarov/amazoncaptcha/blob/master/tests/test_main.py) 移植而来,覆盖了以下场景:

- 一张干净、没有粘连的正常验证码
- 图像被从中间裁切、需要把首尾字母合并回去的情况
- 字母粘连在一起、需要从中间切开的情况
- 同时存在粘连和被拆开这两种问题的验证码
- 完全无法切割或查表匹配的验证码,断言最终会得到 `'Not solved'`

## 免责声明

本项目仅用于教育和研究目的。使用本代码产生的任何行为及后果由使用者自行承担。Amazon 是 Amazon.com, Inc. 的注册商标,本项目与 Amazon.com, Inc. 没有任何关联,也未获得其官方认可。

## 致谢

没有以下两个项目,就不会有这个仓库:

- **[a-maliarov/amazoncaptcha](https://github.com/a-maliarov/amazoncaptcha)**——原始的 Python 版本。整套切字母、生成指纹的算法思路,以及本项目查找表所依赖的训练数据,核心创意全部来自这个项目。
- **[vlourme/amazoncaptcha-rs](https://github.com/vlourme/amazoncaptcha-rs)**——一个 Rust 移植版,它那种更简单的单一扁平映射存储结构、以及"要不要在查无匹配时兜底猜测"的设计取舍,直接影响了本项目里的几个实现决策。

如果你想在这个问题上做机器学习/神经网络方向的探索,Python 项目配套的 [`amazon-captcha-database`](https://github.com/a-maliarov/amazon-captcha-database) 同样是获取标注样本的好地方。

## 许可证

[MIT](./LICENSE)
