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

function createBaseArgs(ui, defaultChatPromptText = "DEFAULT CHAT PROMPT") {
  return {
    ui,
    state: {
      apiKey: {},
      promptPresets: {}
    },
    models: {},
    logger: {
      logLine() {}
    },
    storage: {
      saveApiKeys() {},
      savePromptPresets() {}
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
