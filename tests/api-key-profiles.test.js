const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeApiKeyStore,
  profileNames,
  createProfile,
  renameProfile,
  deleteProfile,
  profileActionMessage
} = require("../api-key-profiles");

const DEFAULTS = {
  "GoogleAIStudio-api-key": "",
  "xAI-api-key": ""
};

function storeWith(profiles, activeProfile = "default") {
  return { activeProfile, profiles };
}

test.describe("normalizeApiKeyStore", () => {
  test("wraps a flat key object and drops unknown fields", () => {
    const store = normalizeApiKeyStore({
      "xAI-api-key": "K",
      extra: "nope"
    }, DEFAULTS);
    assert.equal(store.activeProfile, "default");
    assert.deepEqual(store.profiles.default, {
      "GoogleAIStudio-api-key": "",
      "xAI-api-key": "K"
    });
  });

  test("pins default first and sorts the other names", () => {
    const store = normalizeApiKeyStore({
      activeProfile: "zed",
      profiles: {
        zed: { "xAI-api-key": "Z" },
        alpha: { "xAI-api-key": "A" }
      }
    }, DEFAULTS);
    assert.deepEqual(profileNames(store), ["default", "alpha", "zed"]);
    assert.equal(store.activeProfile, "zed");
  });
});

test.describe("createProfile", () => {
  test("copies the source profile under the next free name without mutating the input", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" },
      "profile 2": { "xAI-api-key": "P2" }
    }, "default");
    const result = createProfile(source, "default");

    assert.equal(result.ok, true);
    assert.equal(result.name, "profile 3");
    assert.equal(result.store.activeProfile, "profile 3");
    assert.deepEqual(result.store.profiles["profile 3"], { "xAI-api-key": "D" });
    assert.notEqual(result.store.profiles["profile 3"], source.profiles.default);
    assert.deepEqual(source.profiles, {
      default: { "xAI-api-key": "D" },
      "profile 2": { "xAI-api-key": "P2" }
    });
    assert.equal(source.activeProfile, "default");
  });
});

test.describe("renameProfile", () => {
  test("moves keys to the trimmed name", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" },
      work: { "xAI-api-key": "W" }
    }, "work");
    const result = renameProfile(source, "work", " studio ");

    assert.equal(result.ok, true);
    assert.equal(result.store.activeProfile, "studio");
    assert.equal(result.store.profiles.work, undefined);
    assert.deepEqual(result.store.profiles.studio, { "xAI-api-key": "W" });
    assert.ok(source.profiles.work);
  });

  test("rejects an empty name, a duplicate, and a rename of default", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" },
      work: { "xAI-api-key": "W" }
    }, "work");

    const empty = renameProfile(source, "work", " ");
    assert.equal(empty.ok, false);
    assert.equal(empty.reason, "empty");
    assert.equal(profileActionMessage("rename", empty), "Enter a profile name.");

    const duplicate = renameProfile(source, "work", "default");
    assert.equal(duplicate.reason, "duplicate");
    assert.equal(profileActionMessage("rename", duplicate), "Profile name already exists: default.");

    const protectedName = renameProfile(source, "default", "other");
    assert.equal(protectedName.reason, "protected");
    assert.equal(profileActionMessage("rename", protectedName), "The default profile cannot be renamed.");
    assert.equal(source.activeProfile, "work");
  });

  test("allows a name that differs only by case", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" },
      work: { "xAI-api-key": "W" }
    }, "work");
    const result = renameProfile(source, "work", "Default");
    assert.equal(result.ok, true);
    assert.equal(result.store.profiles.Default["xAI-api-key"], "W");
  });
});

test.describe("deleteProfile", () => {
  test("removes the profile and selects default without mutating the input", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" },
      work: { "xAI-api-key": "W" }
    }, "work");
    const result = deleteProfile(source, "work");

    assert.equal(result.ok, true);
    assert.equal(result.store.activeProfile, "default");
    assert.equal(result.store.profiles.work, undefined);
    assert.deepEqual(result.store.profiles.default, { "xAI-api-key": "D" });
    assert.ok(source.profiles.work);
  });

  test("rejects deleting default", () => {
    const source = storeWith({
      default: { "xAI-api-key": "D" }
    });
    const result = deleteProfile(source, "default");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "protected");
    assert.equal(profileActionMessage("delete", result), "The default profile cannot be deleted.");
    assert.ok(source.profiles.default);
  });
});
