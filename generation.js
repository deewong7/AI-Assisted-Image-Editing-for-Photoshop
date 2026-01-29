function createGenerator({ app, core, ui, state, selection, placer, generateWithProvider, logLine, utils, seedreamModelId }) {
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
    const bounds = {
      left: selectionData.bounds.left,
      right: selectionData.bounds.right,
      top: selectionData.bounds.top,
      bottom: selectionData.bounds.bottom,
      width: selectionData.bounds.width,
      height: selectionData.bounds.height
    };

    if (state.adaptiveResolutionSetting) {
      const upgradeFactorValue = parseFloat(ui.upgradeFactorSlider?.value);
      state.upgradeFactor = Number.isFinite(upgradeFactorValue) ? upgradeFactorValue : 1.5;
      state.resolution = utils.pickTier(Math.max(bounds.width, bounds.height), {
        upgradeFactor: state.upgradeFactor,
        selectedModel: state.selectedModel,
        seedreamModelId
      });
    }

    const prompt = ui.promptInput?.value.trim();
    if (prompt === "") {
      core.showAlert("Please input prompt.");
      return;
    }

    console.log("Prompt: " + prompt);
    if (typeof logLine === "function") {
      logLine("-----" + state.selectedModel + "-----");
    }

    if (ui.errorArea) {
      ui.errorArea.innerText = "";
      ui.errorArea.style.display = "none";
    }

    if (ui.generateButton) {
      ui.generateButton.disabled = true;
    }

    const shouldFetchBase64 = !state.textToImage || state.selectedModel === "localtest";
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
      ui.imageToProcess.innerHTML = "<image src='data:image/png;base64," + base64Data + "'></image>";
      console.log("image base64 length: " + base64Data.length);
    }

    let generatedBase64 = null;
    try {
      if (typeof logLine === "function") {
        logLine("Fetching " + state.resolution + " image to " + state.selectedModel);
      }
      if (state.selectedModel === "localtest") {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await sleep(3000);
        generatedBase64 = base64Data;
      } else {
        const temperatureInput = parseFloat(ui.temperature?.value);
        const topPInput = parseFloat(ui.topP?.value);
        state.temperature = Number.isFinite(temperatureInput) ? temperatureInput : 1.0;
        state.topP = Number.isFinite(topPInput) ? topPInput : 0.90;

        generatedBase64 = await generateWithProvider(state.selectedModel, {
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
          logLine
        });
      }
    } catch (error) {
      console.error("Error during remote API call: " + error);
      if (typeof logLine === "function") {
        logLine("Error during remote API call:\n" + error.message);
      }
      return;
    }

    try {
      console.log("placing generated image to document, length: ", generatedBase64.length);
      if (typeof logLine === "function") {
        logLine("Placing server generated image to document, length: " + generatedBase64.length);
      }
      await placer.placeToCurrentDocAtSelection(generatedBase64, bounds, targetModel, {
        skipMask: state.skipMask
      });
    } catch (error) {
      console.error("Error placing generated image to document: " + error);
      if (typeof logLine === "function") {
        logLine("Error placing generated image to document: " + error);
      }
    }
  }

  return {
    generate
  };
}

module.exports = {
  createGenerator
};
