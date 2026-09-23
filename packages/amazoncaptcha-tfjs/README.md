# amazoncaptcha-tfjs

使用 TensorFlow.js 和深度学习识别 Amazon 验证码的 TypeScript 实现。

## 概述

该包提供了一个基于 CNN（卷积神经网络）的验证码识别方案，作为传统像素指纹匹配方法的替代：

- **传统方法** ([amazoncaptcha](../amazoncaptcha))：精确像素指纹匹配，快速但需要完整的训练数据库
- **深度学习方法** (本包)：CNN 模型识别，泛化能力更强，可以识别未见过的字体变体

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

// 识别验证码
const result = await solve("./captcha.jpg");
console.log(result); // 'krjnby' 或 'Not solved'

// 设置置信度阈值
const result = await solve("./captcha.jpg", 0.8);
```

### 自定义模型路径

```typescript
import { loadModel, predictLetters } from "amazoncaptcha-tfjs";

// 加载自定义模型
const model = await loadModel("./custom_models/my_model");

// 手动预测
import { toMonochromeMatrix, findLetterBoxes } from "amazoncaptcha";
const matrix = await toMonochromeMatrix("./captcha.jpg");
const letters = findLetterBoxes(matrix, 33);
const predictions = await predictLetters(letters, model);

console.log(predictions);
// [
//   { letter: 'k', confidence: 0.98 },
//   { letter: 'r', confidence: 0.95 },
//   ...
// ]
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

创建测试脚本：

```typescript
// test_accuracy.ts
import { solve } from "amazoncaptcha-tfjs";
import { loadJson } from "./src/utils";

const testCases = loadJson("data/test_labels.json");

let correct = 0;
for (const [filename, expected] of Object.entries(testCases)) {
  const result = await solve(`data/test/${filename}`);
  if (result === expected) correct++;
}

console.log(`Accuracy: ${(correct / testCases.length) * 100}%`);
```

## 项目结构

```
packages/amazoncaptcha-tfjs/
├── src/
│   ├── index.ts           # 公共 API
│   ├── model.ts           # CNN 模型定义
│   ├── preprocessing.ts   # 图像预处理
│   ├── predict.ts         # 推理逻辑
│   └── utils.ts           # 工具函数
├── scripts/
│   ├── prepare_training_data.ts  # 数据准备
│   ├── train_model.ts            # 训练脚本
│   └── download_training_data.ts # 数据下载助手
├── data/
│   ├── raw/               # 原始验证码图片
│   ├── processed/         # 预处理后的字母图片
│   ├── labels.json        # 标注文件
│   └── training_index.json # 训练索引
├── models/
│   └── captcha_model/     # 训练好的模型
│       ├── model.json
│       └── weights.bin
└── tests/
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 构建
pnpm run build

# 测试
pnpm run test
```

## 性能对比

| 指标 | amazoncaptcha (指纹匹配) | amazoncaptcha-tfjs (CNN) |
|------|-------------------------|-------------------------|
| 准确率 | ~95% (需完整训练库) | ~90-95% (取决于训练数据) |
| 速度 | 极快 (~10ms) | 较快 (~100ms) |
| 泛化能力 | 低（仅匹配已见过的） | 高（可识别新变体） |
| 训练数据需求 | 需要完整指纹库 | 数百张标注图片即可 |
| 模型大小 | ~MB (JSON) | ~1-2MB |

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

## 路线图

- [ ] 端到端识别（直接输入整张验证码）
- [ ] 数据增强支持
- [ ] 预训练模型下载
- [ ] Web Worker 支持
- [ ] 模型量化

## 免责声明

本项目仅用于教育和研究目的。使用本代码的任何后果由使用者自行承担。

## License

MIT
