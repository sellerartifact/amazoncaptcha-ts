import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";

setWasmPaths("node_modules/@tensorflow/tfjs-backend-wasm/dist/");
await tf.setBackend("wasm");
await tf.ready();

export function buildModel(
  numClasses: number,
  inputShape: [number, number, number],
) {
  const model = tf.sequential();

  // 第一层卷积:16 个卷积核,3x3 感受野,提取边缘/笔画等低阶特征
  // padding: 'same' 保持输出尺寸与输入一致,不做边缘裁剪
  model.add(
    tf.layers.conv2d({
      inputShape,
      filters: 16,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  // 最大池化,2x2 窗口下采样,缩小特征图尺寸、增强平移不变性
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // 第二层卷积:通道数翻倍到 32,提取更高阶的组合特征(笔画组合出的字符局部形状)
  model.add(
    tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // 把二维特征图展平成一维向量,送入全连接层做分类
  model.add(tf.layers.flatten());
  // 全连接层,64 个神经元,进一步组合特征
  model.add(tf.layers.dense({ units: 64, activation: "relu" }));
  // Dropout 随机丢弃 30% 神经元,缓解小数据集上的过拟合
  model.add(tf.layers.dropout({ rate: 0.3 }));
  // 输出层:softmax 输出每个类别(字符)的概率分布,units 为字符类别总数
  model.add(tf.layers.dense({ units: numClasses, activation: "softmax" }));

  // 编译模型:Adam 优化器,学习率 1e-3;多分类用交叉熵损失;训练时监控准确率
  model.compile({
    optimizer: tf.train.adam(1e-3),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}
