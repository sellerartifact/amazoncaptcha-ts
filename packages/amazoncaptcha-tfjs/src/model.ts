import * as tf from "@tensorflow/tfjs";

/**
 * 构建单字符识别的 CNN 模型
 * 输入: 28x28x1 的灰度图像（单个字母）
 * 输出: 26 个小写字母的概率分布
 */
export function buildModel() {
  const model = tf.sequential();

  // 第一层卷积: 32 个卷积核, 3x3 感受野
  model.add(
    tf.layers.conv2d({
      inputShape: [28, 28, 1],
      filters: 32,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.25 }));

  // 第二层卷积: 64 个卷积核
  model.add(
    tf.layers.conv2d({
      filters: 64,
      kernelSize: 3,
      activation: "relu",
      padding: "same",
    }),
  );
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  model.add(tf.layers.dropout({ rate: 0.25 }));

  // 全连接层
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 128, activation: "relu" }));
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
