const test = require("node:test");
const assert = require("node:assert/strict");
const { createState, DEFAULT_API_KEYS } = require("../state");

test.describe("createState api key profiles", () => {
  test("points apiKey at the active profile object", () => {
    const defaults = { ...DEFAULT_API_KEYS, "xAI-api-key": "DEFAULT" };
    const work = { ...DEFAULT_API_KEYS, "xAI-api-key": "WORK" };
    const state = createState({
      apiKeyStore: {
        activeProfile: "work",
        profiles: {
          default: defaults,
          work
        }
      }
    });

    assert.equal(state.activeApiKeyProfile, "work");
    assert.equal(state.apiKey, work);
    assert.equal(state.apiKeyProfiles.work, work);
  });

  test("wraps a flat apiKey as default", () => {
    const keys = { ...DEFAULT_API_KEYS, "xAI-api-key": "K" };
    const state = createState({ apiKey: keys });

    assert.equal(state.activeApiKeyProfile, "default");
    assert.equal(state.apiKeyProfiles.default, state.apiKey);
    assert.equal(state.apiKey["xAI-api-key"], "K");
    assert.notEqual(state.apiKey, keys);
  });

  test("falls back to default when the active profile is missing", () => {
    const defaults = { ...DEFAULT_API_KEYS, "xAI-api-key": "D" };
    const state = createState({
      apiKeyStore: {
        activeProfile: "gone",
        profiles: {
          default: defaults
        }
      }
    });

    assert.equal(state.activeApiKeyProfile, "default");
    assert.equal(state.apiKey, defaults);
  });
});
