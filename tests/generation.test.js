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
});
