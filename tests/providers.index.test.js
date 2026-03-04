const test = require("node:test");
const assert = require("node:assert/strict");
const bytedance = require("../providers/bytedance.js");
const google = require("../providers/google.js");
const xai = require("../providers/xai.js");
const {
  providerMap,
  generateWithProvider,
  getGenerationBackendName,
  critiqueWithProvider
} = require("../providers/index.js");

test.describe("providerMap (index)", () => {
  test("includes supported models", () => {
    for (const model of bytedance.supportedModels) {
      assert.equal(typeof providerMap[model]?.generateImage, "function");
    }
    for (const model of google.supportedModels) {
      assert.equal(typeof providerMap[model]?.generateImage, "function");
    }
    for (const model of xai.supportedModels) {
      assert.equal(typeof providerMap[model]?.generateImage, "function");
    }
  });

  test("maps Nano Banana 2 to google provider", () => {
    assert.equal(providerMap["gemini-3.1-flash-image-preview"], google);
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

  test("routes Nano Banana 2 through the google provider", async () => {
    const originalGenerate = google.generateImage;
    let captured;
    google.generateImage = async (options) => {
      captured = options;
      return "ok";
    };

    try {
      const result = await generateWithProvider("gemini-3.1-flash-image-preview", { prompt: "hello" });
      assert.equal(result, "ok");
      assert.equal(captured.modelId, "gemini-3.1-flash-image-preview");
    } finally {
      google.generateImage = originalGenerate;
    }
  });
});

test.describe("getGenerationBackendName (index)", () => {
  test("delegates to the google provider for google models", () => {
    const backendName = getGenerationBackendName("gemini-3.1-flash-image-preview", {
      apiKey: { "NanoBananaPro-api-key": "AQ_KEY" }
    });

    assert.equal(backendName, "Vertex AI");
  });

  test("returns undefined when provider does not expose backend metadata", () => {
    const modelId = "test-backendless-model";
    providerMap[modelId] = {
      generateImage: async () => "ok"
    };

    try {
      assert.equal(getGenerationBackendName(modelId, { prompt: "hello" }), undefined);
    } finally {
      delete providerMap[modelId];
    }
  });

  test("throws for unsupported model", () => {
    assert.throws(
      () => getGenerationBackendName("missing-model", {}),
      /Unsupported model: missing-model/
    );
  });
});

test.describe("critiqueWithProvider (index)", () => {
  test("calls provider critique stream with modelId", async () => {
    const modelId = "test-critique-model";
    let captured;
    providerMap[modelId] = {
      critiqueImageStream: async function* (options) {
        captured = options;
        yield "ok";
      }
    };

    const chunks = [];
    for await (const chunk of critiqueWithProvider(modelId, { prompt: "hello" })) {
      chunks.push(chunk);
    }

    assert.deepEqual(chunks, ["ok"]);
    assert.equal(captured.modelId, modelId);
    delete providerMap[modelId];
  });

  test("throws for unsupported critique model", async () => {
    providerMap["no-critique"] = {
      generateImage: async () => "ok"
    };

    assert.throws(
      () => critiqueWithProvider("no-critique", {}),
      /Critique mode is not supported for model: no-critique/
    );

    delete providerMap["no-critique"];
  });
});
