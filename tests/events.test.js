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

function createTextField(initialValue = "") {
  const listeners = {};
  return {
    value: initialValue,
    valid: false,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    input(nextValue) {
      this.value = nextValue;
      if (typeof listeners.input === "function") {
        listeners.input({ target: this });
      }
    },
    change(nextValue) {
      if (nextValue !== undefined) {
        this.value = nextValue;
      }
      if (typeof listeners.change === "function") {
        listeners.change({ target: this });
      }
    }
  };
}

function createApiKeyUi() {
  return {
    chatPromptInput: { value: "", disabled: false },
    enableCritiquePromptEdit: createCheckbox(false),
    apiKeyGoogleAiStudio: createTextField(),
    apiKeyGoogleVertexAi: createTextField(),
    apiKeyBytedance: createTextField(),
    apiKeyXai: createTextField(),
    updateApiKey: createButton(),
    showKey: createCheckbox(false)
  };
}

function createMenuItem(value, selected = false) {
  const attrs = {};
  if (selected) {
    attrs.selected = "";
  }
  return {
    value,
    selected,
    setAttribute(name, attrValue) {
      attrs[name] = attrValue;
      if (name === "selected") {
        this.selected = true;
      }
    },
    removeAttribute(name) {
      delete attrs[name];
      if (name === "selected") {
        this.selected = false;
      }
    }
  };
}

function createGoogleBackendPicker(initialValue = "google-ai-studio") {
  const listeners = {};
  const items = [
    createMenuItem("google-ai-studio", initialValue === "google-ai-studio"),
    createMenuItem("vertex-ai", initialValue === "vertex-ai")
  ];
  return {
    value: initialValue,
    items,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    querySelectorAll(selector) {
      return selector === "sp-menu-item" ? items : [];
    },
    change(nextValue) {
      this.value = String(nextValue);
      if (typeof listeners.change === "function") {
        listeners.change({ target: this });
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

function createSavedPrefs(overrides = {}) {
  return {
    persistGeneratedImages: false,
    enableBatchGeneration: false,
    showChatTab: true,
    googleApiBackend: "google-ai-studio",
    maxWaitingTimeSeconds: 120,
    maxBatchCount: 8,
    enableGeneratedGroupColorLabel: false,
    generatedGroupColorLabel: "blue",
    enableDeferredBatchRecovery: false,
    allow4KGeneration: false,
    ...overrides
  };
}

function createBaseArgs(ui, defaultChatPromptText = "DEFAULT CHAT PROMPT") {
  return {
    ui,
    state: {
      apiKey: {},
      promptPresets: {},
      ...createSavedPrefs(),
      batchCount: 1,
      pendingBatchPlacements: []
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
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      persistGeneratedImages: true
    })]);
  });
});

test.describe("allow 4K generation preference", () => {
  test("initializeUI reflects saved allow4KGeneration state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      allow4KGeneration: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.state.allow4KGeneration = true;

    initializeUI(args);

    assert.equal(ui.allow4KGeneration.checked, true);
  });

  test("clicking allow4KGeneration updates state and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      allow4KGeneration: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.allow4KGeneration.checked = true;
    ui.allow4KGeneration.click();

    assert.equal(args.state.allow4KGeneration, true);
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      allow4KGeneration: true
    })]);
  });
});

test.describe("deferred batch recovery preference", () => {
  test("initializeUI reflects saved enableDeferredBatchRecovery state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableDeferredBatchRecovery: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.state.enableDeferredBatchRecovery = true;

    initializeUI(args);

    assert.equal(ui.enableDeferredBatchRecovery.checked, true);
  });

  test("clicking enableDeferredBatchRecovery updates state and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableDeferredBatchRecovery: createCheckbox(false)
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.enableDeferredBatchRecovery.checked = true;
    ui.enableDeferredBatchRecovery.click();

    assert.equal(args.state.enableDeferredBatchRecovery, true);
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      enableDeferredBatchRecovery: true
    })]);
  });
});

test.describe("google api backend preference", () => {
  test("initializeUI reflects saved googleApiBackend state", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      googleApiBackend: createBatchSlider("auto", "16")
    };
    const args = createBaseArgs(ui);
    args.state.googleApiBackend = "google-ai-studio";

    initializeUI(args);

    assert.equal(ui.googleApiBackend.value, "google-ai-studio");
  });

  test("initializeUI restores Vertex AI as the selected picker item", () => {
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      googleApiBackend: createGoogleBackendPicker("google-ai-studio")
    };
    const args = createBaseArgs(ui);
    args.state.googleApiBackend = "vertex-ai";

    initializeUI(args);

    assert.equal(ui.googleApiBackend.value, "vertex-ai");
    assert.equal(ui.googleApiBackend.items[0].selected, false);
    assert.equal(ui.googleApiBackend.items[1].selected, true);
    assert.equal(ui.googleApiBackend.items[1].value, "vertex-ai");
  });

  test("changing googleApiBackend saves state", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      googleApiBackend: createGoogleBackendPicker("google-ai-studio")
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.googleApiBackend.change("vertex-ai");

    assert.equal(args.state.googleApiBackend, "vertex-ai");
    assert.equal(ui.googleApiBackend.items[0].selected, false);
    assert.equal(ui.googleApiBackend.items[1].selected, true);
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      googleApiBackend: "vertex-ai"
    })]);
  });

  test("invalid googleApiBackend falls back to google-ai-studio", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      googleApiBackend: createBatchSlider("auto", "16")
    };
    const args = createBaseArgs(ui);
    args.storage.savePluginPrefs = (_storage, prefs) => {
      savedPrefs.push(prefs);
    };
    global.localStorage = {};

    initializeUI(args);
    bindEvents(args);

    ui.googleApiBackend.change("unknown");

    assert.equal(args.state.googleApiBackend, "google-ai-studio");
    assert.equal(ui.googleApiBackend.value, "google-ai-studio");
    assert.deepEqual(savedPrefs, [createSavedPrefs()]);
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
    assert.deepEqual(savedPrefs, [createSavedPrefs()]);
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
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      maxWaitingTimeSeconds: 300
    })]);
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
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      enableBatchGeneration: true,
      maxBatchCount: 3
    })]);
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
    assert.deepEqual(savedPrefs[savedPrefs.length - 1], createSavedPrefs({
      enableGeneratedGroupColorLabel: true,
      generatedGroupColorLabel: "red"
    }));
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
    assert.deepEqual(savedPrefs, [createSavedPrefs({
      showChatTab: false
    })]);
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

test.describe("api key updates", () => {
  test("initializeUI marks stored keys valid without filling the fields", () => {
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "STUDIO_KEY",
      "GoogleVertexAI-api-key": "VERTEX_KEY"
    };

    initializeUI(args);

    assert.equal(ui.apiKeyGoogleAiStudio.valid, true);
    assert.equal(ui.apiKeyGoogleVertexAi.valid, true);
    assert.equal(ui.apiKeyGoogleAiStudio.value, "");
    assert.equal(ui.apiKeyGoogleVertexAi.value, "");
  });

  test("updating only the Studio field leaves the Vertex key unchanged even if the Vertex field value leaked", () => {
    const savedKeys = [];
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "OLD_STUDIO",
      "GoogleVertexAI-api-key": "VERTEX_KEY",
      "SeeDream-api-key": "BYTE_KEY",
      "xAI-api-key": "XAI_KEY"
    };
    args.storage.saveApiKeys = (_storage, apiKey) => {
      savedKeys.push({ ...apiKey });
    };
    global.localStorage = {};

    bindEvents(args);

    ui.apiKeyGoogleAiStudio.input("NEW_STUDIO");
    ui.apiKeyGoogleVertexAi.value = "NEW_STUDIO";
    ui.updateApiKey.click();

    assert.equal(args.state.apiKey["GoogleAIStudio-api-key"], "NEW_STUDIO");
    assert.equal(args.state.apiKey["GoogleVertexAI-api-key"], "VERTEX_KEY");
    assert.equal(args.state.apiKey["SeeDream-api-key"], "BYTE_KEY");
    assert.equal(args.state.apiKey["xAI-api-key"], "XAI_KEY");
    assert.equal(savedKeys.length, 1);
    assert.equal(savedKeys[0]["GoogleAIStudio-api-key"], "NEW_STUDIO");
    assert.equal(savedKeys[0]["GoogleVertexAI-api-key"], "VERTEX_KEY");
    assert.equal(ui.apiKeyGoogleAiStudio.value, "");
    assert.equal(ui.apiKeyGoogleVertexAi.value, "");
    assert.equal(ui.showKey.checked, false);
  });

  test("updating only the Vertex field leaves the Studio key unchanged", () => {
    const savedKeys = [];
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "STUDIO_KEY",
      "GoogleVertexAI-api-key": "OLD_VERTEX"
    };
    args.storage.saveApiKeys = (_storage, apiKey) => {
      savedKeys.push({ ...apiKey });
    };
    global.localStorage = {};

    bindEvents(args);

    ui.apiKeyGoogleVertexAi.input("NEW_VERTEX");
    ui.apiKeyGoogleAiStudio.value = "NEW_VERTEX";
    ui.updateApiKey.click();

    assert.equal(args.state.apiKey["GoogleAIStudio-api-key"], "STUDIO_KEY");
    assert.equal(args.state.apiKey["GoogleVertexAI-api-key"], "NEW_VERTEX");
    assert.equal(savedKeys.length, 1);
    assert.equal(savedKeys[0]["GoogleAIStudio-api-key"], "STUDIO_KEY");
  });

  test("updating Bytedance or xAI does not touch Google keys", () => {
    const savedKeys = [];
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "STUDIO_KEY",
      "GoogleVertexAI-api-key": "VERTEX_KEY",
      "SeeDream-api-key": "OLD_BYTE",
      "xAI-api-key": "OLD_XAI"
    };
    args.storage.saveApiKeys = (_storage, apiKey) => {
      savedKeys.push({ ...apiKey });
    };
    global.localStorage = {};

    bindEvents(args);

    ui.apiKeyBytedance.input("NEW_BYTE");
    ui.apiKeyXai.input("NEW_XAI");
    ui.updateApiKey.click();

    assert.equal(args.state.apiKey["GoogleAIStudio-api-key"], "STUDIO_KEY");
    assert.equal(args.state.apiKey["GoogleVertexAI-api-key"], "VERTEX_KEY");
    assert.equal(args.state.apiKey["SeeDream-api-key"], "NEW_BYTE");
    assert.equal(args.state.apiKey["xAI-api-key"], "NEW_XAI");
    assert.equal(savedKeys.length, 1);
  });

  test("Show API Key fills each field from its own stored key and toggling it off does not persist", () => {
    const savedKeys = [];
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "STUDIO_KEY",
      "GoogleVertexAI-api-key": "VERTEX_KEY"
    };
    args.storage.saveApiKeys = (_storage, apiKey) => {
      savedKeys.push({ ...apiKey });
    };
    global.localStorage = {};

    bindEvents(args);

    ui.showKey.checked = true;
    ui.showKey.click();

    assert.equal(ui.apiKeyGoogleAiStudio.value, "STUDIO_KEY");
    assert.equal(ui.apiKeyGoogleVertexAi.value, "VERTEX_KEY");

    ui.showKey.checked = false;
    ui.showKey.click();

    assert.equal(ui.apiKeyGoogleAiStudio.value, "");
    assert.equal(ui.apiKeyGoogleVertexAi.value, "");
    assert.equal(savedKeys.length, 0);
    assert.equal(args.state.apiKey["GoogleAIStudio-api-key"], "STUDIO_KEY");
    assert.equal(args.state.apiKey["GoogleVertexAI-api-key"], "VERTEX_KEY");
  });

  test("Show API Key then Update with no edits does not overwrite an untouched key", () => {
    const savedKeys = [];
    const ui = createApiKeyUi();
    const args = createBaseArgs(ui);
    args.state.apiKey = {
      "GoogleAIStudio-api-key": "STUDIO_KEY",
      "GoogleVertexAI-api-key": "VERTEX_KEY"
    };
    args.storage.saveApiKeys = (_storage, apiKey) => {
      savedKeys.push({ ...apiKey });
    };
    global.localStorage = {};

    bindEvents(args);

    ui.showKey.checked = true;
    ui.showKey.click();
    ui.updateApiKey.click();

    assert.equal(args.state.apiKey["GoogleAIStudio-api-key"], "STUDIO_KEY");
    assert.equal(args.state.apiKey["GoogleVertexAI-api-key"], "VERTEX_KEY");
    assert.equal(savedKeys.length, 0);
    assert.equal(ui.apiKeyGoogleAiStudio.value, "");
    assert.equal(ui.apiKeyGoogleVertexAi.value, "");
    assert.equal(ui.showKey.checked, false);
  });
});
