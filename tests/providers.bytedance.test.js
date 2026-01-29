const test = require("node:test");
const assert = require("node:assert/strict");
const { generateImage } = require("../providers/bytedance.js");

test.describe("generateImage (bytedance)", () => {
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

  test("builds request and returns b64", async (t) => {
    const originalFetch = global.fetch;
    let lastCall;
    global.fetch = async (url, options) => {
      lastCall = { url, options };
      return {
        ok: true,
        json: async () => ({ data: [{ b64_json: "result" }] })
      };
    };
    t.after(() => {
      global.fetch = originalFetch;
    });

    const result = await generateImage({
      prompt: "hello",
      base64Image: "BASE",
      apiKey: { "SeeDream-api-key": "k" },
      resolution: "1K",
      aspectRatio: "3:4",
      referenceImages: ["REF"],
      modelId: "custom-model"
    });

    assert.equal(result, "result");
    assert.ok(lastCall);
    assert.equal(lastCall.url, "https://ark.cn-beijing.volces.com/api/v3/images/generations");

    const body = JSON.parse(lastCall.options.body);
    assert.equal(body.model, "custom-model");
    assert.equal(body.size, "2K");
    assert.match(body.prompt, /aspect ratio: 3:4/);
    assert.deepEqual(body.image, [
      "data:image/png;base64,REF",
      "data:image/png;base64,BASE"
    ]);
  });

  test("throws on non-ok response", async (t) => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      json: async () => ({ error: { message: "bad request" } })
    });
    t.after(() => {
      global.fetch = originalFetch;
    });

    await assert.rejects(
      () => generateImage({
        prompt: "hello",
        base64Image: "BASE",
        apiKey: { "SeeDream-api-key": "k" }
      }),
      /bad request/
    );
  });
});
