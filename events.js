const {
  renderModelUI,
  populatePromptPresets,
  clearImagePreview,
  appendReferencePreview,
  clearReferencePreview
} = require("./ui");

const KEY_MAP = [
  { fieldKey: "apiKeyGoogle", keyName: "NanoBananaPro-api-key" },
  { fieldKey: "apiKeyBytedance", keyName: "SeeDream-api-key" },
  { fieldKey: "apiKeyXai", keyName: "xAI-api-key" }
];

function updateApiKey(ui, state, storage, update = true) {
  let changed = false;

  for (const { fieldKey, keyName } of KEY_MAP) {
    const el = ui[fieldKey];
    if (!el) continue;

    if (!update) {
      if (typeof state.apiKey[keyName] === "string" && state.apiKey[keyName].length > 0) {
        el.valid = true;
      }
      continue;
    }

    const value = el.value?.trim();
    if (!value) continue;

    state.apiKey[keyName] = value;
    el.value = "";
    el.valid = true;
    changed = true;
  }

  if (update && changed) {
    storage.saveApiKeys(localStorage, state.apiKey);
  }
}

function initializeUI({ ui, state, models, logger, storage }) {
  updateApiKey(ui, state, storage, false);
  populatePromptPresets(ui, state.promptPresets);
  renderModelUI(ui, state, models, logger.logLine);
}

function bindEvents({
  ui,
  state,
  models,
  logger,
  storage,
  generator,
  selection,
  app,
  core,
  defaultPromptText
}) {
  const logLine = logger.logLine;

  if (ui.promptInput) {
    ui.promptInput.addEventListener("input", () => {
      if (ui.promptPicker?.selectedOptions?.length) {
        const menuItems = ui.promptPicker.querySelectorAll("sp-menu-item");
        menuItems.forEach(item => item.removeAttribute("selected"));
      }
    });
  }

  if (ui.resolutionPicker) {
    ui.resolutionPicker.addEventListener("change", (e) => {
      state.resolution = e.target.value;
      console.log("Update resolution to:", state.resolution);
      logLine("Update resolution to:", state.resolution);
    });
  }

  if (ui.aspectRatioPicker) {
    ui.aspectRatioPicker.addEventListener("change", (e) => {
      state.aspectRatio = e.target.value;
      console.log("Update aspect ratio to:", state.aspectRatio);
      logLine("Update aspect ratio to:", state.aspectRatio);
    });
  }

  if (ui.nav) {
    ui.nav.addEventListener("click", e => {
      const btn = e.target.closest("sp-action-button");
      if (!btn) return;

      ui.pages.forEach(p => {
        p.hidden = p.id !== btn.dataset.page;
      });

      ui.menuItems.forEach(m => {
        m.style.textDecoration = m === btn ? "underline" : "none";
      });
    });
  }

  if (ui.loadPrompt) {
    ui.loadPrompt.addEventListener("click", () => {
      if (ui.promptInput) {
        ui.promptInput.value = defaultPromptText;
      }
    });
  }

  if (ui.skipMask) {
    ui.skipMask.addEventListener("click", e => {
      state.skipMask = e.target.checked;
    });
  }

  if (ui.generateButton) {
    ui.generateButton.addEventListener("click", generator.generate);
  }

  if (ui.clearImageButton) {
    ui.clearImageButton.addEventListener("click", () => {
      clearImagePreview(ui);
    });
  }

  if (ui.testCheckbox) {
    ui.testCheckbox.addEventListener("click", (e) => {
      if (e.target.checked) {
        state.selectedModel = "localtest";
        if (ui.generateButton) {
          ui.generateButton.innerText = "TEST";
          ui.generateButton.style.backgroundColor = "#f26c4f";
        }
        if (ui.promptInput) {
          ui.promptInput.value = "TEST";
        }
      } else {
        state.selectedModel = ui.modelPicker?.value;
        if (ui.generateButton) {
          ui.generateButton.innerText = "Generate";
          ui.generateButton.style.backgroundColor = "";
        }
        if (ui.promptInput) {
          ui.promptInput.value = "";
        }
      }
      renderModelUI(ui, state, models, logLine);
    });
  }

  if (ui.lockParam) {
    ui.lockParam.addEventListener("click", (e) => {
      if (ui.temperature) {
        ui.temperature.disabled = e.target.checked;
      }
      if (ui.topP) {
        ui.topP.disabled = e.target.checked;
      }
    });
  }

  if (ui.clearLogButton) {
    ui.clearLogButton.addEventListener("click", () => {
      logger.clearLog();
    });
  }

  if (ui.hideLogCheckbox) {
    ui.hideLogCheckbox.addEventListener("click", (e) => {
      logger.toggleLog(e.target.checked);
    });
  }

  if (ui.updateApiKey) {
    ui.updateApiKey.addEventListener("click", () => {
      updateApiKey(ui, state, storage, true);
    });
  }

  if (ui.showKey) {
    ui.showKey.addEventListener("click", (e) => {
      for (const { fieldKey, keyName } of KEY_MAP) {
        const inputField = ui[fieldKey];
        if (!inputField) continue;
        inputField.value = e.target.checked ? state.apiKey[keyName] : "";
      }
    });
  }

  if (ui.modelPicker) {
    ui.modelPicker.addEventListener("change", (e) => {
      state.selectedModel = e.target.value;
      renderModelUI(ui, state, models, logLine);
    });
  }

  if (ui.referenceButton) {
    ui.referenceButton.addEventListener("click", async () => {
      try {
        const selectionData = app.activeDocument.selection;
        if (!selectionData?.bounds) {
          core.showAlert("No Selection.");
          return;
        }
        const imageBase64 = await selection.getImageDataToBase64(selectionData.bounds);
        state.imageArray.push(imageBase64);
        appendReferencePreview(ui, imageBase64, state.imageArray.length);
      } catch (error) {
        console.error("Failed to add reference image:", error);
      }
    });
  }

  if (ui.clearReferenceButton) {
    ui.clearReferenceButton.addEventListener("click", () => {
      state.imageArray = [];
      clearReferencePreview(ui);
    });
  }

  if (ui.referenceImageSetting) {
    ui.referenceImageSetting.addEventListener("click", (e) => {
      if (ui.referenceImage) {
        ui.referenceImage.style.display = e.target.checked ? "" : "none";
      }
      if (!e.target.checked) {
        state.imageArray = [];
        clearReferencePreview(ui);
      }
    });
  }

  if (ui.enableTextToImage) {
    ui.enableTextToImage.addEventListener("click", (e) => {
      state.textToImage = e.target.checked;
      if (state.textToImage) {
        clearImagePreview(ui);
      }
    });
  }

  if (ui.adaptiveRatioSetting) {
    ui.adaptiveRatioSetting.addEventListener("click", (e) => {
      if (ui.ratioPicker) {
        ui.ratioPicker.style.display = e.target.checked ? "" : "none";
        if (ui.ratioPicker.style.display === "none") {
          state.aspectRatio = "default";
          ui.ratioPicker.value = "default";
          ui.ratioPicker.selectedIndex = 0;
        }
      }
    });
  }

  if (ui.showModelParameter) {
    ui.showModelParameter.addEventListener("click", (e) => {
      state.showModelParameters = e.target.checked;
      renderModelUI(ui, state, models, logLine);
    });
  }

  if (ui.adaptiveResolutionSetting) {
    ui.adaptiveResolutionSetting.addEventListener("click", (e) => {
      if (ui.resolutionPickerArea) {
        ui.resolutionPickerArea.style.display = e.target.checked ? "" : "none";
      }

      state.adaptiveResolutionSetting = !e.target.checked;
      if (ui.upgradeFactorSlider) {
        ui.upgradeFactorSlider.disabled = e.target.checked;
      }

      if (e.target.checked && ui.resolutionPicker) {
        state.resolution = ui.resolutionPicker.value;
      }
    });
  }

  if (ui.previewImageCheckbox) {
    ui.previewImageCheckbox.addEventListener("click", (e) => {
      if (ui.imagePreview) {
        ui.imagePreview.style.display = e.target.checked ? "" : "none";
      }
    });
  }

  if (ui.promptPicker) {
    ui.promptPicker.addEventListener("change", (e) => {
      const selected = e.target.value;
      if (selected) {
        if (ui.promptPresetTextarea) {
          ui.promptPresetTextarea.value = selected;
        }
        if (ui.newPresetName) {
          ui.newPresetName.value = e.target.selectedOptions[0]?.name;
        }
      }

      if (ui.promptInput && ui.promptPresetTextarea) {
        ui.promptInput.value = ui.promptPresetTextarea.value;
      }
    });
  }

  if (ui.editPromptButton) {
    ui.editPromptButton.addEventListener("click", () => {
      if (ui.newPresetTextDiv) {
        ui.newPresetTextDiv.style.display = ui.newPresetTextDiv.style.display === "none" ? "" : "none";
      }

      if (ui.enablePrompt?.checked) {
        if (ui.promptInput) {
          ui.promptInput.style.display = ui.promptInput.style.display === "" ? "none" : "";
        }
        if (ui.generateButton) {
          ui.generateButton.style.display = ui.generateButton.style.display === "" ? "none" : "";
        }
      }
    });
  }

  if (ui.savePromptPreset) {
    ui.savePromptPreset.addEventListener("click", () => {
      const pickerMenu = ui.promptPicker;
      const textarea = ui.promptPresetTextarea;
      const textfield = ui.newPresetName;

      const key = textfield.value.trim() || pickerMenu.selectedOptions[0]?.name;
      const value = textarea.value;
      if (!value) {
        core.showAlert("Please input preset value.");
        return;
      }
      if (!textfield.value.trim()) {
        core.showAlert("Please input preset name.");
        return;
      }

      state.promptPresets[key] = value;
      storage.savePromptPresets(localStorage, state.promptPresets);

      let exists = false;
      const items = pickerMenu.querySelectorAll("sp-menu-item");
      items.forEach(item => {
        if (item.textContent === key) {
          exists = true;
          item.value = value;
          pickerMenu.value = value;
          pickerMenu.selectedIndex = pickerMenu.options.length - 1;
          item.selected = true;
        }
      });
      if (!exists) {
        const item = document.createElement("sp-menu-item");
        item.name = key;
        item.textContent = key;
        item.value = value;
        pickerMenu.appendChild(item);
        pickerMenu.value = value;
        pickerMenu.selectedIndex = pickerMenu.options.length - 1;
        item.selected = true;
      }

      if (ui.promptInput) {
        ui.promptInput.value = textarea.value;
      }
    });
  }

  if (ui.deletePromptButton) {
    ui.deletePromptButton.addEventListener("click", () => {
      const pickerMenu = ui.promptPicker;
      const textarea = ui.promptPresetTextarea;

      const value = pickerMenu.value;
      const presetKeyToDelete = pickerMenu?.selectedOptions?.[0]?.name;

      if (presetKeyToDelete && state.promptPresets[presetKeyToDelete]) {
        delete state.promptPresets[presetKeyToDelete];
        storage.savePromptPresets(localStorage, state.promptPresets);
      }

      const items = pickerMenu.querySelectorAll("sp-menu-item");
      items.forEach(item => {
        if (item.textContent === presetKeyToDelete) {
          item.remove();
        }
      });

      if (textarea.value === value) {
        textarea.value = "";
      }

      if (ui.newPresetName) {
        ui.newPresetName.value = "";
      }
      if (ui.promptInput && value === ui.promptInput.value) {
        ui.promptInput.value = "";
      }
    });
  }

  if (ui.enablePrompt) {
    ui.enablePrompt.addEventListener("click", (e) => {
      if (ui.promptInput) {
        ui.promptInput.style.display = e.target.checked ? "" : "none";
      }
    });
  }

  if (ui.hidePromptPreset) {
    ui.hidePromptPreset.addEventListener("click", (e) => {
      if (ui.promptManage) {
        ui.promptManage.style.display = e.target.checked ? "none" : "";
      }
    });
  }
}

module.exports = {
  initializeUI,
  bindEvents
};
