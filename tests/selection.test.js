const test = require("node:test");
const assert = require("node:assert/strict");
const { createSelection } = require("../photoshop/selection");

const BOUNDS = {
  left: 1,
  top: 2,
  right: 101,
  bottom: 202
};

function createImageData(label, disposed) {
  return {
    dispose() {
      disposed.push(label);
    }
  };
}

function createHarness({
  bitsPerChannel = 8,
  constantsSixteen = "SIXTEEN",
  getPixelsImpl,
  encodeImpl
} = {}) {
  const calls = {
    getPixels: [],
    encode: [],
    modalCount: 0,
    alerts: []
  };
  const disposed = [];
  let imageCount = 0;

  const core = {
    showAlert(message) {
      calls.alerts.push(message);
    },
    async executeAsModal(callback) {
      calls.modalCount += 1;
      return callback();
    }
  };

  const imaging = {
    async getPixels(options) {
      calls.getPixels.push(options);
      if (typeof getPixelsImpl === "function") {
        return getPixelsImpl(options, { calls, disposed });
      }
      imageCount += 1;
      return { imageData: createImageData(`image-${imageCount}`, disposed) };
    },
    async encodeImageData(options) {
      calls.encode.push(options);
      if (typeof encodeImpl === "function") {
        return encodeImpl(options, { calls, disposed });
      }
      return "BASE64_DATA";
    }
  };

  const app = {
    activeDocument: {
      bitsPerChannel
    }
  };
  const constants = {
    BitsPerChannelType: {
      SIXTEEN: constantsSixteen
    }
  };
  const logs = [];

  const selection = createSelection({
    app,
    constants,
    core,
    imaging,
    logLine(message) {
      logs.push(String(message));
    }
  });

  return {
    selection,
    calls,
    disposed,
    logs
  };
}

test.describe("createSelection", () => {
  test("forces 8-bit getPixels for numeric 16-bit documents", async () => {
    const { selection, calls } = createHarness({
      bitsPerChannel: 16
    });

    const imageData = await selection.getImageDataFromSelection(BOUNDS);
    imageData.dispose();

    assert.equal(calls.getPixels.length, 1);
    assert.equal(calls.getPixels[0].componentSize, 8);
    assert.equal(calls.getPixels[0].applyAlpha, true);
  });

  test("forces 8-bit getPixels for enum-like SIXTEEN bitsPerChannel values", async () => {
    const { selection, calls } = createHarness({
      bitsPerChannel: "BitsPerChannelType.SIXTEEN"
    });

    const imageData = await selection.getImageDataFromSelection(BOUNDS);
    imageData.dispose();

    assert.equal(calls.getPixels.length, 1);
    assert.equal(calls.getPixels[0].componentSize, 8);
  });

  test("does not force componentSize for 8-bit documents", async () => {
    const { selection, calls } = createHarness({
      bitsPerChannel: 8
    });

    const imageData = await selection.getImageDataFromSelection(BOUNDS);
    imageData.dispose();

    assert.equal(calls.getPixels.length, 1);
    assert.equal(calls.getPixels[0].componentSize, undefined);
  });

  test("encodes base64 and disposes imageData in success path", async () => {
    const { selection, calls, disposed } = createHarness({
      bitsPerChannel: 8,
      encodeImpl() {
        return "ENCODED";
      }
    });

    const base64 = await selection.getImageDataToBase64(BOUNDS);

    assert.equal(base64, "ENCODED");
    assert.equal(calls.modalCount, 1);
    assert.equal(calls.getPixels.length, 1);
    assert.equal(calls.encode.length, 1);
    assert.deepEqual(disposed, ["image-1"]);
  });

  test("retries encode with RGB/sRGB fallback for 16-bit documents", async () => {
    let encodeCallCount = 0;

    const { selection, calls, disposed, logs } = createHarness({
      bitsPerChannel: 16,
      encodeImpl() {
        encodeCallCount += 1;
        if (encodeCallCount === 1) {
          throw new Error("first encode failed");
        }
        return "RECOVERED";
      }
    });

    const base64 = await selection.getImageDataToBase64(BOUNDS);

    assert.equal(base64, "RECOVERED");
    assert.equal(calls.getPixels.length, 2);
    assert.equal(calls.encode.length, 2);
    assert.equal(calls.getPixels[0].componentSize, 8);
    assert.equal(calls.getPixels[0].colorSpace, undefined);
    assert.equal(calls.getPixels[1].componentSize, 8);
    assert.equal(calls.getPixels[1].colorSpace, "RGB");
    assert.equal(calls.getPixels[1].colorProfile, "sRGB IEC61966-2.1");
    assert.deepEqual(disposed, ["image-1", "image-2"]);
    assert.equal(logs.some(line => line.includes("retrying encode")), true);
  });

  test("throws when 16-bit fallback encode fails and still disposes both imageData objects", async () => {
    let encodeCallCount = 0;

    const { selection, disposed } = createHarness({
      bitsPerChannel: 16,
      encodeImpl() {
        encodeCallCount += 1;
        if (encodeCallCount === 1) {
          throw new Error("first encode failed");
        }
        throw new Error("second encode failed");
      }
    });

    await assert.rejects(
      () => selection.getImageDataToBase64(BOUNDS),
      /second encode failed/
    );
    assert.deepEqual(disposed, ["image-1", "image-2"]);
  });
});
