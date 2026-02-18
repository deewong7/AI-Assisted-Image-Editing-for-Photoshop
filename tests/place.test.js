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
});
