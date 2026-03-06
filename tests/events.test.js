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

function createSelect(initialValue = "1") {
  const listeners = {};
  const items = ["1", "2", "3", "4"].map(value => ({
    value,
    selected: value === initialValue
  }));
  return {
    value: initialValue,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    querySelectorAll(selector) {
      return selector === "sp-menu-item" ? items : [];
    },
    change(nextValue) {
      this.value = nextValue;
      if (typeof listeners.change === "function") {
        listeners.change({ target: this });
      }
    }
  };
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
      showChatTab: true
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
      batchCountPicker: createSelect("3")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 3;

    initializeUI(args);

    assert.equal(ui.enableBatchGeneration.checked, true);
    assert.equal(ui.batchCountControl.style.display, "");
    assert.equal(ui.batchCountPicker.value, "3");
  });

  test("disabling batch generation hides the control, resets batch count, and saves preference", () => {
    const savedPrefs = [];
    const ui = {
      chatPromptInput: { value: "", disabled: false },
      enableCritiquePromptEdit: createCheckbox(false),
      enableBatchGeneration: createCheckbox(true),
      batchCountControl: { style: { display: "" } },
      batchCountPicker: createSelect("4")
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
    assert.equal(ui.batchCountPicker.value, "1");
    assert.deepEqual(savedPrefs, [{
      persistGeneratedImages: false,
      enableBatchGeneration: false,
      showChatTab: true
    }]);
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
      showChatTab: false
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
      batchCountPicker: createSelect("1")
    };
    const args = createBaseArgs(ui);
    args.state.enableBatchGeneration = true;
    args.state.batchCount = 1;
    args.logger.logLine = (...parts) => logs.push(parts.join(" "));

    bindEvents(args);

    ui.batchCountPicker.change("4");

    assert.equal(args.state.batchCount, 4);
    assert.equal(logs.some(line => line.includes("Update batch count to: 4")), true);
  });
});
