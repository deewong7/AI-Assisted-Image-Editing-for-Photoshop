const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeUI, bindEvents } = require("../events.js");

function createCheckbox(initialChecked = false) {
  const listeners = {};
  return {
    checked: initialChecked,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    click() {
      if (typeof listeners.click === "function") {
        listeners.click({ target: this });
      }
    }
  };
}

function createButton() {
  const listeners = {};
  return {
    disabled: false,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    click() {
      if (typeof listeners.click === "function") {
        return listeners.click({ target: this });
      }
    }
  };
}

function createBatchSlider(initialValue = "1", maxValue = "8") {
  const listeners = {};
  return {
    value: String(initialValue),
    min: "1",
    max: String(maxValue),
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    change(nextValue) {
      this.value = String(nextValue);
      if (typeof listeners.change === "function") {
        listeners.change({ target: this });
      }
    }
  };
}

function createSlider(initialValue = "120", maxValue = "300") {
  const listeners = {};
  return {
    value: String(initialValue),
    min: "1",
    max: String(maxValue),
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    change(nextValue) {
      this.value = String(nextValue);
      if (typeof listeners.change === "function") {
        listeners.change({ target: this });
      }
    }
  };
}

function createPromptPicker() {
  const menuItems = [];
  const picker = {
    value: "",
    options: menuItems,
    selectedOptions: [],
    selectedIndex: -1,
    addEventListener() {},
    appendChild(item) {
      menuItems.push(item);
    },
    querySelectorAll(selector) {
      if (selector === "sp-menu-item") {
        return menuItems;
      }
      return [];
    }
  };

  Object.defineProperty(picker, "innerHTML", {
    get() {
      return "";
    },
    set() {
      menuItems.length = 0;
      picker.value = "";
      picker.selectedOptions = [];
      picker.selectedIndex = -1;
    }
  });

  return picker;
}

function createMenuButton(page, initialStyle = {}) {
  return {
    dataset: { page },
    style: {
      display: initialStyle.display ?? "",
      textDecoration: initialStyle.textDecoration ?? "none"
    }
  };
}

function createBaseArgs(ui, defaultChatPromptText = "DEFAULT CHAT PROMPT") {
  return {
    ui,
    state: {
      apiKey: {},
      promptPresets: {},
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue",
      batchCount: 1
    },
    models: {},
    logger: {
      logLine() {}
    },
    storage: {
      saveApiKeys() {},
      savePromptPresets() {},
      savePluginPrefs() {}
    },
    generator: {
      generate() {},
      critique() {}
    },
    selection: {},
    app: {
      activeDocument: {
        selection: {}
      }
    },
    core: {
      showAlert() {}
    },
    defaultPromptText: "DEFAULT PROMPT",
    defaultChatPromptText
  };
}

test.describe("critique prompt edit preference", () => {
  test("initializeUI locks critique prompt by default and resets it to default text", () => {
    const ui = {
      chatPromptInput: { value: "custom before init", disabled: false },
      enableCritiquePromptEdit: createCheckbox(true)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);

    assert.equal(ui.enableCritiquePromptEdit.checked, false);
    assert.equal(ui.chatPromptInput.disabled, true);
    assert.equal(ui.chatPromptInput.value, "LOCKED DEFAULT PROMPT");
  });

  test("checking enableCritiquePromptEdit enables critique prompt editing", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);
    bindEvents(args);

    ui.chatPromptInput.value = "user custom prompt";
    ui.enableCritiquePromptEdit.checked = true;
    ui.enableCritiquePromptEdit.click();

    assert.equal(ui.chatPromptInput.disabled, false);
    assert.equal(ui.chatPromptInput.value, "user custom prompt");
  });

  test("unchecking enableCritiquePromptEdit disables editing and restores default prompt", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui, "LOCKED DEFAULT PROMPT");

    initializeUI(args);
    bindEvents(args);

    ui.enableCritiquePromptEdit.checked = true;
    ui.enableCritiquePromptEdit.click();
    ui.chatPromptInput.value = "edited prompt";

    ui.enableCritiquePromptEdit.checked = false;
    ui.enableCritiquePromptEdit.click();

    assert.equal(ui.chatPromptInput.disabled, true);
    assert.equal(ui.chatPromptInput.value, "LOCKED DEFAULT PROMPT");
  });
});

test.describe("generated image persistence preference", () => {
  test("initializeUI reflects saved persistGeneratedImages state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      persistGeneratedImages: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.state.persistGeneratedImages = true;

    initializeUI(args);

    assert.equal(ui.persistGeneratedImages.checked, true);
  });

  test("clicking persistGeneratedImages updates state and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      persistGeneratedImages: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.persistGeneratedImages.checked = true;
    ui.persistGeneratedImages.click();

    assert.equal(args.state.persistGeneratedImages, true);
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: true,
      enableBatchGeneration: false,
      showChatTab: true,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    }]);
  });
});

test.describe("batch generation preference", () => {
  test("initializeUI reflects saved enableBatchGeneration state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableBatchGeneration: createCheckbox(false),
      batchCountControl: { style: { display: "none" } },
      batchCountSlider: createBatchSlider("3")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 3;

    initializeUI(args);

    assert.equal(ui.enableBatchGeneration.checked, true);
    assert.equal(ui.batchCountControl.style.display, "");
    assert.equal(ui.batchCountSlider.value, "3");
  });

  test("disabling batch generation hides the control, resets batch count, and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableBatchGeneration: createCheckbox(true),
      batchCountControl: { style: { display: "" } },
      batchCountSlider: createBatchSlider("4")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 4;
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.enableBatchGeneration.checked = false;
    ui.enableBatchGeneration.click();

    assert.equal(args.state.enableBatchGeneration, false);
    assert.equal(args.state.batchCount, 1);
    assert.equal(ui.batchCountControl.style.display, "none");
    assert.equal(ui.batchCountSlider.value, "1");
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    }]);
  });
});

test.describe("max waiting time preference", () => {
  test("initializeUI reflects saved max waiting time setting", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      maxWaitingTimeSlider: createSlider("120")
    };
    const args = createBaseArgs(ui);
    args.state.maxWaitingTimeSeconds = 180;

    initializeUI(args);

    assert.equal(args.state.maxWaitingTimeSeconds, 180);
    assert.equal(ui.maxWaitingTimeSlider.value, "180");
  });

  test("changing max waiting time clamps and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      maxWaitingTimeSlider: createSlider("120")
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.maxWaitingTimeSlider.change("999");

    assert.equal(args.state.maxWaitingTimeSeconds, 300);
    assert.equal(ui.maxWaitingTimeSlider.value, "300");
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      maxWaitingTimeSeconds: 300,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    }]);
  });
});

test.describe("max batch count preference", () => {
  test("initializeUI reflects saved max batch count and clamps batch slider", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      maxBatchCountSlider: createSlider("8", "16"),
      batchCountSlider: createBatchSlider("1", "8")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.maxBatchCount = 6;
    args.state.batchCount = 10;

    initializeUI(args);

    assert.equal(args.state.maxBatchCount, 6);
    assert.equal(ui.maxBatchCountSlider.value, "6");
    assert.equal(args.state.batchCount, 6);
    assert.equal(ui.batchCountSlider.max, "6");
    assert.equal(ui.batchCountSlider.value, "6");
  });

  test("changing max batch count auto-clamps current batch and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      maxBatchCountSlider: createSlider("8", "16"),
      batchCountSlider: createBatchSlider("7", "8")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 7;
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.maxBatchCountSlider.change("3");

    assert.equal(args.state.maxBatchCount, 3);
    assert.equal(args.state.batchCount, 3);
    assert.equal(ui.batchCountSlider.max, "3");
    assert.equal(ui.batchCountSlider.value, "3");
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: false,
      enableBatchGeneration: true,
      showChatTab: true,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 3,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    }]);
  });
});

test.describe("generated batch group color preference", () => {
  test("initializeUI reflects saved group color preferences", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableGeneratedGroupColorLabel: createCheckbox(false),
      generatedGroupColorLabel: createBatchSlider("blue", "16")
    };
    const args = createBaseArgs(ui);
    args.state.enableGeneratedGroupColorLabel = true;
    args.state.generatedGroupColorLabel = "violet";

    initializeUI(args);

    assert.equal(ui.enableGeneratedGroupColorLabel.checked, true);
    assert.equal(ui.generatedGroupColorLabel.value, "violet");
    assert.equal(ui.generatedGroupColorLabel.disabled, false);
  });

  test("changing group color preferences saves state", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableGeneratedGroupColorLabel: createCheckbox(false),
      generatedGroupColorLabel: createBatchSlider("blue", "16")
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.enableGeneratedGroupColorLabel.checked = true;
    ui.enableGeneratedGroupColorLabel.click();
    ui.generatedGroupColorLabel.change("red");

    assert.equal(args.state.enableGeneratedGroupColorLabel, true);
    assert.equal(args.state.generatedGroupColorLabel, "red");
    assert.deepEqual(savedPrefs[savedPrefs.length - 1], {
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: true,
      generatedGroupColorLabel: "red"
    });
  });
});

test.describe("generate button click binding", () => {
  test("prefers generator.handleGenerateClick when available", () => {
    const ui = {
      generateButton: createCheckbox(false),
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    let handleClickCount = 0;
    let generateCount = 0;
    args.generator.handleGenerateClick = () => {
      handleClickCount += 1;
    };
    args.generator.generate = () => {
      generateCount += 1;
    };

    bindEvents(args);
    ui.generateButton.click();

    assert.equal(handleClickCount, 1);
    assert.equal(generateCount, 0);
  });
});

test.describe("chat tab preference", () => {
  test("initializeUI reflects saved showChatTab state and hides chat tab menu item", () => {
    const mainMenu = createMenuButton("main");
    const chatMenu = createMenuButton("chat");
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      showChatTabCheckbox: createCheckbox(true),
      menuItems: [mainMenu, chatMenu],
      pages: [
        { id: "main", hidden: false },
        { id: "chat", hidden: true }
      ]
    };
    const args = createBaseArgs(ui);
    args.state.showChatTab = false;

    initializeUI(args);

    assert.equal(ui.showChatTabCheckbox.checked, false);
    assert.equal(chatMenu.style.display, "none");
  });

  test("disabling showChatTab hides tab, returns to main page, and saves preference", () => {
    const savedPrefs = [];
    const mainMenu = createMenuButton("main");
    const chatMenu = createMenuButton("chat", { textDecoration: "underline" });
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      showChatTabCheckbox: createCheckbox(true),
      menuItems: [mainMenu, chatMenu],
      pages: [
        { id: "main", hidden: true },
        { id: "chat", hidden: false }
      ]
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.showChatTabCheckbox.checked = false;
    ui.showChatTabCheckbox.click();

    assert.equal(args.state.showChatTab, false);
    assert.equal(chatMenu.style.display, "none");
    assert.equal(ui.pages[0].hidden, false);
    assert.equal(ui.pages[1].hidden, true);
    assert.equal(mainMenu.style.textDecoration, "underline");
    assert.equal(chatMenu.style.textDecoration, "none");
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: false,
      maxWaitingTimeSeconds: 120,
      maxBatchCount: 8,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "blue"
    }]);
  });
});

test.describe("open image folder button", () => {
  test("calls openImageFolder and re-enables button on success", async () => {
    const logs = [];
    const ui = {
      openImageFolderButton: createCheckbox(false),
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));

    let called = 0;
    args.openImageFolder = async () => {
      called += 1;
      return "/plugin/data";
    };

    bindEvents(args);

    ui.openImageFolderButton.click();
    await Promise.resolve();

    assert.equal(called, 1);
    assert.equal(ui.openImageFolderButton.disabled, false);
    assert.equal(logs.some(line => line.includes("Opened image folder:")), true);
  });

  test("shows alert and re-enables button when openImageFolder fails", async () => {
    const logs = [];
    const alerts = [];
    const ui = {
      openImageFolderButton: createCheckbox(false),
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));
    args.core.showAlert = (message) => alerts.push(message);
    args.openImageFolder = async () => {
      throw new Error("cannot open");
    };

    bindEvents(args);

    ui.openImageFolderButton.click();
    await Promise.resolve();

    assert.equal(ui.openImageFolderButton.disabled, false);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0], "Failed to open image folder. Check log for details.");
    assert.equal(logs.some(line => line.includes("Failed to open image folder:")), true);
  });
});

test.describe("batch count selection", () => {
  test("changing batch count updates state", () => {
    const logs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableBatchGeneration: createCheckbox(true),
      batchCountControl: { style: { display: "" } },
      batchCountSlider: createBatchSlider("1")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 1;
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));

    bindEvents(args);

    ui.batchCountSlider.change("4");

    assert.equal(args.state.batchCount, 4);
    assert.equal(logs.some(line => line.includes("Update batch count to: 4")), true);
  });

  test("batch count clamps to current max batch count", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableBatchGeneration: createCheckbox(true),
      batchCountControl: { style: { display: "" } },
      batchCountSlider: createBatchSlider("1", "8")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.maxBatchCount = 5;

    initializeUI(args);
    bindEvents(args);

    ui.batchCountSlider.change("16");

    assert.equal(args.state.batchCount, 5);
    assert.equal(ui.batchCountSlider.value, "5");
  });
});

test.describe("prompt library import/export", () => {
  test("export button forwards current prompt presets", async () => {
    const logs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      exportPromptLibraryButton: createButton()
    };
    const args = createBaseArgs(ui);
    args.state.promptPresets = {
      keep: "value"
    };
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));

    let receivedPresets = null;
    args.exportPromptLibrary = async (presets) => {
      receivedPresets = presets;
      return {
        cancelled: false,
        filePath: "/tmp/prompt-library.json"
      };
    };

    bindEvents(args);
    await ui.exportPromptLibraryButton.click();

    assert.deepEqual(receivedPresets, {
      keep: "value"
    });
    assert.equal(ui.exportPromptLibraryButton.disabled, false);
    assert.equal(logs.some(line => line.includes("Exported 1 prompt preset(s).")), true);
    assert.equal(logs.some(line => line.includes("/tmp/prompt-library.json")), true);
  });

  test("import button merges presets with overwrite and persists", async (t) => {
    const logs = [];
    const saved = [];
    const originalDocument = global.document;
    global.document = {
      createElement() {
        return {};
      }
    };
    t.after(() => {
      global.document = originalDocument;
    });

    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      importPromptLibraryButton: createButton(),
      promptPicker: createPromptPicker(),
      promptPresetTextarea: { value: "before" },
      newPresetName: { value: "before" }
    };
    const args = createBaseArgs(ui);
    args.state.promptPresets = {
      existing: "old value",
      keep: "keep value"
    };
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));
    args.storage.savePromptPresets = (_storage, presets) => {
      saved.push({ ...presets });
    };
    args.importPromptLibrary = async () => ({
      cancelled: false,
      filePath: "/tmp/import.json",
      presets: {
        existing: "new value",
        added: "added value"
      }
    });
    global.localStorage = {};

    bindEvents(args);
    await ui.importPromptLibraryButton.click();

    assert.deepEqual(args.state.promptPresets, {
      existing: "new value",
      keep: "keep value",
      added: "added value"
    });
    assert.deepEqual(saved, [{
      existing: "new value",
      keep: "keep value",
      added: "added value"
    }]);
    assert.equal(ui.promptPicker.options.length, 3);
    assert.equal(ui.promptPresetTextarea.value, "");
    assert.equal(ui.newPresetName.value, "");
    assert.equal(ui.importPromptLibraryButton.disabled, false);
    assert.equal(logs.some(line => line.includes("Imported 2 prompt preset(s) (1 overwritten).")), true);
    assert.equal(logs.some(line => line.includes("/tmp/import.json")), true);
  });

  test("import button no-ops when picker is canceled", async () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      importPromptLibraryButton: createButton(),
      promptPicker: createPromptPicker()
    };
    const args = createBaseArgs(ui);
    args.state.promptPresets = { keep: "value" };

    let saveCalls = 0;
    args.storage.savePromptPresets = () => {
      saveCalls += 1;
    };
    args.importPromptLibrary = async () => ({
      cancelled: true
    });

    bindEvents(args);
    await ui.importPromptLibraryButton.click();

    assert.equal(saveCalls, 0);
    assert.deepEqual(args.state.promptPresets, { keep: "value" });
    assert.equal(ui.promptPicker.options.length, 0);
    assert.equal(ui.importPromptLibraryButton.disabled, false);
  });

  test("import button reports errors via alert", async () => {
    const logs = [];
    const alerts = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      importPromptLibraryButton: createButton(),
      promptPicker: createPromptPicker()
    };
    const args = createBaseArgs(ui);
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));
    args.core.showAlert = (message) => alerts.push(message);
    args.importPromptLibrary = async () => {
      throw new Error("Invalid JSON file.");
    };

    bindEvents(args);
    await ui.importPromptLibraryButton.click();

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0], "Failed to import prompt library. Check log for details.");
    assert.equal(logs.some(line => line.includes("Failed to import prompt library: Invalid JSON file.")), true);
    assert.equal(ui.importPromptLibraryButton.disabled, false);
  });
});
