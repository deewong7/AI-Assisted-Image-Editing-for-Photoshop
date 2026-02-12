const test = require("node:test");
const assert = require("node:assert/strict");
const { generateImage } = require("../providers/google.js");

test.describe("generateImage (google)", () => {
  test("returns undefined for short prompt", async (t) => {
    let called = false;
    const originalFetch = global.fetch;
    global.fetch = async () => {
      called = true;
      throw new Error("fetch should not be called");
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({ prompt: "a", base64Image: "BASE" });
    assert.equal(result, undefined);
    assert.equal(called, false);
  });

  test("returns undefined with missing base64Image", async (t) => {
    let called = false;
    const originalFetch = global.fetch;
    global.fetch = async () => {
      called = true;
      throw new Error("fetch should not be called");
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({ prompt: "hello" });
    assert.equal(result, undefined);
    assert.equal(called, false);
  });

  test("uses vertex endpoint when API key starts with AQ", async (t) => {
    const originalFetch = global.fetch;
    let lastCall;
    global.fetch = async (url, options) => {
      lastCall = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { data: "RESULT" } }]
              }
            }
          ]
        })
      };
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({
      prompt: "hello",
      base64Image: "BASE",
      apiKey: { "NanoBananaPro-api-key": "AQ_KEY" },
      resolution: "2K",
      aspectRatio: "3:4",
      referenceImages: ["REF"],
      modelId: "custom-model"
    });

    assert.equal(result, "RESULT");
    assert.ok(lastCall);
    assert.match(lastCall.url, /^https:\/\/aiplatform\.googleapis\.com\/v1\/publishers\/google\/models\/custom-model:generateContent\?key=AQ_KEY$/);

    const body = JSON.parse(lastCall.options.body);
    assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
    assert.equal(body.generationConfig.temperature, 1.0);
    assert.equal(body.generationConfig.topP, 0.9);
    assert.equal(body.generationConfig.imageConfig.imageSize, "2K");
    assert.equal(body.generationConfig.imageConfig.aspectRatio, "3:4");
    assert.equal(body.generationConfig.imageConfig.imageOutputOptions.mimeType, "image/png");
    assert.equal(body.generationConfig.imageConfig.personGeneration, "ALLOW_ALL");
    assert.equal(body.contents[0].parts[0].inlineData.data, "REF");
    assert.equal(body.contents[0].parts[1].inlineData.data, "BASE");
    assert.equal(body.contents[0].parts[2].text, "hello");
    assert.equal(lastCall.options.headers["x-goog-api-key"], undefined);
  });

  test("uses AI Studio endpoint when API key does not start with AQ", async (t) => {
    const originalFetch = global.fetch;
    let lastCall;
    global.fetch = async (url, options) => {
      lastCall = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Generated" }, { inlineData: { data: "RESULT_AI_STUDIO" } }]
              }
            }
          ]
        })
      };
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({
      prompt: "hello",
      base64Image: "BASE",
      apiKey: { "NanoBananaPro-api-key": "AIza_TEST_KEY" },
      resolution: "2K",
      modelId: "custom-model"
    });

    assert.equal(result, "RESULT_AI_STUDIO");
    assert.ok(lastCall);
    assert.equal(
      lastCall.url,
      "https://generativelanguage.googleapis.com/v1beta/models/custom-model:generateContent"
    );
    assert.equal(lastCall.options.headers["x-goog-api-key"], "AIza_TEST_KEY");
    const body = JSON.parse(lastCall.options.body);
    assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
    assert.equal(body.generationConfig.imageConfig.imageSize, "2K");
    assert.equal(body.generationConfig.imageConfig.imageOutputOptions, undefined);
    assert.equal(body.generationConfig.imageConfig.personGeneration, undefined);
  });

  test("throws on non-ok response", async (t) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => "oops"
    });
    t.after(() => {
      global.fetch = originalFetch;
    });

    await assert.rejects(
      () => generateImage({
        prompt: "hello",
        base64Image: "BASE",
        apiKey: { "NanoBananaPro-api-key": "KEY" }
      }),
      /API call failed with status 400 Bad Request/
    );
  });

  test("throws on prompt block", async (t) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        promptFeedback: { blockReasonMessage: "blocked" }
      })
    });
    t.after(() => {
      global.fetch = originalFetch;
    });

    await assert.rejects(
      () => generateImage({
        prompt: "hello",
        base64Image: "BASE",
        apiKey: { "NanoBananaPro-api-key": "KEY" }
      }),
      /Prompt was blocked: blocked/
    );
  });
});
