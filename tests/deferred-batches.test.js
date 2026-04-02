const test = require("node:test");
const assert = require("node:assert/strict");
const { createDeferredBatchManager } = require("../deferred-batches.js");

function createStorageBackend(initial = {}) {
  const store = { ...initial };
  return {
    _store: store,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    }
  };
}

function createFsHarness() {
  const files = new Map();
  const folder = {
    async createFile(name) {
      let file = files.get(name);
      if (!file) {
        file = {
          name,
          content: "",
          async write(content) {
            file.content = String(content);
            files.set(name, file);
          },
          async read() {
            return file.content;
          },
          async delete() {
            files.delete(name);
          }
        };
      }
      files.set(name, file);
      return file;
    },
    async getEntries() {
      return Array.from(files.values());
    }
  };

  return {
    fs: {
      async getDataFolder() {
        return folder;
      }
    },
    files
  };
}

function createBounds() {
  return {
    left: 0,
    right: 100,
    top: 0,
    bottom: 100,
    width: 100,
    height: 100
  };
}

test.describe("createDeferredBatchManager", () => {
  test("stores deferred batch payloads and queue metadata", async () => {
    const storageBackend = createStorageBackend();
    const { fs, files } = createFsHarness();
    const manager = createDeferredBatchManager({
      fs,
      app: { activeDocument: { id: 7 } },
      placer: {
        async placeToCurrentDocAtSelection() {}
      },
      storageBackend,
      logLine: () => {}
    });

    const entry = await manager.deferBatch({
      images: ["AAA", "BBB"],
      requestDocument: { id: 7, name: "Poster.psd" },
      bounds: createBounds(),
      targetModel: "gemini-3-pro-image-preview",
      placementOptions: { skipMask: true },
      requestedCount: 4,
      successCount: 2
    });

    assert.equal(entry.docName, "Poster.psd");
    assert.equal(entry.docId, 7);
    assert.equal(entry.successCount, 2);
    assert.equal(entry.requestedCount, 4);
    assert.equal(manager.getPendingBatches().length, 1);
    assert.equal(files.size, 1);
    assert.match(storageBackend._store.deferredBatchPlacements, /Poster\.psd/);
  });

  test("recovers a deferred batch only into the original document and removes it on success", async () => {
    const storageBackend = createStorageBackend();
    const { fs, files } = createFsHarness();
    const batchPlaceCalls = [];
    const app = {
      activeDocument: { id: 11 }
    };
    const manager = createDeferredBatchManager({
      fs,
      app,
      placer: {
        async placeBatchToCurrentDocAtSelection(images, bounds, suffix, options) {
          batchPlaceCalls.push({ images, bounds, suffix, options });
        },
        async placeToCurrentDocAtSelection() {}
      },
      storageBackend,
      logLine: () => {}
    });

    const entry = await manager.deferBatch({
      images: ["AAA", "BBB"],
      requestDocument: { id: 11, name: "Poster.psd" },
      bounds: createBounds(),
      targetModel: "gemini-3-pro-image-preview",
      placementOptions: { skipMask: true, persistGeneratedImages: false },
      requestedCount: 2,
      successCount: 2
    });

    app.activeDocument.id = 99;
    const mismatchResult = await manager.recoverBatch(entry.id);
    assert.equal(mismatchResult.status, "document_mismatch");
    assert.equal(manager.getPendingBatches().length, 1);
    assert.equal(files.size, 1);

    app.activeDocument.id = 11;
    const placedResult = await manager.recoverBatch(entry.id);
    assert.equal(placedResult.status, "placed");
    assert.equal(batchPlaceCalls.length, 1);
    assert.deepEqual(batchPlaceCalls[0].images, ["AAA", "BBB"]);
    assert.equal(batchPlaceCalls[0].suffix, "gemini-3-pro-image-preview");
    assert.deepEqual(batchPlaceCalls[0].options, {
      skipMask: true,
      persistGeneratedImages: false,
      enableGeneratedGroupColorLabel: false
    });
    assert.equal(manager.getPendingBatches().length, 0);
    assert.equal(files.size, 0);
  });

  test("keeps deferred batch queued when Photoshop is still in modal state", async () => {
    const storageBackend = createStorageBackend();
    const { fs, files } = createFsHarness();
    const modalError = new Error("blocked");
    modalError.code = "HOST_MODAL_STATE";
    const manager = createDeferredBatchManager({
      fs,
      app: { activeDocument: { id: 15 } },
      placer: {
        async placeToCurrentDocAtSelection() {
          throw modalError;
        }
      },
      storageBackend,
      logLine: () => {}
    });

    const entry = await manager.deferBatch({
      images: ["AAA"],
      requestDocument: { id: 15, name: "Poster.psd" },
      bounds: createBounds(),
      targetModel: "gemini-3-pro-image-preview",
      placementOptions: {},
      requestedCount: 1,
      successCount: 1
    });

    const result = await manager.recoverBatch(entry.id);
    assert.equal(result.status, "host_modal_state");
    assert.equal(manager.getPendingBatches().length, 1);
    assert.equal(files.size, 1);
  });
});
