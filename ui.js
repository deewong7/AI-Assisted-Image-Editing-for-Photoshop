function getUI() {
  return {
    modelPicker: document.getElementById("modelPicker"),
    resolutionPicker: document.getElementById("resolutionPicker"),
    resolutionOption1K: document.getElementById("1K"),
    resolutionOption2K: document.getElementById("2K"),
    resolutionOption3K: document.getElementById("3K"),
    resolutionOption4K: document.getElementById("4K"),
    resolutionPickerArea: document.getElementById("resolutionPickerArea"),
    aspectRatioPicker: document.getElementById("aspectRatioPicker"),
    ratioPicker: document.getElementById("ratioPicker"),
    promptInput: document.getElementById("promptInput"),
    batchCountControl: document.getElementById("batchCountControl"),
    batchCountPicker: document.getElementById("batchCountPicker"),
    jobCount: document.getElementById("jobCount"),
    promptPicker: document.getElementById("promptPicker"),
    promptPresetTextarea: document.getElementById("promptPresetTextarea"),
    newPresetName: document.getElementById("newPresetName"),
    newPresetTextDiv: document.getElementById("newPresetTextDiv"),
    editPromptButton: document.getElementById("editPromptButton"),
    savePromptPreset: document.getElementById("savePromptPreset"),
    deletePromptButton: document.getElementById("deletePromptButton"),
    promptManage: document.getElementById("promptManage"),
    enablePrompt: document.getElementById("enablePrompt"),
    hidePromptPreset: document.getElementById("hidePromptPreset"),
    generateButton: document.getElementById("generate"),
    generateBtnDiv: document.getElementById("generateBtnDiv"),
    errorArea: document.getElementById("error"),
    imageToProcess: document.getElementById("imageToProcess"),
    imagePreview: document.getElementById("imagePreview"),
    clearImageButton: document.getElementById("clear"),
    chatPromptInput: document.getElementById("chatPromptInput"),
    critiqueButton: document.getElementById("critique"),
    chatOutput: document.getElementById("chatOutput"),
    chatImagePreview: document.getElementById("chatImagePreview"),
    chatImageToProcess: document.getElementById("chatImageToProcess"),
    logArea: document.getElementById("log"),
    logAreas: document.getElementsByClassName("logArea"),
    clearLogButton: document.getElementById("clearLog"),
    hideLogCheckbox: document.getElementById("hideLog"),
    nav: document.getElementById("nav"),
    pages: document.querySelectorAll("sp-div[data-page]"),
    menuItems: document.querySelectorAll("sp-action-button[data-page]"),
    loadPrompt: document.getElementById("loadPrompt"),
    testCheckbox: document.getElementById("test"),
    lockParam: document.getElementById("lockParam"),
    temperature: document.getElementById("temperature"),
    topP: document.getElementById("top_p"),
    skipMask: document.getElementById("skipMask"),
    showModelParameter: document.getElementById("showModelParameter"),
    googleModel: document.getElementById("googleModel"),
    allowNSFW: document.getElementById("allowNSFW"),
    previewImageCheckbox: document.getElementById("previewImage"),
    persistGeneratedImages: document.getElementById("persistGeneratedImages"),
    enableBatchGeneration: document.getElementById("enableBatchGeneration"),
    enableCritiquePromptEdit: document.getElementById("enableCritiquePromptEdit"),
    openImageFolderButton: document.getElementById("openImageFolder"),
    adaptiveRatioSetting: document.getElementById("adaptiveRatioSetting"),
    adaptiveResolutionSetting: document.getElementById("adaptiveResolutionSetting"),
    upgradeFactorSlider: document.getElementById("upgradeFactorSlider"),
    apiKeyGoogle: document.getElementById("api-key-google"),
    apiKeyBytedance: document.getElementById("api-key-bytedance"),
    apiKeyXai: document.getElementById("api-key-xai"),
    updateApiKey: document.getElementById("update-api-key"),
    showKey: document.getElementById("showKey"),
    referenceButton: document.getElementById("reference"),
    clearReferenceButton: document.getElementById("clearReference"),
    referenceImageSetting: document.getElementById("referenceImageSetting"),
    enableTextToImage: document.getElementById("enableTextToImage"),
    referenceImage: document.getElementById("referenceImage"),
    refImagePreview: document.getElementById("refImagePreview"),
    refImagePreviewDiv: document.getElementById("refImagePreviewDiv"),
    refCount: document.getElementById("refCount")
  };
}

function syncResolutionSelection(ui, state, resolution) {
  const resolutionOptions = {
    "1K": ui.resolutionOption1K,
    "2K": ui.resolutionOption2K,
    "3K": ui.resolutionOption3K,
    "4K": ui.resolutionOption4K
  };

  state.resolution = resolution;
  if (ui.resolutionPicker) {
    ui.resolutionPicker.value = resolution;
  }

  Object.entries(resolutionOptions).forEach(([value, option]) => {
    if (option) {
      option.selected = value === resolution;
    }
  });
}

function renderModelUI(ui, state, models, logLine) {
  if (typeof state.selectedModel === "undefined") return;

  const isSeedreamModel = state.selectedModel === models.SEEDREAM;
  const isSeedream5Model = state.selectedModel === models.SEEDREAM_5;
  const currentResolution = state.resolution || ui.resolutionPicker?.value || "2K";

  if (ui.resolutionOption1K) {
    ui.resolutionOption1K.style.display = "";
  }
  if (ui.resolutionOption2K) {
    ui.resolutionOption2K.style.display = "";
  }
  if (ui.resolutionOption3K) {
    ui.resolutionOption3K.style.display = "none";
  }
  if (ui.resolutionOption4K) {
    ui.resolutionOption4K.style.display = "";
  }

  if (isSeedreamModel) {
    if (ui.resolutionOption1K) {
      ui.resolutionOption1K.style.display = "none";
    }
    if (ui.resolutionOption3K) {
      ui.resolutionOption3K.style.display = "none";
    }
    if (currentResolution !== "2K" && currentResolution !== "4K") {
      syncResolutionSelection(ui, state, "2K");
    }
  } else if (isSeedream5Model) {
    if (ui.resolutionOption1K) {
      ui.resolutionOption1K.style.display = "none";
    }
    if (ui.resolutionOption3K) {
      ui.resolutionOption3K.style.display = "";
    }
    if (ui.resolutionOption4K) {
      ui.resolutionOption4K.style.display = "none";
      ui.resolutionOption4K.selected = false;
    }
    if (currentResolution !== "2K" && currentResolution !== "3K") {
      syncResolutionSelection(ui, state, "2K");
    }
  } else if (state.selectedModel === models.GROK_IMAGINE) {
    if (ui.resolutionOption4K) {
      ui.resolutionOption4K.style.display = "none";
      ui.resolutionOption4K.selected = false;
    }
    if (currentResolution === "4K" || currentResolution === "3K") {
      syncResolutionSelection(ui, state, ui.resolutionOption2K ? "2K" : "1K");
    }
  } else if (currentResolution === "3K") {
    syncResolutionSelection(ui, state, "2K");
  }

  if (ui.googleModel) {
    ui.googleModel.style.display =
      (state.selectedModel === models.NANOBANANA_PRO ||
        state.selectedModel === models.NANOBANANA_2) && state.showModelParameters ? "" : "none";
  }

  if (state.selectedModel === models.GROK_IMAGINE) {
    if (ui.allowNSFW) {
      ui.allowNSFW.style.display = "";
    }
  } else {
    if (ui.allowNSFW) {
      ui.allowNSFW.style.display = "none";
    }
  }

  if (state.selectedModel !== "localtest" && ui.testCheckbox) {
    ui.testCheckbox.checked = false;
    if (ui.generateButton) {
      ui.generateButton.innerText = "Generate";
      ui.generateButton.style.backgroundColor = "";
    }
  }

  if (typeof logLine === "function") {
    logLine("Update model to:", state.selectedModel, state.resolution);
  }
}

function populatePromptPresets(ui, promptPresets) {
  if (!ui.promptPicker || !promptPresets) return;

  Object.keys(promptPresets).forEach(key => {
    const item = document.createElement("sp-menu-item");
    item.name = key;
    item.textContent = key;
    item.value = promptPresets[key];
    ui.promptPicker.appendChild(item);
  });
}

function setImagePreview(ui, base64) {
  if (!ui.imageToProcess) return;
  ui.imageToProcess.innerHTML = `<image src='data:image/png;base64,${base64}'></image>`;
}

function clearImagePreview(ui) {
  if (!ui.imageToProcess) return;
  ui.imageToProcess.innerHTML = "";
}

function setChatImagePreview(ui, base64) {
  if (!ui.chatImageToProcess) return;
  ui.chatImageToProcess.innerHTML = `<image src='data:image/png;base64,${base64}'></image>`;
}

function clearChatImagePreview(ui) {
  if (!ui.chatImageToProcess) return;
  ui.chatImageToProcess.innerHTML = "";
}

function appendReferencePreview(ui, base64, count) {
  if (!ui.refImagePreview) return;

  const img = document.createElement("img");
  img.src = "data:image/png;base64," + base64;
  img.style.width = "55";
  img.style.height = "55";
  img.style.flex = "0 0 auto";
  ui.refImagePreview.appendChild(img);

  if (ui.refImagePreviewDiv) {
    ui.refImagePreviewDiv.style.display = "";
  }
  if (ui.refCount) {
    ui.refCount.innerText = `Reference Image Preview Count: ${count}`;
  }
}

function clearReferencePreview(ui) {
  if (ui.refImagePreview) {
    ui.refImagePreview.innerHTML = "";
  }
  if (ui.refImagePreviewDiv) {
    ui.refImagePreviewDiv.style.display = "none";
  }
  if (ui.refCount) {
    ui.refCount.innerText = "Reference Image Preview";
  }
}

function renderJobCount(ui, count) {
  if (!ui.jobCount) return;
  if (count >= 1) {
    ui.jobCount.style.display = "";
    ui.jobCount.textContent = `Current Jobs: ${count}`;
  } else {
    ui.jobCount.style.display = "none";
    ui.jobCount.textContent = "";
  }
}

function renderBatchProgress(ui, completed, total) {
  if (!ui.jobCount) return;
  if (!Number.isFinite(total) || total <= 1) {
    ui.jobCount.style.display = "none";
    ui.jobCount.textContent = "";
    return;
  }

  const safeCompleted = Math.min(total, Math.max(0, Number(completed) || 0));
  ui.jobCount.style.display = "";
  ui.jobCount.textContent = `Batch Progress: ${safeCompleted}/${total}`;
}

module.exports = {
  getUI,
  renderModelUI,
  populatePromptPresets,
  setImagePreview,
  clearImagePreview,
  setChatImagePreview,
  clearChatImagePreview,
  appendReferencePreview,
  clearReferencePreview,
  renderJobCount,
  renderBatchProgress
};
