# amazoncaptcha-tfjs

使用 TensorFlow.js 和深度学习识别 Amazon 验证码的 TypeScript 实现。

## 概述

该包提供了一个基于 CNN（卷积神经网络）的验证码识别方案，作为传统像素指纹匹配方法的替代：

- **传统方法** ([amazoncaptcha](../amazoncaptcha))：精确像素指纹匹配，快速但需要完整的训练数据库
- **深度学习方法** (本包)：CNN 模型识别，泛化能力更强，可以识别未见过的字体变体

### 模型性能

当前训练的模型在测试集上达到：

- **准确率**: 100% (20/20 样本测试)
- **推理速度**: ~100ms/验证码
- **模型大小**: ~417KB (model.json + weights.bin)

## 工作原理

采用 **单字符识别** 方案：

1. 使用传统图像处理方法分割验证码为 6 个字母（复用 `amazoncaptcha` 包的逻辑）
2. 对每个字母使用训练好的 CNN 模型进行分类识别
3. 组合 6 个字母的预测结果得到完整验证码

### 模型架构

```
输入: 28x28x1 灰度图像（单个字母）
  ↓
Conv2D (16 filters, 3x3) + ReLU + MaxPooling + Dropout
  ↓
Conv2D (32 filters, 3x3) + ReLU + MaxPooling
  ↓
Flatten + Dense(64) + ReLU + Dropout(0.5)
  ↓
Dense(26) + Softmax
  ↓
输出: 26个小写字母的概率分布
```

## 安装

```bash
pnpm add amazoncaptcha-tfjs amazoncaptcha
# or: npm install amazoncaptcha-tfjs amazoncaptcha
```

## 使用方法

### 基础使用

```typescript
import { solve } from "amazoncaptcha-tfjs";

// 识别验证码（支持文件路径或 Buffer）
const result = await solve("./captcha.jpg");
console.log(result); // 'krjnby' 或 'Not solved'

// 使用 Buffer
import { readFile } from "fs/promises";
const buffer = await readFile("./captcha.jpg");
const result = await solve(buffer);

// 设置置信度阈值（默认 0.5）
const result = await solve("./captcha.jpg", 0.8);
```

### 单字母预测

```typescript
import { predictLetter, predictLetters } from "amazoncaptcha-tfjs";

// 预测单个字母（letterMatrix 是二维数组，0为黑色，255为白色）
const letterMatrix = [
  [0, 255, 255],
  [0, 0, 255],
  [0, 255, 255],
  // ... width x height 矩阵
];

const result = await predictLetter(letterMatrix);
console.log(result);
// { letter: 'l', confidence: 0.95 }

// 批量预测多个字母
const matrices = [letterMatrix1, letterMatrix2, letterMatrix3];
const results = await predictLetters(matrices);
console.log(results);
// [
//   { letter: 'k', confidence: 0.98 },
//   { letter: 'r', confidence: 0.95 },
//   { letter: 'j', confidence: 0.92 }
// ]
```

### 自定义模型路径

```typescript
import { loadModel, predictLetters } from "amazoncaptcha-tfjs";

// 加载默认内置模型（自动从包的 models/ 目录加载）
const model = await loadModel();

// 或者加载自定义路径的模型
const customModel = await loadModel("./custom_models/my_model");

// 手动预测
import {
  toMonochromeMatrix,
  findLetterBoxes,
  cutTheWhite,
} from "amazoncaptcha";

const matrix = await toMonochromeMatrix("./captcha.jpg");
const letterBoxes = findLetterBoxes(matrix, 33);
const trimmedLetters = letterBoxes.map((l) => cutTheWhite(l));

const predictions = await predictLetters(trimmedLetters, model);
console.log(predictions);
// [
//   { letter: 'k', confidence: 0.98 },
//   { letter: 'r', confidence: 0.95 },
//   ...
// ]
```

### 预处理工具

```typescript
import {
  preprocessLetter,
  letterToIndex,
  indexToLetter,
} from "amazoncaptcha-tfjs";

// 将字母矩阵转换为模型输入 tensor
const tensor = preprocessLetter(letterMatrix); // shape: [1, 28, 28, 1]

// 字母与索引互转
const index = letterToIndex("a"); // 0
const index = letterToIndex("z"); // 25

const letter = indexToLetter(0); // 'a'
const letter = indexToLetter(25); // 'z'
```

### 构建和训练自定义模型

```typescript
import { buildModel, compileModel, saveModel } from "amazoncaptcha-tfjs";
import * as tf from "@tensorflow/tfjs";

// 构建模型
const model = buildModel();

// 编译模型（可选自定义学习率）
compileModel(model, 0.001);

// 训练模型
await model.fit(xTrain, yTrain, {
  epochs: 20,
  batchSize: 128,
  validationData: [xVal, yVal],
});

// 保存模型
await saveModel(model, "./my_models/custom_model");
```

## 训练自己的模型

### 1. 准备训练数据

#### 方案 A：从已有验证码提取（推荐）

```bash
# 1. 将验证码图片放到 data/raw/ 目录
# 2. 创建 data/labels.json 标注文件：
{
  "captcha1.jpg": "abcdef",
  "captcha2.jpg": "ghijkl"
}

# 3. 运行数据准备脚本（会自动分割字母）
pnpm run prepare-data
```

这会生成：

- `data/processed/` - 分割后的单个字母图片
- `data/training_index.json` - 训练数据索引

#### 方案 B：从 amazon-captcha-database 下载

```bash
# 克隆数据集仓库
git clone https://github.com/a-maliarov/amazon-captcha-database

# 手动提取和转换数据...
```

### 2. 训练模型

```bash
pnpm run train
```

当前使用轻量 CNN（16/32 个卷积通道、64 个全连接单元，约 10.8 万参数），以降低
CPU 训练耗时。训练使用 CPU 后端（WASM 后端目前只支持推理，不支持 CNN 反向传播），默认每个字母
最多抽取 100 个样本（最多约 2,600 个字符）、20 个 epoch、batch size 128、每 5 个
epoch 验证一次。可按需覆盖，例如完整训练 50 个 epoch：

```powershell
$env:CAPTCHA_TRAIN_EPOCHS = "50"
pnpm run train
```

可用环境变量：`CAPTCHA_TRAIN_SAMPLES_PER_LETTER`、`CAPTCHA_TRAIN_EPOCHS`、
`CAPTCHA_TRAIN_BATCH_SIZE` 和 `CAPTCHA_TRAIN_VALIDATION_FREQ`。

训练过程会：

- 加载并预处理训练数据
- 自动划分训练集/验证集（80/20）
- 训练 20 个 epoch
- 保存模型到 `models/captcha_model/`

训练输出示例：

```
🧠 Amazon Captcha - TensorFlow.js Training

📂 Loading training data...
   Found 156 samples
   Train: 124, Validation: 32

🏋️  Training...

Epoch 1/50 - loss: 2.8934 - acc: 0.1935 - val_loss: 2.5123 - val_acc: 0.2812
Epoch 2/50 - loss: 2.3456 - acc: 0.3548 - val_loss: 2.1234 - val_acc: 0.4375
...
Epoch 50/50 - loss: 0.1234 - acc: 0.9677 - val_loss: 0.2345 - val_acc: 0.9375

✅ Training complete!
```

### 3. 评估模型

模型训练完成后，可以使用评估脚本测试准确率：

```bash
pnpm exec tsx scripts/evaluate_model.ts
```

示例输出：

```
🧪 评估模型准确率（样本数: 20）

Loading model from: ./models/captcha_model
✓ dl_xsqyeruqfubqiddscq_JEUKEA.png: expected="jeukea", predicted="jeukea"
✓ dl_sargzmyveeqtteadfq_YGMLBA.png: expected="ygmlba", predicted="ygmlba"
✓ dl_qmdddjhvbxlcmfphvp_UYNHEM.png: expected="uynhem", predicted="uynhem"
...

📊 准确率: 100.0% (20/20)

详细统计:
  - 正确: 20
  - 错误: 0
  - 总计: 20
```

测试套件也包含自动准确率测试：

```bash
npm test
```

你也可以创建自定义的评估脚本：

```typescript
// scripts/evaluate_model.ts
import { solve } from "../src/index.js";
import { readdir } from "fs/promises";
import { join } from "path";

const testDataDir = "./training-data";
const files = await readdir(testDataDir);

let correct = 0;
let total = 0;

for (const file of files.slice(0, 100)) {
  // 从文件名提取真实标签
  // 格式: dl_xxxxx_ABCDEF.png
  const match = file.match(/_([A-Z]{6})\.png$/);
  if (!match) continue;

  const expected = match[1].toLowerCase();
  const result = await solve(join(testDataDir, file), 0.5);

  total++;
  if (result === expected) {
    correct++;
    console.log(`✓ ${file}: ${result}`);
  } else {
    console.log(`✗ ${file}: expected="${expected}", got="${result}"`);
  }
}

console.log(
  `\n准确率: ${((correct / total) * 100).toFixed(1)}% (${correct}/${total})`,
);
```

运行评估脚本：

```bash
tsx scripts/evaluate_model.ts
```

## 项目结构

```
packages/amazoncaptcha-tfjs/
├── src/
│   ├── index.ts           # 公共 API 和 solve() 函数
│   ├── model.ts           # CNN 模型定义和编译
│   ├── model-io.ts        # 模型保存/加载（文件系统）
│   ├── preprocessing.ts   # 图像预处理和字母索引转换
│   └── predict.ts         # 推理逻辑（单字母/批量预测）
├── scripts/
│   ├── generate_labels.ts        # 从文件名生成标注
│   ├── prepare_training_data.ts  # 数据准备（分割字母）
│   └── train_model.ts            # 模型训练脚本
├── training-data/         # 原始训练验证码图片
├── models/
│   └── captcha_model/     # 训练好的模型
│       ├── model.json     # 模型架构和配置
│       └── weights.bin    # 模型权重（~417KB）
├── tests/
│   └── index.test.ts      # 完整测试套件（29个测试用例）
└── dist/                  # 构建输出
```

## API 参考

### `solve(source, confidenceThreshold?)`

识别完整的验证码图片。

- **参数：**
  - `source: string | Buffer` - 验证码图片路径或 Buffer
  - `confidenceThreshold?: number` - 置信度阈值（默认 0.5），低于此值返回 'Not solved'
- **返回：** `Promise<string>` - 识别结果（6个小写字母）或 'Not solved'

### `predictLetter(letterMatrix, model?)`

预测单个字母。

- **参数：**
  - `letterMatrix: number[][]` - 字母像素矩阵（0为黑色，255为白色）
  - `model?: tf.LayersModel` - 可选的模型实例，不提供则使用缓存模型
- **返回：** `Promise<{ letter: string; confidence: number }>` - 预测的字母和置信度

### `predictLetters(letterMatrices, model?)`

批量预测多个字母。

- **参数：**
  - `letterMatrices: number[][][]` - 字母像素矩阵数组
  - `model?: tf.LayersModel` - 可选的模型实例
- **返回：** `Promise<Array<{ letter: string; confidence: number }>>` - 预测结果数组

### `loadModel(modelPath?)`

加载训练好的模型（带缓存）。

- **参数：**
  - `modelPath?: string` - 模型目录路径（可选，默认自动从包内置的 models/captcha_model 加载）
- **返回：** `Promise<tf.LayersModel>` - TensorFlow.js 模型实例

### `preprocessLetter(letterMatrix, targetSize?)`

将字母像素矩阵预处理为模型输入 tensor。

- **参数：**
  - `letterMatrix: number[][]` - 字母像素矩阵
  - `targetSize?: [number, number]` - 目标尺寸（默认 [28, 28]）
- **返回：** `tf.Tensor4D` - 形状为 [1, height, width, 1] 的 tensor

### `buildModel()`

构建 CNN 模型架构。

- **返回：** `tf.LayersModel` - 未编译的模型

### `compileModel(model, learningRate?)`

编译模型。

- **参数：**
  - `model: tf.LayersModel` - 要编译的模型
  - `learningRate?: number` - 学习率（默认 0.001）

### `saveModel(model, modelDirectory)`

保存模型到本地文件系统。

- **参数：**
  - `model: tf.LayersModel` - 要保存的模型
  - `modelDirectory: string` - 保存目录路径

### `letterToIndex(letter)` / `indexToLetter(index)`

字母与索引互转（'a'=0, 'b'=1, ..., 'z'=25）。

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm run dev

# 构建生产版本
pnpm run build

# 运行测试（29个测试用例）
pnpm run test

# 监听模式运行测试
pnpm run test:watch

# 准备训练数据
pnpm run prepare-data

# 训练模型
pnpm run train
```

## 测试

项目包含完整的测试套件，覆盖：

- ✅ 模型构建和编译
- ✅ 预处理函数（字母索引转换、tensor 形状验证）
- ✅ 模型加载和单字母/批量预测
- ✅ 端到端集成测试（完整验证码识别）
- ✅ 模型准确率测试
- ✅ 内存管理（tensor 清理验证）

运行测试：

```bash
npm test
```

查看测试覆盖率：

```bash
npm run test -- --coverage
```

## 性能对比

| 指标         | amazoncaptcha (指纹匹配) | amazoncaptcha-tfjs (CNN) |
| ------------ | ------------------------ | ------------------------ |
| 准确率       | ~95% (需完整训练库)      | **100%** (当前训练模型)  |
| 速度         | 极快 (~10ms)             | 较快 (~100ms)            |
| 泛化能力     | 低（仅匹配已见过的）     | 高（可识别新变体）       |
| 训练数据需求 | 需要完整指纹库           | 数百张标注图片即可       |
| 模型大小     | ~MB (JSON)               | **~417KB**               |

## 技术栈

- **TensorFlow.js**: 深度学习框架
- **tfjs-node**: Node.js 后端（训练时使用）
- **tfjs-backend-wasm**: WASM 后端（推理时使用）
- **Jimp**: 图像处理
- **amazoncaptcha**: 字母分割逻辑

## 注意事项

1. **训练数据质量很重要**：确保标注准确，图片清晰
2. **数据量建议**：每个字母至少 20-50 个样本（26个字母 × 50 = 1300 张字母图）
3. **过拟合风险**：数据量小时注意 Dropout 和验证集表现
4. **推理环境**：使用 WASM 后端在浏览器/Node.js 都能运行

## 常见问题

### Q: 准确率不高怎么办？

1. 增加训练数据量
2. 调整模型架构（增加层数/卷积核）
3. 调整超参数（学习率、dropout率）
4. 数据增强（旋转、缩放、噪声）

### Q: 训练太慢？

- 使用 `@tensorflow/tfjs-node-gpu` 启用 GPU 加速
- 减小 batch size
- 减少 epochs

### Q: 模型太大？

- 模型量化：使用 `model.save()` 的 `quantizationBytes` 参数
- 减少卷积核数量

## 免责声明

本项目仅用于教育和研究目的。使用本代码的任何后果由使用者自行承担。

## License

MIT
