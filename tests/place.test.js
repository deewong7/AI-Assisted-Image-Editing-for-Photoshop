const test = require("node:test");
const assert = require("node:assert/strict");
const { createPlacer } = require("../photoshop/place.js");

function decodeBase64(base64) {
  const bytes = Buffer.from(base64, "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createFsHarness() {
  const calls = {
    tempFolderCalls: 0,
    dataFolderCalls: 0,
    writes: []
  };

  function createFolder(kind) {
    return {
      async createFile(name, options) {
        return {
          nativePath: `/${kind}/${name}`,
          async write(buffer) {
            calls.writes.push({
              kind,
              name,
              options,
              byteLength: buffer.byteLength
            });
          }
        };
      }
    };
  }

  return {
    fs: {
      async getTemporaryFolder() {
        calls.tempFolderCalls += 1;
        return createFolder("temp");
      },
      async getDataFolder() {
        calls.dataFolderCalls += 1;
        return createFolder("data");
      },
      createSessionToken() {
        return "token";
      }
    },
    calls
  };
}

function createPlacerForTest(fs) {
  return createPlacer({
    app: {},
    core: {
      async executeAsModal() {}
    },
    constants: {},
    fs,
    imaging: {},
    base64ToArrayBuffer: decodeBase64,
    logLine: () => {}
  });
}

function createPlacementHarness() {
  const { fs, calls } = createFsHarness();
  const groupCalls = [];
  const colorLabelCalls = [];
  let nextLayerId = 2;

  const backgroundLayer = {
    id: 1,
    name: "Background",
    bounds: { width: 100, height: 100 },
    scale() {},
    move() {}
  };

  const activeDocument = {
    width: 100,
    height: 100,
    layers: [backgroundLayer],
    activeLayers: [backgroundLayer],
    async createLayerGroup({ name, fromLayers }) {
      const group = { id: nextLayerId++, name };
      groupCalls.push({ name, fromLayers, id: group.id });
      return group;
    }
  };

  const app = {
    activeDocument,
    async batchPlay(commands) {
      const placeEvent = Array.isArray(commands)
        ? commands.find(command => command?._obj === "placeEvent")
        : null;
      if (placeEvent) {
        const placedLayer = {
          id: nextLayerId++,
          name: "Placed Layer",
          bounds: { width: 100, height: 100 },
          scale() {},
          move() {}
        };
        activeDocument.layers.unshift(placedLayer);
        activeDocument.activeLayers = [placedLayer];
      }

      const colorSet = Array.isArray(commands)
        ? commands.find(command =>
          command?._obj === "set" &&
          command?.to?.color?._enum === "color" &&
          command?.to?.color?._value
        )
        : null;
      if (colorSet) {
        colorLabelCalls.push({
          layerId: colorSet?._target?.[0]?._id,
          color: colorSet?.to?.color?._value
        });
      }
      return [];
    }
  };

  const placer = createPlacer({
    app,
    core: {
      async executeAsModal(callback) {
        return callback();
      }
    },
    constants: {
      ElementPlacement: {
        PLACEBEFORE: "PLACEBEFORE"
      }
    },
    fs,
    imaging: {
      async createImageDataFromBuffer() {
        return {
          dispose() {}
        };
      },
      async putLayerMask() {}
    },
    base64ToArrayBuffer: decodeBase64,
    logLine: () => {}
  });

  return {
    placer,
    calls,
    groupCalls,
    colorLabelCalls
  };
}

test.describe("createPlacer output folder selection", () => {
  const bounds = {
    left: 0,
    right: 100,
    top: 0,
    bottom: 100,
    width: 100,
    height: 100
  };

  test("uses temporary folder when persistGeneratedImages is false", async () => {
    const { fs, calls } = createFsHarness();
    const placer = createPlacerForTest(fs);

    await placer.placeToCurrentDocAtSelection("QUJD", bounds, "model", {
      persistGeneratedImages: false
    });

    assert.equal(calls.tempFolderCalls, 1);
    assert.equal(calls.dataFolderCalls, 0);
    assert.equal(calls.writes.length, 1);
    assert.equal(calls.writes[0].kind, "temp");
    assert.equal(calls.writes[0].byteLength, 3);
  });

  test("uses data folder when persistGeneratedImages is true", async () => {
    const { fs, calls } = createFsHarness();
    const placer = createPlacerForTest(fs);

    await placer.placeToCurrentDocAtSelection("QUJD", bounds, "model", {
      persistGeneratedImages: true
    });

    assert.equal(calls.tempFolderCalls, 0);
    assert.equal(calls.dataFolderCalls, 1);
    assert.equal(calls.writes.length, 1);
    assert.equal(calls.writes[0].kind, "data");
    assert.equal(calls.writes[0].byteLength, 3);
  });

  test("batch placement writes each image and groups the generated layers", async () => {
    const { placer, calls, groupCalls } = createPlacementHarness();

    await placer.placeBatchToCurrentDocAtSelection(["QUJD", "REVG"], bounds, "model", {
      persistGeneratedImages: false,
      skipMask: true
    });

    assert.equal(calls.tempFolderCalls, 2);
    assert.equal(calls.dataFolderCalls, 0);
    assert.equal(calls.writes.length, 2);
    assert.equal(groupCalls.length, 1);
    assert.equal(groupCalls[0].name, "Generated Batch - model");
    assert.deepEqual(groupCalls[0].fromLayers.map(layer => layer.id), [2, 3]);
  });

  test("batch placement skips group creation when only one image is placed", async () => {
    const { placer, groupCalls } = createPlacementHarness();

    await placer.placeBatchToCurrentDocAtSelection(["QUJD"], bounds, "model", {
      persistGeneratedImages: true,
      skipMask: true
    });

    assert.equal(groupCalls.length, 0);
  });

  test("applies configured color label to generated batch group when enabled", async () => {
    const { placer, groupCalls, colorLabelCalls } = createPlacementHarness();

    await placer.placeBatchToCurrentDocAtSelection(["QUJD", "REVG"], bounds, "model", {
      persistGeneratedImages: false,
      skipMask: true,
      enableGeneratedGroupColorLabel: true,
      generatedGroupColorLabel: "green"
    });

    assert.equal(groupCalls.length, 1);
    assert.equal(colorLabelCalls.length, 1);
    assert.equal(colorLabelCalls[0].layerId, groupCalls[0].id);
    assert.equal(colorLabelCalls[0].color, "grain");
  });

  test("does not apply color label when group coloring is disabled", async () => {
    const { placer, colorLabelCalls } = createPlacementHarness();

    await placer.placeBatchToCurrentDocAtSelection(["QUJD", "REVG"], bounds, "model", {
      persistGeneratedImages: false,
      skipMask: true,
      enableGeneratedGroupColorLabel: false,
      generatedGroupColorLabel: "red"
    });

    assert.equal(colorLabelCalls.length, 0);
  });
});
