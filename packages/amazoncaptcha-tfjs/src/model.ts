import * as tf from "@tensorflow/tfjs";

/**
 * 构建单字符识别的 CNN 模型
 * 输入: 28x28x1 的灰度图像（单个字母）
 * 输出: 26 个小写字母的概率分布
 */
export function buildModel() {
  const model = tf.sequential();

  // 轻量第一层卷积: 16 个卷积核, 3x3 感受野
  model.add(
    tf.layers.conv2d({
      inputShape: [28, 28, 1],
      filters: 16,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.25 }));

  // 轻量第二层卷积: 32 个卷积核
  model.add(
    tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  // 缩小全连接层，显著减少参数量和 CPU 训练时间
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 64, activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.5 }));

  // 输出层: 26 个小写字母分类
  model.add(tf.layers.dense({ units: 26, activation: "softmax" }));

  return model;
}

/**
 * 编译模型
 */
export function compileModel(model: tf.LayersModel, learningRate = 0.001) {
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
}
