const test = require("node:test");
const assert = require("node:assert/strict");
const { generateImage } = require("../providers/xai.js");

test.describe("generateImage (xai)", () => {
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

    const result = await generateImage({ prompt: "a" });
    assert.equal(result, undefined);
    assert.equal(called, false);
  });

  test("returns undefined with missing base64Image for edits", async (t) => {
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

  test("builds generation request and returns b64", async (t) => {
    const originalFetch = global.fetch;
    let lastCall;
    global.fetch = async (url, options) => {
      lastCall = { url, options };
      return {
        ok: true,
        json: async () => ({ data: [{ b64_json: "GEN_RESULT" }] })
      };
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({
      prompt: "hello",
      apiKey: { "xAI-api-key": "KEY" },
      resolution: "1K",
      aspectRatio: "16:9",
      modelId: "custom-model",
      textToImage: true
    });

    assert.equal(result, "GEN_RESULT");
    assert.ok(lastCall);
    assert.equal(lastCall.url, "https://api.x.ai/v1/images/generations");

    const body = JSON.parse(lastCall.options.body);
    assert.equal(body.model, "custom-model");
    assert.equal(body.response_format, "b64_json");
    assert.equal(body.aspect_ratio, "16:9");
    assert.equal(body.resolution, "1k");
    assert.equal(body.image, undefined);
  });

  test("builds edit request and returns b64", async (t) => {
    const originalFetch = global.fetch;
    let lastCall;
    global.fetch = async (url, options) => {
      lastCall = { url, options };
      return {
        ok: true,
        json: async () => ({ data: [{ b64_json: "EDIT_RESULT" }] })
      };
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({
      prompt: "edit it",
      base64Image: "BASE",
      apiKey: { "xAI-api-key": "KEY" },
      resolution: "4K",
      textToImage: false
    });

    assert.equal(result, "EDIT_RESULT");
    assert.ok(lastCall);
    assert.equal(lastCall.url, "https://api.x.ai/v1/images/edits");

    const body = JSON.parse(lastCall.options.body);
    assert.equal(body.response_format, "b64_json");
    assert.equal(body.resolution, "2k");
    assert.notStrictEqual(body.image, { url: 'data:image/png;base64,BASE' });
    assert.equal(body.aspect_ratio, undefined);
  });

  test("throws on non-ok response", async (t) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        code: "Client specified an invalid argument",
        error: "Generated image rejected by content moderation."
      })
    });
    t.after(() => {
      global.fetch = originalFetch;
    });

    await assert.rejects(
      () => generateImage({
        prompt: "hello",
        base64Image: "BASE",
        apiKey: { "xAI-api-key": "KEY" }
      }),
      /Error: Generated image rejected by content moderation./
    );
  });
});
