import * as tf from "@tensorflow/tfjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MODEL_FILENAME = "model.json";
const WEIGHTS_FILENAME = "weights.bin";

interface SavedModelJson {
  format: "layers-model";
  generatedBy: string;
  convertedBy: null;
  modelTopology: tf.io.ModelJSON["modelTopology"];
  weightsManifest: Array<{
    paths: string[];
    weights: tf.io.WeightsManifestEntry[];
  }>;
}

/**
 * Save a LayersModel with Node's filesystem APIs.
 *
 * The base `@tensorflow/tfjs` package deliberately has no `file://` IO
 * handler; that handler is supplied only by `@tensorflow/tfjs-node`.
 */
export async function saveModel(
  model: tf.LayersModel,
  modelDirectory: string,
): Promise<void> {
  await mkdir(modelDirectory, { recursive: true });

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      if (!artifacts.modelTopology || !artifacts.weightSpecs || !artifacts.weightData) {
        throw new Error("Model artifacts are incomplete and cannot be saved.");
      }
      const weights = Array.isArray(artifacts.weightData)
        ? Buffer.concat(artifacts.weightData.map((shard) => Buffer.from(shard)))
        : Buffer.from(artifacts.weightData);

      const modelJson: SavedModelJson = {
        format: "layers-model",
        generatedBy: `TensorFlow.js v${tf.version.tfjs}`,
        convertedBy: null,
        modelTopology: artifacts.modelTopology,
        weightsManifest: [
          {
            paths: [WEIGHTS_FILENAME],
            weights: artifacts.weightSpecs,
          },
        ],
      };

      await Promise.all([
        writeFile(join(modelDirectory, MODEL_FILENAME), JSON.stringify(modelJson)),
        writeFile(join(modelDirectory, WEIGHTS_FILENAME), weights),
      ]);

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
          modelTopologyBytes: JSON.stringify(artifacts.modelTopology).length,
          weightSpecsBytes: JSON.stringify(artifacts.weightSpecs).length,
          weightDataBytes: weights.byteLength,
        },
      };
    }),
  );
}

/** Load a model previously written by {@link saveModel}. */
export async function loadModelFromDirectory(
  modelDirectory: string,
): Promise<tf.LayersModel> {
  const modelJson = JSON.parse(
    await readFile(join(modelDirectory, MODEL_FILENAME), "utf-8"),
  ) as SavedModelJson;
  const manifest = modelJson.weightsManifest?.[0];

  if (!modelJson.modelTopology || !manifest || manifest.paths.length !== 1) {
    throw new Error(`Invalid TensorFlow.js model in: ${modelDirectory}`);
  }

  const weights = await readFile(join(modelDirectory, manifest.paths[0]));
  const weightData = weights.buffer.slice(
    weights.byteOffset,
    weights.byteOffset + weights.byteLength,
  ) as ArrayBuffer;

  return tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology,
      weightSpecs: manifest.weights,
      weightData,
    }),
  );
}
