const test = require("node:test");
const assert = require("node:assert/strict");
const { createGenerator } = require("../generation.js");

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test.describe("createGenerator", () => {
  test("keeps the originally selected model when state changes mid-request", async () => {
    const logs = [];
    const placeCalls = [];
    let providerCall = null;
    const pendingSelection = createDeferred();

    const state = {
      selectedModel: "model-a",
      aspectRatio: "default",
      textToImage: false,
      imageArray: ["ref-a"],
      skipMask: false,
      showModelParameters: false,
      apiKey: { key: "a" },
      resolution: "2K",
      adaptiveResolutionSetting: false,
      currentJobCount: 0
    };

    const generator = createGenerator({
      app: {
        activeDocument: {
          selection: {
            bounds: {
              left: 0,
              right: 100,
              top: 0,
              bottom: 100,
              width: 100,
              height: 100
            }
          }
        }
      },
      core: {
        showAlert: () => {}
      },
      ui: {
        testCheckbox: { checked: false },
        promptInput: { value: "test prompt" },
        generateButton: { disabled: false, innerText: "Generate" },
        allowNSFW: { checked: false },
        temperature: { value: "1.0" },
        topP: { value: "0.90" },
        imageToProcess: {}
      },
      state,
      selection: {
        async getImageDataToBase64() {
          await pendingSelection.promise;
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection(...args) {
          placeCalls.push(args);
        }
      },
      generateWithProvider: async (modelId, options) => {
        providerCall = { modelId, options };
        return "generated-b64";
      },
      logLine: (...args) => {
        logs.push(args.join(" "));
      },
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image"
    });

    const runPromise = generator.generate();
    await Promise.resolve();

    state.selectedModel = "model-b";

    pendingSelection.resolve();
    await runPromise;

    assert.equal(providerCall.modelId, "model-a");
    assert.equal(placeCalls[0][2], "model-a");
    assert.equal(logs.some(line => line.includes("Job finished") && line.includes("model-a")), true);
  });

  test("critique uses selection bounds when selection exists", async () => {
    let capturedBounds;
    const ui = {
      chatPromptInput: { value: "critique prompt" },
      promptInput: { value: "critique prompt" },
      chatOutput: { value: "", disabled: false, scrollTop: 0, scrollHeight: 0 },
      critiqueButton: { disabled: false },
      chatImageToProcess: {}
    };

    const generator = createGenerator({
      app: {
        activeDocument: {
          width: 400,
          height: 200,
          selection: {
            bounds: {
              left: 10,
              right: 110,
              top: 20,
              bottom: 120,
              width: 100,
              height: 100
            }
          }
        }
      },
      core: {
        showAlert: () => {}
      },
      ui,
      state: {
        selectedModel: "gemini-3-pro-image-preview",
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64(bounds) {
          capturedBounds = bounds;
          return "selection-b64";
        }
      },
      placer: { async placeToCurrentDocAtSelection() {} },
      generateWithProvider: async () => "generated-b64",
      critiqueWithProvider: async function* () {
        yield "A";
        yield "B";
      },
      logLine: () => {},
      utils: { pickTier: () => "2K" },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    await generator.critique();

    assert.deepEqual(capturedBounds, {
      left: 10,
      right: 110,
      top: 20,
      bottom: 120,
      width: 100,
      height: 100
    });
    assert.equal(ui.chatOutput.value, "AB");
  });

  test("critique uses full document bounds when selection is missing", async () => {
    let capturedBounds;
    const generator = createGenerator({
      app: {
        activeDocument: {
          width: 640,
          height: 480,
          selection: {}
        }
      },
      core: {
        showAlert: () => {}
      },
      ui: {
        chatPromptInput: { value: "critique prompt" },
        promptInput: { value: "critique prompt" },
        chatOutput: { value: "", disabled: false, scrollTop: 0, scrollHeight: 0 },
        critiqueButton: { disabled: false },
        chatImageToProcess: {}
      },
      state: {
        selectedModel: "gemini-3-pro-image-preview",
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64(bounds) {
          capturedBounds = bounds;
          return "doc-b64";
        }
      },
      placer: { async placeToCurrentDocAtSelection() {} },
      generateWithProvider: async () => "generated-b64",
      critiqueWithProvider: async function* () {
        yield "ok";
      },
      logLine: () => {},
      utils: { pickTier: () => "2K" },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    await generator.critique();

    assert.deepEqual(capturedBounds, {
      left: 0,
      top: 0,
      right: 640,
      bottom: 480,
      width: 640,
      height: 480
    });
  });

  test("critique disables output during stream and re-enables after completion", async () => {
    const streamGate = createDeferred();
    const ui = {
      chatPromptInput: { value: "critique prompt" },
      promptInput: { value: "critique prompt" },
      chatOutput: { value: "", disabled: false, scrollTop: 0, scrollHeight: 0 },
      critiqueButton: { disabled: false },
      chatImageToProcess: {}
    };

    const generator = createGenerator({
      app: {
        activeDocument: {
          width: 400,
          height: 200,
          selection: {
            bounds: {
              left: 10,
              right: 110,
              top: 20,
              bottom: 120,
              width: 100,
              height: 100
            }
          }
        }
      },
      core: {
        showAlert: () => {}
      },
      ui,
      state: {
        selectedModel: "gemini-3-pro-image-preview",
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: { async placeToCurrentDocAtSelection() {} },
      generateWithProvider: async () => "generated-b64",
      critiqueWithProvider: async function* () {
        yield "A";
        await streamGate.promise;
        yield "B";
      },
      logLine: () => {},
      utils: { pickTier: () => "2K" },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    const running = generator.critique();
    await Promise.resolve();
    assert.equal(ui.chatOutput.disabled, true);
    assert.equal(ui.critiqueButton.disabled, true);

    streamGate.resolve();
    await running;
    assert.equal(ui.chatOutput.disabled, false);
    assert.equal(ui.critiqueButton.disabled, false);
    assert.equal(ui.chatOutput.value, "AB");
  });

  test("critique rejects unsupported model before provider call", async () => {
    const alerts = [];
    let providerCalled = false;
    const generator = createGenerator({
      app: {
        activeDocument: {
          width: 640,
          height: 480,
          selection: {}
        }
      },
      core: {
        showAlert: (message) => alerts.push(message)
      },
      ui: {
        chatPromptInput: { value: "critique prompt" },
        promptInput: { value: "critique prompt" },
        chatOutput: { value: "", disabled: false, scrollTop: 0, scrollHeight: 0 },
        critiqueButton: { disabled: false },
        chatImageToProcess: {}
      },
      state: {
        selectedModel: "grok-imagine-image",
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: { async placeToCurrentDocAtSelection() {} },
      generateWithProvider: async () => "generated-b64",
      critiqueWithProvider: async function* () {
        providerCalled = true;
        yield "A";
      },
      logLine: () => {},
      utils: { pickTier: () => "2K" },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    await generator.critique();

    assert.equal(providerCalled, false);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /Nano Banana Pro/);
  });
});
