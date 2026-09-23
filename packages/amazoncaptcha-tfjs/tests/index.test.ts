import { expect, test } from "@rstest/core";
import { buildModel } from "../src/index";

test("buildModel", () => {
  const numClasses = 10;
  const inputShape: [number, number, number] = [28, 28, 1];
  const model = buildModel(numClasses, inputShape);
  expect(model).toBeDefined();
  expect(model.layers.length).toBeGreaterThan(0);
});
