# 快速开始指南

## 🚀 快速上手

### 1. 初始化项目

```bash
cd packages/amazoncaptcha-tfjs
pnpm install
```

### 2. 准备训练数据

#### 第一次使用（使用测试图片）

```bash
# 将测试验证码复制到训练数据目录
node -e "
const fs = require('fs');
const path = require('path');
const srcDir = path.join(__dirname, '../amazoncaptcha/tests/captchas');
const destDir = path.join(__dirname, 'data/raw');
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(
  path.join(srcDir, 'notcorrupted.jpg'),
  path.join(destDir, 'notcorrupted.jpg')
);
console.log('✓ Copied test captcha');
"

# 创建标签文件
echo '{"notcorrupted.jpg":"krjnby"}' > data/labels.json

# 运行数据准备脚本（分割字母）
pnpm run prepare-data
```

这会生成：
- `data/processed/notcorrupted_0_k.png` - 第1个字母 'k'
- `data/processed/notcorrupted_1_r.png` - 第2个字母 'r'
- ... 等等

#### 添加更多训练数据

1. 收集更多验证码图片，放到 `data/raw/`
2. 在 `data/labels.json` 中添加标签
3. 重新运行 `pnpm run prepare-data`

**重要**：需要至少 **100-200 张验证码**（约 600-1200 个字母样本）才能训练出合理的模型。

### 3. 训练模型

```bash
pnpm run train
```

训练过程：
- 自动划分 80% 训练集 / 20% 验证集
- 训练 50 个 epoch（约 5-10 分钟，取决于数据量）
- 模型保存到 `models/captcha_model/`

### 4. 使用模型

```typescript
import { solve } from "amazoncaptcha-tfjs";

const result = await solve("path/to/captcha.jpg");
console.log(result); // 'krjnby' 或 'Not solved'
```

## 📊 数据准备详解

### 数据格式要求

#### data/labels.json
```json
{
  "captcha1.jpg": "abcdef",
  "captcha2.jpg": "ghijkl",
  "captcha3.jpg": "mnopqr"
}
```

- Key: 验证码图片文件名（必须在 `data/raw/` 目录下）
- Value: 验证码的正确答案（6个小写字母）

### 数据收集建议

1. **多样性很重要**：
   - 收集不同时间段的验证码
   - 包含各种字母组合
   - 包含粘连字母的样本

2. **标注准确性**：
   - 仔细核对每个验证码的标签
   - 错误的标签会严重影响模型准确率

3. **数据量建议**：
   - 最少：50 张验证码（300 个字母）
   - 推荐：200 张验证码（1200 个字母）
   - 理想：500+ 张验证码（3000+ 个字母）

## 🔧 故障排除

### 问题：准备数据时分割失败

```
⚠️  Expected 6 letters, got 7. Skipping.
```

**原因**：验证码图片质量问题或边缘裁剪
**解决**：跳过这张图片，或手动调整 `MAXIMUM_LETTER_LENGTH` 参数

### 问题：训练时内存不足

```
Error: Out of memory
```

**解决**：
1. 减小 `batchSize`（在 `scripts/train_model.ts` 中）
2. 减少训练数据量
3. 使用更少的 epochs

### 问题：训练速度太慢

**当前设置**：使用 WASM 后端（纯 JavaScript）

**加速方案**：
1. 在 Linux/Mac 上安装 `@tensorflow/tfjs-node`
2. 或使用 GPU 版本：`@tensorflow/tfjs-node-gpu`
3. 或用 Python + TensorFlow 训练后转换

### 问题：准确率太低

**可能原因**：
1. 训练数据太少
2. 训练数据标注错误
3. 模型欠拟合

**解决**：
1. 增加训练数据量
2. 检查 `data/training_index.json` 中的标签
3. 增加训练 epochs
4. 调整模型架构

## 📁 目录结构说明

```
packages/amazoncaptcha-tfjs/
├── data/
│   ├── raw/                    # 原始验证码图片（你需要添加）
│   │   ├── captcha1.jpg
│   │   ├── captcha2.jpg
│   │   └── ...
│   ├── labels.json             # 标签文件（你需要创建）
│   ├── processed/              # 自动生成：分割后的字母
│   │   ├── captcha1_0_a.png
│   │   ├── captcha1_1_b.png
│   │   └── ...
│   └── training_index.json     # 自动生成：训练索引
├── models/
│   └── captcha_model/          # 自动生成：训练好的模型
│       ├── model.json
│       └── weights.bin
├── scripts/
│   ├── prepare_training_data.ts    # 数据准备脚本
│   └── train_model.ts              # 训练脚本
└── src/                        # 源代码
```

## 🎯 下一步

1. **收集数据**：使用 `scripts/download_training_data.ts` 了解数据收集方法
2. **准备数据**：`pnpm run prepare-data`
3. **训练模型**：`pnpm run train`
4. **测试模型**：创建测试脚本验证准确率
5. **集成使用**：在你的项目中使用 `solve()` 函数

## 💡 提示

- 第一次训练可以先用少量数据（10-20张）快速测试流程
- 训练完成后查看 `val_acc`（验证集准确率）判断模型质量
- 如果 `val_acc` > 0.9，说明模型效果不错
- 保存好训练数据和模型，方便后续迭代
