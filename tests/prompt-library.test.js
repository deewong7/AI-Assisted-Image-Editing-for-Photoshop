const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PROMPT_LIBRARY_VERSION,
  normalizePromptPresets,
  serializePromptLibrary,
  parsePromptLibraryJson
} = require("../prompt-library.js");

test.describe("prompt library json", () => {
  test("normalizes presets to non-empty string entries", () => {
    const normalized = normalizePromptPresets({
      keep: "value",
      skipEmpty: "   ",
      skipNonString: 123,
      "  trimmed  ": "kept"
    });

    assert.deepEqual(normalized, {
      keep: "value",
      trimmed: "kept"
    });
  });

  test("serializes canonical versioned payload", () => {
    const serialized = serializePromptLibrary({
      alpha: "A",
      beta: "B"
    });
    const parsed = JSON.parse(serialized);

    assert.equal(parsed.version, PROMPT_LIBRARY_VERSION);
    assert.deepEqual(parsed.presets, {
      alpha: "A",
      beta: "B"
    });
  });

  test("parses versioned payload", () => {
    const parsed = parsePromptLibraryJson(JSON.stringify({
      version: 1,
      presets: {
        one: "Prompt one",
        two: "Prompt two"
      }
    }));

    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.presets, {
      one: "Prompt one",
      two: "Prompt two"
    });
  });

  test("parses wrapper payload without version", () => {
    const parsed = parsePromptLibraryJson(JSON.stringify({
      presets: {
        one: "Prompt one"
      }
    }));

    assert.equal(parsed.version, null);
    assert.deepEqual(parsed.presets, {
      one: "Prompt one"
    });
  });

  test("parses raw map payload without version", () => {
    const parsed = parsePromptLibraryJson(JSON.stringify({
      one: "Prompt one",
      two: "Prompt two"
    }));

    assert.equal(parsed.version, null);
    assert.deepEqual(parsed.presets, {
      one: "Prompt one",
      two: "Prompt two"
    });
  });

  test("rejects unsupported version", async () => {
    await assert.rejects(
      async () => {
        parsePromptLibraryJson(JSON.stringify({
          version: 2,
          presets: {
            one: "Prompt one"
          }
        }));
      },
      /Unsupported prompt library version/
    );
  });

  test("rejects invalid json text", async () => {
    await assert.rejects(
      async () => {
        parsePromptLibraryJson("{bad");
      },
      /Invalid JSON file/
    );
  });

  test("rejects payload with no valid presets", async () => {
    await assert.rejects(
      async () => {
        parsePromptLibraryJson(JSON.stringify({
          version: 1,
          presets: {
            invalid: "   "
          }
        }));
      },
      /No valid prompt presets found in file/
    );
  });
});
