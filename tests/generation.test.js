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

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

test.describe("createGenerator", () => {
  test("uses Nano Banana 2 for generation requests", async () => {
    let providerCall;
    const logs = [];

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
      state: {
        selectedModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "3:4",
        textToImage: false,
        imageArray: ["ref-a"],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: true,
        apiKey: { "NanoBananaPro-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {}
      },
      generateWithProvider: async (modelId, options) => {
        providerCall = { modelId, options };
        return "generated-b64";
      },
      critiqueWithProvider: async function* () {},
      logLine: (...parts) => {
        logs.push(parts.join(" "));
      },
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    await generator.generate();

    assert.equal(providerCall.modelId, "gemini-3.1-flash-image-preview");
    assert.equal(providerCall.options.resolution, "2K");
    assert.equal(
      logs.some(line => line.includes("Fetching 2K image to gemini-3.1-flash-image-preview via Google AI Studio")),
      true
    );
  });

  test("does not force Grok resolution to 1K", async () => {
    let providerCall;
    const logs = [];

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
        topP: { value: "0.90" }
      },
      state: {
        selectedModel: "grok-imagine-image",
        aspectRatio: "16:9",
        textToImage: true,
        imageArray: [],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: false,
        apiKey: { "xAI-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          throw new Error("should not fetch selection image for text-to-image");
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {}
      },
      generateWithProvider: async (modelId, options) => {
        providerCall = { modelId, options };
        return "generated-b64";
      },
      critiqueWithProvider: async function* () {},
      logLine: (...parts) => {
        logs.push(parts.join(" "));
      },
      utils: {
        pickTier: () => "4K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image"
    });

    await generator.generate();

    assert.equal(providerCall.modelId, "grok-imagine-image");
    assert.equal(providerCall.options.resolution, "2K");
    assert.equal(logs.some(line => line.includes("Fetching 2K image to grok-imagine-image")), true);
    assert.equal(logs.some(line => line.includes("Fetching 2K image to grok-imagine-image via ")), false);
  });

  test("uses 3K adaptive resolution for SeeDream 5", async () => {
    let providerCall;
    let pickTierOptions;

    const generator = createGenerator({
      app: {
        activeDocument: {
          selection: {
            bounds: {
              left: 0,
              right: 4000,
              top: 0,
              bottom: 4000,
              width: 4000,
              height: 4000
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
        imageToProcess: {},
        upgradeFactorSlider: { value: "1.5" }
      },
      state: {
        selectedModel: "doubao-seedream-5-0-260128",
        aspectRatio: "3:4",
        textToImage: false,
        imageArray: [],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: false,
        apiKey: { "SeeDream-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: true,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {}
      },
      generateWithProvider: async (modelId, options) => {
        providerCall = { modelId, options };
        return "generated-b64";
      },
      critiqueWithProvider: async function* () {},
      logLine: () => {},
      utils: {
        pickTier: (longEdge, options) => {
          pickTierOptions = { longEdge, options };
          return "3K";
        }
      },
      seedreamModelId: ["doubao-seedream-4-5-251128", "doubao-seedream-5-0-260128"],
      seedream5ModelId: "doubao-seedream-5-0-260128",
      grokModelId: "grok-imagine-image"
    });

    await generator.generate();

    assert.equal(pickTierOptions.longEdge, 4000);
    assert.equal(pickTierOptions.options.seedream5ModelId, "doubao-seedream-5-0-260128");
    assert.equal(providerCall.modelId, "doubao-seedream-5-0-260128");
    assert.equal(providerCall.options.resolution, "3K");
  });

  test("starts all batch requests before awaiting results and places after all settle", async () => {
    const deferreds = Array.from({ length: 4 }, () => createDeferred());
    const providerCalls = [];
    const batchPlaceCalls = [];
    const logs = [];
    const ui = {
      testCheckbox: { checked: false },
      promptInput: { value: "batch prompt" },
      generateButton: { disabled: false, innerText: "Generate" },
      allowNSFW: { checked: false },
      temperature: { value: "1.0" },
      topP: { value: "0.90" },
      imageToProcess: {},
      jobCount: { style: { display: "none" }, textContent: "" }
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
      ui,
      state: {
        selectedModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "3:4",
        enableBatchGeneration: true,
        batchCount: 4,
        textToImage: false,
        imageArray: ["ref-a"],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: true,
        apiKey: { "NanoBananaPro-api-key": "AQ_KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {
        },
        async placeBatchToCurrentDocAtSelection(images) {
          batchPlaceCalls.push(images);
        }
      },
      generateWithProvider: async (modelId, options) => {
        const callIndex = providerCalls.length;
        providerCalls.push({ modelId, options });
        return deferreds[callIndex].promise;
      },
      critiqueWithProvider: async function* () {},
      logLine: (...parts) => {
        logs.push(parts.join(" "));
      },
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    const runPromise = generator.generate();
    await flushAsyncWork();

    assert.equal(providerCalls.length, 4);
    assert.equal(batchPlaceCalls.length, 0);
    assert.equal(ui.generateButton.innerText, "Generating 0/4...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 0/4");
    assert.equal(
      logs.some(line => line.includes("Fetching 2K image to gemini-3.1-flash-image-preview via Vertex AI")),
      true
    );

    deferreds[2].resolve("generated-b64-3");
    await flushAsyncWork();
    assert.equal(batchPlaceCalls.length, 0);
    assert.equal(ui.generateButton.innerText, "Generating 1/4...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 1/4");

    deferreds[0].resolve("generated-b64-1");
    await flushAsyncWork();
    assert.equal(ui.generateButton.innerText, "Generating 2/4...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 2/4");

    deferreds[3].resolve("generated-b64-4");
    await flushAsyncWork();
    assert.equal(batchPlaceCalls.length, 0);
    assert.equal(ui.generateButton.innerText, "Generating 3/4...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 3/4");

    deferreds[1].resolve("generated-b64-2");
    await runPromise;

    assert.deepEqual(batchPlaceCalls[0], [
      "generated-b64-1",
      "generated-b64-2",
      "generated-b64-3",
      "generated-b64-4"
    ]);
    assert.equal(ui.generateButton.innerText, "Generate");
    assert.equal(ui.jobCount.style.display, "none");
    assert.equal(ui.jobCount.textContent, "");
  });

  test("places successful batch results after all requests settle even when completions are out of order", async () => {
    const deferreds = Array.from({ length: 4 }, () => createDeferred());
    const logs = [];
    const batchPlaceCalls = [];
    let providerCallCount = 0;
    const ui = {
      testCheckbox: { checked: false },
      promptInput: { value: "batch prompt" },
      generateButton: { disabled: false, innerText: "Generate" },
      allowNSFW: { checked: false },
      temperature: { value: "1.0" },
      topP: { value: "0.90" },
      imageToProcess: {},
      jobCount: { style: { display: "none" }, textContent: "" }
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
      ui,
      state: {
        selectedModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "3:4",
        enableBatchGeneration: true,
        batchCount: 4,
        textToImage: false,
        imageArray: [],
        skipMask: false,
        persistGeneratedImages: true,
        showModelParameters: false,
        apiKey: { "NanoBananaPro-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {},
        async placeBatchToCurrentDocAtSelection(images, bounds, suffix, options) {
          batchPlaceCalls.push({ images, bounds, suffix, options });
        }
      },
      generateWithProvider: async () => {
        const callIndex = providerCallCount;
        providerCallCount += 1;
        return deferreds[callIndex].promise;
      },
      critiqueWithProvider: async function* () {},
      logLine: (...parts) => {
        logs.push(parts.join(" "));
      },
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    const runPromise = generator.generate();
    await flushAsyncWork();

    deferreds[2].resolve("generated-b64-3");
    await flushAsyncWork();
    deferreds[1].reject(new Error("provider failed"));
    await flushAsyncWork();
    deferreds[0].resolve("generated-b64-1");
    await flushAsyncWork();
    assert.equal(batchPlaceCalls.length, 0);
    assert.equal(ui.generateButton.innerText, "Generating 3/4...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 3/4");

    deferreds[3].reject(new Error("provider failed"));
    await runPromise;

    assert.equal(batchPlaceCalls.length, 1);
    assert.deepEqual(batchPlaceCalls[0].images, ["generated-b64-1", "generated-b64-3"]);
    assert.equal(batchPlaceCalls[0].suffix, "gemini-3.1-flash-image-preview");
    assert.equal(batchPlaceCalls[0].options.persistGeneratedImages, true);
    assert.equal(logs.some(line => line.includes("Batch 2/4 failed: provider failed")), true);
    assert.equal(logs.some(line => line.includes("2/4 succeeded, 2 failed")), true);
  });

  test("keeps generate disabled until the whole batch completes while progress tracks settled results", async () => {
    const firstCall = createDeferred();
    const secondCall = createDeferred();
    let providerCallCount = 0;
    const ui = {
      testCheckbox: { checked: false },
      promptInput: { value: "batch prompt" },
      generateButton: { disabled: false, innerText: "Generate" },
      allowNSFW: { checked: false },
      temperature: { value: "1.0" },
      topP: { value: "0.90" },
      imageToProcess: {},
      jobCount: { style: { display: "none" }, textContent: "" }
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
      ui,
      state: {
        selectedModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "3:4",
        enableBatchGeneration: true,
        batchCount: 2,
        textToImage: false,
        imageArray: [],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: false,
        apiKey: { "NanoBananaPro-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection() {},
        async placeBatchToCurrentDocAtSelection() {}
      },
      generateWithProvider: async () => {
        providerCallCount += 1;
        if (providerCallCount === 1) {
          return firstCall.promise;
        }
        return secondCall.promise;
      },
      critiqueWithProvider: async function* () {},
      logLine: () => {},
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    const runPromise = generator.generate();
    await flushAsyncWork();

    assert.equal(ui.generateButton.disabled, true);
    assert.equal(providerCallCount, 2);
    assert.equal(ui.generateButton.innerText, "Generating 0/2...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 0/2");

    secondCall.resolve("generated-b64-2");
    await flushAsyncWork();

    assert.equal(ui.generateButton.disabled, true);
    assert.equal(ui.generateButton.innerText, "Generating 1/2...");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 1/2");

    firstCall.resolve("generated-b64-1");
    await runPromise;

    assert.equal(ui.generateButton.disabled, false);
    assert.equal(ui.generateButton.innerText, "Generate");
    assert.equal(ui.jobCount.style.display, "none");
    assert.equal(ui.jobCount.textContent, "");
  });

  test("forces single-request behavior when batch generation is disabled", async () => {
    let providerCallCount = 0;
    const singlePlaceCalls = [];
    const batchPlaceCalls = [];

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
        promptInput: { value: "batch prompt" },
        generateButton: { disabled: false, innerText: "Generate" },
        allowNSFW: { checked: false },
        temperature: { value: "1.0" },
        topP: { value: "0.90" },
        imageToProcess: {},
        jobCount: { style: { display: "none" }, textContent: "" }
      },
      state: {
        selectedModel: "gemini-3.1-flash-image-preview",
        aspectRatio: "3:4",
        enableBatchGeneration: false,
        batchCount: 4,
        textToImage: false,
        imageArray: [],
        skipMask: false,
        persistGeneratedImages: false,
        showModelParameters: false,
        apiKey: { "NanoBananaPro-api-key": "KEY" },
        resolution: "2K",
        adaptiveResolutionSetting: false,
        currentJobCount: 0
      },
      selection: {
        async getImageDataToBase64() {
          return "selection-b64";
        }
      },
      placer: {
        async placeToCurrentDocAtSelection(...args) {
          singlePlaceCalls.push(args);
        },
        async placeBatchToCurrentDocAtSelection(...args) {
          batchPlaceCalls.push(args);
        }
      },
      generateWithProvider: async () => {
        providerCallCount += 1;
        return "generated-b64";
      },
      critiqueWithProvider: async function* () {},
      logLine: () => {},
      utils: {
        pickTier: () => "2K"
      },
      seedreamModelId: ["seedream"],
      grokModelId: "grok-imagine-image",
      nanoBananaModelId: "gemini-3-pro-image-preview"
    });

    await generator.generate();

    assert.equal(providerCallCount, 1);
    assert.equal(singlePlaceCalls.length, 1);
    assert.equal(batchPlaceCalls.length, 0);
  });

  test("keeps the originally selected model when state changes mid-request", async () => {
    const logs = [];
    const placeCalls = [];
    let providerCall = null;
    const pendingSelection = createDeferred();

    const state = {
      selectedModel: "gemini-3-pro-image-preview",
      aspectRatio: "default",
      textToImage: false,
      imageArray: ["ref-a"],
      skipMask: false,
      persistGeneratedImages: true,
      showModelParameters: false,
      apiKey: { "NanoBananaPro-api-key": "AIza_TEST_KEY" },
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

    state.selectedModel = "grok-imagine-image";

    pendingSelection.resolve();
    await runPromise;

    assert.equal(providerCall.modelId, "gemini-3-pro-image-preview");
    assert.equal(placeCalls[0][2], "gemini-3-pro-image-preview");
    assert.equal(placeCalls[0][3].persistGeneratedImages, true);
    assert.equal(logs.some(line => line.includes("Job finished") && line.includes("gemini-3-pro-image-preview")), true);
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

  test("critique rejects Nano Banana 2 before provider call", async () => {
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
        selectedModel: "gemini-3.1-flash-image-preview",
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
