const { getGenerationBackendName } = require("./providers/index.js")
const { setImagePreview, setChatImagePreview, renderJobCount, renderBatchProgress } = require('./ui.js')
const { clampMaxBatchCount, clampBatchCount } = require("./limits")
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
  seedream5ModelId,
  grokModelId,
  nanoBananaModelId,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout
}) {
  let activeGenerateRun = null

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

  function clampMaxWaitingTimeSeconds(value) {
    return Math.min(300, Math.max(1, Number(value) || 120))
  }

  function isAbortError(error) {
    if (!error) return false
    const message = String(error?.message || "").toLowerCase()
    return error?.name === "AbortError" ||
      message.includes("aborted") ||
      message.includes("abort")
  }

  function createAbortError() {
    const error = new Error("Request aborted")
    error.name = "AbortError"
    return error
  }

  function setGenerateButtonIdle() {
    if (!ui.generateButton) {
      return
    }
    ui.generateButton.innerText = ui.testCheckbox?.checked ? "TEST" : "Generate"
    if (ui.generateButton.style) {
      ui.generateButton.style.backgroundColor = ""
    }
  }

  function setGenerateButtonProgress(current, total, runState) {
    if (!ui.generateButton) {
      return
    }
    if (runState?.cancelEnabled) {
      return
    }
    ui.generateButton.innerText = total > 1 ? `Generating ${current}/${total}...` : "Generating..."
    if (ui.generateButton.style) {
      ui.generateButton.style.backgroundColor = ""
    }
  }

  function setGenerateButtonCancel() {
    if (!ui.generateButton) {
      return
    }
    ui.generateButton.innerText = "Cancel"
    if (ui.generateButton.style) {
      ui.generateButton.style.backgroundColor = "#d93025"
    }
    ui.generateButton.disabled = false
  }

  function clearGenerateTimer(runState) {
    if (!runState) {
      return
    }
    if (runState.timeoutId != null && typeof clearTimeoutImpl === "function") {
      clearTimeoutImpl(runState.timeoutId)
    }
    runState.timeoutId = null
  }

  function enableCancelMode(runState) {
    if (!runState || !runState.isRunning || runState.cancelRequested) {
      return
    }
    runState.cancelEnabled = true
    setGenerateButtonCancel()
    if (typeof logLine === "function") {
      logLine(
        `Maximum waiting time reached (${runState.maxWaitingTimeSeconds}s). Click Cancel to abort unfinished requests.`
      )
    }
  }

  function scheduleGenerateTimeout(runState) {
    if (!runState || typeof setTimeoutImpl !== "function") {
      return
    }
    clearGenerateTimer(runState)
    runState.timeoutId = setTimeoutImpl(() => {
      enableCancelMode(runState)
    }, runState.maxWaitingTimeSeconds * 1000)
  }

  function createRunController(runState) {
    if (!runState || typeof AbortController !== "function") {
      return null
    }
    const controller = new AbortController()
    runState.controllers.add(controller)
    if (runState.cancelRequested) {
      try {
        controller.abort()
      } catch {
        // ignore abort errors
      }
    }
    return controller
  }

  function releaseRunController(runState, controller) {
    if (!runState || !controller) {
      return
    }
    runState.controllers.delete(controller)
  }

  function requestCancelGenerateRun(runState) {
    if (!runState || !runState.isRunning || !runState.cancelEnabled || runState.cancelRequested) {
      return
    }

    runState.cancelRequested = true
    const unfinishedControllers = Array.from(runState.controllers)
    unfinishedControllers.forEach(controller => {
      try {
        controller.abort()
      } catch {
        // ignore abort errors during cancellation
      }
    })

    if (ui.generateButton) {
      ui.generateButton.disabled = true
      ui.generateButton.innerText = "Cancelling..."
    }

    if (typeof logLine === "function") {
      logLine(`Cancel requested. Aborted ${unfinishedControllers.length} unfinished request(s).`)
    }
  }

  function handleGenerateClick() {
    if (activeGenerateRun?.isRunning) {
      requestCancelGenerateRun(activeGenerateRun)
      return
    }

    generate().catch(error => {
      if (typeof logLine === "function") {
        logLine("Unexpected generate error: " + (error?.message || String(error)))
      }
    })
  }

  function createFetchLogMessage(targetModel, requestOptions) {
    const resolution = requestOptions?.resolution
    const baseMessage = "Fetching " + resolution + " image to " + targetModel
    if (targetModel === "localtest") {
      return baseMessage
    }

    const backendName = getGenerationBackendName(targetModel, requestOptions)
    return backendName ? `${baseMessage} via ${backendName}` : baseMessage
  }

  function createRunSummaryMessage(total, successCount, elapsedSeconds, targetModel) {
    if (total <= 1) {
      const status = successCount === 1 ? "finished" : "failed"
      return `Job ${status} after ${elapsedSeconds} seconds - ${targetModel}`
    }

    if (successCount === total) {
      return `Batch finished after ${elapsedSeconds} seconds - ${successCount}/${total} succeeded - ${targetModel}`
    }

    if (successCount > 0) {
      return `Batch finished after ${elapsedSeconds} seconds - ${successCount}/${total} succeeded, ${total - successCount} failed - ${targetModel}`
    }

    return `Batch failed after ${elapsedSeconds} seconds - 0/${total} succeeded - ${targetModel}`
  }

  async function generateSingleImage(targetModel, requestOptions, base64Data, signal) {
    if (targetModel === "localtest") {
      if (signal?.aborted) {
        throw createAbortError()
      }
      const sleep = ms => new Promise((resolve, reject) => {
        const timerId = setTimeout(resolve, ms)
        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timerId)
            reject(createAbortError())
          }, { once: true })
        }
      })
      await sleep(3000)
      return base64Data
    }

    return generateWithProvider(targetModel, {
      ...requestOptions,
      base64Image: base64Data,
      signal
    })
  }

  function cloneRequestOptions(requestOptions) {
    return {
      ...requestOptions,
      referenceImages: Array.isArray(requestOptions.referenceImages) ? [...requestOptions.referenceImages] : [],
      apiKey: requestOptions.apiKey ? { ...requestOptions.apiKey } : requestOptions.apiKey
    }
  }

  function createBatchTask(targetModel, requestOptions, base64Data, batchNumber, totalBatchCount, onSettled, runState) {
    const controller = createRunController(runState)
    const signal = controller?.signal

    return Promise.resolve()
      .then(async () => {
        const generatedBase64 = await generateSingleImage(
          targetModel,
          cloneRequestOptions(requestOptions),
          base64Data,
          signal
        )
        if (!generatedBase64 || generatedBase64.length === 0) {
          throw new Error("no image data returned")
        }

        if (typeof logLine === "function") {
          logLine(`Batch ${batchNumber}/${totalBatchCount} finished`)
        }
        return {
          batchNumber,
          generatedBase64
        }
      })
      .catch(error => {
        const cancelled = isAbortError(error)
        const message = cancelled
          ? `Batch ${batchNumber}/${totalBatchCount} canceled`
          : `Batch ${batchNumber}/${totalBatchCount} failed: ${error?.message || String(error)}`
        if (!cancelled) {
          console.error("Error during remote API call: " + error)
        }
        if (typeof logLine === "function") {
          logLine(message)
        }
        throw error
      })
      .finally(() => {
        releaseRunController(runState, controller)
        if (typeof onSettled === "function") {
          onSettled()
        }
      })
  }

  async function generate() {
    if (activeGenerateRun?.isRunning) {
      return
    }

    const selectionData = app.activeDocument.selection
    if (!selectionData?.bounds) {
      core.showAlert("No Selection.")
      return
    }

    const targetModel = ui.testCheckbox?.checked ? "localtest" : state.selectedModel
    const bounds = createBoundsFromSelection(selectionData.bounds)

    if (state.adaptiveResolutionSetting) {
      const upgradeFactorValue = parseFloat(ui.upgradeFactorSlider?.value)
      state.upgradeFactor = Number.isFinite(upgradeFactorValue) ? upgradeFactorValue : 1.5
      state.resolution = utils.pickTier(Math.max(bounds.width, bounds.height), {
        upgradeFactor: state.upgradeFactor,
        selectedModel: targetModel,
        seedreamModelId,
        seedream5ModelId
      })
    }

    const prompt = ui.promptInput?.value.trim()
    if (prompt === "") {
      core.showAlert("Please input prompt.")
      return
    }

    state.maxBatchCount = clampMaxBatchCount(state.maxBatchCount)
    const targetBatchCount = state.enableBatchGeneration === true
      ? clampBatchCount(state.batchCount, state.maxBatchCount)
      : 1
    const shouldFetchBase64 = !state.textToImage || targetModel === "localtest"
    const temperatureInput = parseFloat(ui.temperature?.value)
    const topPInput = parseFloat(ui.topP?.value)
    state.temperature = Number.isFinite(temperatureInput) ? temperatureInput : 1.0
    state.topP = Number.isFinite(topPInput) ? topPInput : 0.90
    state.batchCount = targetBatchCount
    state.maxWaitingTimeSeconds = clampMaxWaitingTimeSeconds(state.maxWaitingTimeSeconds)

    const requestOptions = {
      prompt,
      resolution: state.resolution,
      aspectRatio: state.aspectRatio,
      referenceImages: Array.isArray(state.imageArray) ? [...state.imageArray] : [],
      textToImage: state.textToImage,
      apiKey: { ...state.apiKey },
      showModelParameters: state.showModelParameters,
      temperature: state.temperature,
      topP: state.topP,
      logLine,
      nsfw: ui.allowNSFW?.checked
    }
    const placementOptions = {
      skipMask: state.skipMask,
      persistGeneratedImages: state.persistGeneratedImages,
      enableGeneratedGroupColorLabel: state.enableGeneratedGroupColorLabel,
      generatedGroupColorLabel: state.generatedGroupColorLabel
    }

    console.log("Prompt: " + prompt)
    if (typeof logLine === "function") {
      logLine("-----" + targetModel + "-----")
    }

    if (ui.errorArea) {
      ui.errorArea.innerText = ""
      ui.errorArea.style.display = "none"
    }

    let base64Data = null
    let generatedImages = []
    let jobCountIncremented = false
    const jobStartMs = Date.now()
    const runState = {
      isRunning: true,
      cancelEnabled: false,
      cancelRequested: false,
      timeoutId: null,
      controllers: new Set(),
      maxWaitingTimeSeconds: state.maxWaitingTimeSeconds
    }
    activeGenerateRun = runState

    try {
      if (ui.generateButton) {
        ui.generateButton.disabled = true
      }
      scheduleGenerateTimeout(runState)

      state.currentJobCount = Math.max(0, (state.currentJobCount || 0) + 1)
      if (targetBatchCount > 1) {
        renderBatchProgress(ui, 0, targetBatchCount)
      } else {
        renderJobCount(ui, state.currentJobCount)
      }
      jobCountIncremented = true

      if (shouldFetchBase64) {
        try {
          base64Data = await selection.getImageDataToBase64(bounds)
        } catch (error) {
          if (typeof logLine === "function") {
            logLine("Check log for more detailed error message.")
          }
          return
        }

        if (!base64Data || base64Data.length === 0) {
          console.log("No base64 data obtained from selection. Aborting.")
          if (typeof logLine === "function") {
            logLine("No base64 data obtained from selection. Aborting.")
          }
          return
        }
      }

      if (!requestOptions.textToImage && ui.imageToProcess && base64Data) {
        setImagePreview(ui, base64Data)
        console.log("image base64 length: " + base64Data.length)
      }

      if (targetBatchCount > 1) {
        let completedCount = 0
        setGenerateButtonProgress(0, targetBatchCount, runState)
        renderBatchProgress(ui, 0, targetBatchCount)

        const handleTaskSettled = () => {
          completedCount += 1
          setGenerateButtonProgress(completedCount, targetBatchCount, runState)
          renderBatchProgress(ui, completedCount, targetBatchCount)
        }

        const batchTasks = []
        for (let index = 0; index < targetBatchCount; index += 1) {
          const batchNumber = index + 1
          if (typeof logLine === "function") {
            logLine(`Batch ${batchNumber}/${targetBatchCount} started`)
            logLine(createFetchLogMessage(targetModel, requestOptions))
          }
          batchTasks.push(
            createBatchTask(
              targetModel,
              requestOptions,
              base64Data,
              batchNumber,
              targetBatchCount,
              handleTaskSettled,
              runState
            )
          )
        }

        const settledResults = await Promise.allSettled(batchTasks)
        generatedImages = settledResults
          .filter(result => result.status === "fulfilled" && result.value?.generatedBase64)
          .map(result => result.value.generatedBase64)
      } else {
        setGenerateButtonProgress(1, targetBatchCount, runState)
        if (typeof logLine === "function") {
          logLine("Batch 1/1 started")
          logLine(createFetchLogMessage(targetModel, requestOptions))
        }

        const controller = createRunController(runState)
        try {
          const generatedBase64 = await generateSingleImage(
            targetModel,
            cloneRequestOptions(requestOptions),
            base64Data,
            controller?.signal
          )
          if (!generatedBase64 || generatedBase64.length === 0) {
            const message = "Batch 1/1 failed: no image data returned"
            console.log(message)
            if (typeof logLine === "function") {
              logLine(message)
            }
          } else {
            generatedImages.push(generatedBase64)
            if (typeof logLine === "function") {
              logLine("Batch 1/1 finished")
            }
          }
        } catch (error) {
          const cancelled = isAbortError(error)
          const message = cancelled
            ? "Batch 1/1 canceled"
            : `Batch 1/1 failed: ${error?.message || String(error)}`
          if (!cancelled) {
            console.error("Error during remote API call: " + error)
          }
          if (typeof logLine === "function") {
            logLine(message)
          }
        } finally {
          releaseRunController(runState, controller)
        }
      }

      if (generatedImages.length === 0) {
        return
      }

      if (generatedImages.length > 1) {
        console.log("placing generated image batch to document, count:", generatedImages.length)
        if (typeof logLine === "function") {
          logLine("Placing generated image batch to document, count: " + generatedImages.length)
        }
      } else {
        console.log("placing generated image to document, length: ", generatedImages[0].length)
        if (typeof logLine === "function") {
          logLine("Placing server generated image to document, length: " + generatedImages[0].length)
        }
      }

      if (targetBatchCount > 1 && typeof placer.placeBatchToCurrentDocAtSelection === "function") {
        await placer.placeBatchToCurrentDocAtSelection(generatedImages, bounds, targetModel, placementOptions)
      } else if (generatedImages.length === 1) {
        await placer.placeToCurrentDocAtSelection(generatedImages[0], bounds, targetModel, placementOptions)
      } else if (typeof placer.placeBatchToCurrentDocAtSelection === "function") {
        await placer.placeBatchToCurrentDocAtSelection(generatedImages, bounds, targetModel, placementOptions)
      } else {
        for (const generatedBase64 of generatedImages) {
          await placer.placeToCurrentDocAtSelection(generatedBase64, bounds, targetModel, placementOptions)
        }
      }
    } catch (error) {
      console.error("Error placing generated image to document: " + error)
      if (typeof logLine === "function") {
        logLine("Error placing generated image to document: " + error)
      }
    } finally {
      clearGenerateTimer(runState)
      runState.isRunning = false
      if (activeGenerateRun === runState) {
        activeGenerateRun = null
      }

      const elapsedSeconds = Math.round((Date.now() - jobStartMs) / 1000)
      if (jobCountIncremented) {
        state.currentJobCount = Math.max(0, (state.currentJobCount || 0) - 1)
        renderJobCount(ui, state.currentJobCount)
        renderBatchProgress(ui, 0, 0)
      }
      if (ui.generateButton) {
        ui.generateButton.disabled = false
      }
      setGenerateButtonIdle()

      const message = createRunSummaryMessage(targetBatchCount, generatedImages.length, elapsedSeconds, targetModel)
      console.log(message)
      if (typeof logLine === "function") {
        logLine(message)
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
    handleGenerateClick,
    generate,
    critique
  };
}

module.exports = {
  createGenerator
};
