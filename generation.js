const { setImagePreview, setChatImagePreview, renderJobCount } = require('./ui.js')
function createGenerator({
  app,
  core,
  ui,
  state,
  selection,
  placer,
  generateWithProvider,
  critiqueWithProvider,
  logLine,
  utils,
  seedreamModelId,
  grokModelId,
  nanoBananaModelId
}) {
  function toNumber(value) {
    let parsed = Number(value);
    if (!Number.isFinite(parsed) && value && typeof value === "object") {
      if (Number.isFinite(Number(value._value))) {
        parsed = Number(value._value);
      } else if (Number.isFinite(Number(value.value))) {
        parsed = Number(value.value);
      }
    }
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function createBoundsFromSelection(selectionBounds) {
    return {
      left: toNumber(selectionBounds.left),
      right: toNumber(selectionBounds.right),
      top: toNumber(selectionBounds.top),
      bottom: toNumber(selectionBounds.bottom),
      width: toNumber(selectionBounds.width),
      height: toNumber(selectionBounds.height)
    };
  }

  function createBoundsFromDocument(doc) {
    const width = toNumber(doc.width);
    const height = toNumber(doc.height);
    return {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height
    };
  }

  function isValidBounds(bounds) {
    return bounds &&
      Number.isFinite(bounds.left) &&
      Number.isFinite(bounds.right) &&
      Number.isFinite(bounds.top) &&
      Number.isFinite(bounds.bottom) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width > 0 &&
      bounds.height > 0;
  }

  async function generate() {
    if (ui.testCheckbox && ui.testCheckbox.checked) {
      state.selectedModel = "localtest";
      if (ui.generateButton) {
        ui.generateButton.innerText = "Test";
      }
    }

    const selectionData = app.activeDocument.selection;
    if (!selectionData?.bounds) {
      core.showAlert("No Selection.");
      return;
    }

    const targetModel = state.selectedModel;
    const bounds = createBoundsFromSelection(selectionData.bounds);

    if (state.adaptiveResolutionSetting) {
      const upgradeFactorValue = parseFloat(ui.upgradeFactorSlider?.value);
      state.upgradeFactor = Number.isFinite(upgradeFactorValue) ? upgradeFactorValue : 1.5;
      state.resolution = utils.pickTier(Math.max(bounds.width, bounds.height), {
        upgradeFactor: state.upgradeFactor,
        selectedModel: targetModel,
        seedreamModelId
      });
    }
    if (grokModelId && targetModel === grokModelId) {
      state.resolution = "1K";
    }

    const prompt = ui.promptInput?.value.trim();
    if (prompt === "") {
      core.showAlert("Please input prompt.");
      return;
    }

    console.log("Prompt: " + prompt);
    if (typeof logLine === "function") {
      logLine("-----" + targetModel + "-----");
    }

    if (ui.errorArea) {
      ui.errorArea.innerText = "";
      ui.errorArea.style.display = "none";
    }

    if (ui.generateButton) {
      ui.generateButton.disabled = true;
    }

    const shouldFetchBase64 = !state.textToImage || targetModel === "localtest";
    let base64Data;
    if (shouldFetchBase64) {
      try {
        base64Data = await selection.getImageDataToBase64(bounds);
      } catch (error) {
        if (typeof logLine === "function") {
          logLine("Check log for more detailed error message.");
        }
      } finally {
        if (ui.generateButton) {
          ui.generateButton.disabled = false;
        }
      }

      if (!base64Data || base64Data.length === 0) {
        console.log("No base64 data obtained from selection. Aborting.");
        if (typeof logLine === "function") {
          logLine("No base64 data obtained from selection. Aborting.");
        }
        return;
      }
    } else if (ui.generateButton) {
      ui.generateButton.disabled = false;
    }

    if (!state.textToImage && ui.imageToProcess && base64Data) {
      setImagePreview(ui, base64Data);
      console.log("image base64 length: " + base64Data.length);
    }

    let generatedBase64 = null;
    let elapsedSeconds = null;
    let jobStartMs = null;
    let jobCountIncremented = false;
    try {
      if (typeof logLine === "function") {
        logLine("Fetching " + state.resolution + " image to " + targetModel);
      }

      state.currentJobCount = Math.max(0, (state.currentJobCount || 0) + 1);
      renderJobCount(ui, state.currentJobCount);
      jobCountIncremented = true;

      jobStartMs = Date.now();
      if (targetModel === "localtest") {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await sleep(3000);
        generatedBase64 = base64Data;
      } else {
        const temperatureInput = parseFloat(ui.temperature?.value);
        const topPInput = parseFloat(ui.topP?.value);
        state.temperature = Number.isFinite(temperatureInput) ? temperatureInput : 1.0;
        state.topP = Number.isFinite(topPInput) ? topPInput : 0.90;
        const nsfw = ui.allowNSFW?.checked;

        generatedBase64 = await generateWithProvider(targetModel, {
          prompt,
          base64Image: base64Data,
          resolution: state.resolution,
          aspectRatio: state.aspectRatio,
          referenceImages: state.imageArray,
          textToImage: state.textToImage,
          apiKey: state.apiKey,
          showModelParameters: state.showModelParameters,
          temperature: state.temperature,
          topP: state.topP,
          logLine,
          nsfw
        });
      }
    } catch (error) {
      console.error("Error during remote API call: " + error);
      if (typeof logLine === "function") {
        logLine("Error during remote API call:\n" + error.message);
      }
      return;
    } finally {
      elapsedSeconds = Math.round((Date.now() - jobStartMs) / 1000);
      if (jobCountIncremented) {
        state.currentJobCount = Math.max(0, (state.currentJobCount || 0) - 1);
        renderJobCount(ui, state.currentJobCount);
      }
    }

    try {
      console.log("placing generated image to document, length: ", generatedBase64.length);
      if (typeof logLine === "function") {
        logLine("Placing server generated image to document, length: " + generatedBase64.length);
      }
      await placer.placeToCurrentDocAtSelection(generatedBase64, bounds, targetModel, {
        skipMask: state.skipMask,
        persistGeneratedImages: state.persistGeneratedImages
      });
    } catch (error) {
      console.error("Error placing generated image to document: " + error);
      if (typeof logLine === "function") {
        logLine("Error placing generated image to document: " + error);
      }
    } finally {
      if (elapsedSeconds !== null) {
        const status = generatedBase64 ? "finished" : "failed";
        const message = `Job ${status} after ${elapsedSeconds} seconds - ${targetModel}`;
        console.log(message);
        if (typeof logLine === "function") {
          logLine(message);
        }
      }
    }
  }

  async function critique() {
    const targetModel = state.selectedModel;
    const expectedModel = nanoBananaModelId || "gemini-3-pro-image-preview";
    if (targetModel !== expectedModel) {
      const message = "Chat critique currently supports Nano Banana Pro only.";
      core.showAlert(message);
      if (typeof logLine === "function") {
        logLine(message);
      }
      return;
    }

    const promptValue = ui.chatPromptInput ? ui.chatPromptInput.value : ui.promptInput?.value;
    const prompt = (promptValue || "").trim();
    if (prompt === "") {
      core.showAlert("Please input prompt.");
      return;
    }

    let bounds;
    const selectionData = app.activeDocument.selection;
    if (selectionData?.bounds) {
      bounds = createBoundsFromSelection(selectionData.bounds);
    } else {
      bounds = createBoundsFromDocument(app.activeDocument);
    }

    if (!isValidBounds(bounds)) {
      const message = "Failed to resolve valid bounds from current document.";
      core.showAlert(message);
      if (typeof logLine === "function") {
        logLine(message);
      }
      return;
    }

    let base64Data = "";
    try {
      base64Data = await selection.getImageDataToBase64(bounds);
    } catch (error) {
      if (typeof logLine === "function") {
        logLine("Failed to capture image for critique: " + error.message);
      }
    }

    if (!base64Data) {
      if (typeof logLine === "function") {
        logLine("No base64 data obtained for critique. Aborting.");
      }
      return;
    }

    setChatImagePreview(ui, base64Data);

    if (ui.chatOutput) {
      ui.chatOutput.value = "";
      ui.chatOutput.disabled = true;
    }
    if (ui.critiqueButton) {
      ui.critiqueButton.disabled = true;
    }

    try {
      for await (const textChunk of critiqueWithProvider(targetModel, {
        prompt,
        base64Image: base64Data,
        apiKey: state.apiKey,
        logLine
      })) {
        if (!textChunk || !ui.chatOutput) {
          continue;
        }
        ui.chatOutput.value += textChunk;
        ui.chatOutput.scrollTop = ui.chatOutput.scrollHeight;
      }
    } catch (error) {
      if (typeof logLine === "function") {
        logLine("Error during critique streaming: " + error.message);
      }
      core.showAlert("Critique failed. Check log for details.");
    } finally {
      if (ui.critiqueButton) {
        ui.critiqueButton.disabled = false;
      }
      if (ui.chatOutput) {
        ui.chatOutput.disabled = false;
      }
    }
  }

  return {
    generate,
    critique
  };
}

module.exports = {
  createGenerator
};
