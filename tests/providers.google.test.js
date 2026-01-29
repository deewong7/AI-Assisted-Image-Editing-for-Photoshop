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

  test("builds request and returns b64", async (t) => {
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
      apiKey: { "NanoBananaPro-api-key": "KEY" },
      resolution: "2K",
      aspectRatio: "3:4",
      referenceImages: ["REF"],
      modelId: "custom-model"
    });

    assert.equal(result, "RESULT");
    assert.ok(lastCall);
    assert.match(lastCall.url, /custom-model:generateContent\?key=KEY$/);

    const body = JSON.parse(lastCall.options.body);
    assert.equal(body.generationConfig.temperature, 1.0);
    assert.equal(body.generationConfig.topP, 0.9);
    assert.equal(body.generationConfig.imageConfig.imageSize, "2K");
    assert.equal(body.generationConfig.imageConfig.aspectRatio, "3:4");
    assert.equal(body.contents[0].parts[0].inlineData.data, "REF");
    assert.equal(body.contents[0].parts[1].inlineData.data, "BASE");
    assert.equal(body.contents[0].parts[2].text, "hello");
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
