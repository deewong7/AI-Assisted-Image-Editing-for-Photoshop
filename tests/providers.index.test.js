const test = require("node:test");
const assert = require("node:assert/strict");
const bytedance = require("../providers/bytedance");
const google = require("../providers/google");
const { providerMap, generateWithProvider } = require("../providers/index");

test.describe("providerMap (index)", () => {
  test("includes supported models", () => {
    for (const model of bytedance.supportedModels) {
      assert.equal(typeof providerMap[model]?.generateImage, "function");
    }
    for (const model of google.supportedModels) {
      assert.equal(typeof providerMap[model]?.generateImage, "function");
    }
  });
});

test.describe("generateWithProvider (index)", () => {
  test("calls provider with modelId", async () => {
    let captured;
    const modelId = "test-model";
    providerMap[modelId] = {
      generateImage: async (options) => {
        captured = options;
        return "ok";
      }
    };

    const result = await generateWithProvider(modelId, { prompt: "hello" });
    assert.equal(result, "ok");
    assert.equal(captured.modelId, modelId);

    delete providerMap[modelId];
  });

  test("throws for unsupported model", async () => {
    await assert.rejects(
      () => generateWithProvider("missing-model", {}),
      /Unsupported model: missing-model/
    );
  });
});
