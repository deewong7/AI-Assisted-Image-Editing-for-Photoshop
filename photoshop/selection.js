function getBitsPerChannelValue(bitsPerChannel) {
  if (bitsPerChannel && typeof bitsPerChannel === "object") {
    if (typeof bitsPerChannel._value !== "undefined") {
      return bitsPerChannel._value;
    }
    if (typeof bitsPerChannel.value !== "undefined") {
      return bitsPerChannel.value;
    }
  }
  return bitsPerChannel;
}

function isSixteenBitDocument(app, constants) {
  const rawBits = getBitsPerChannelValue(app?.activeDocument?.bitsPerChannel);
  const sixteenEnum = constants?.BitsPerChannelType?.SIXTEEN;

  if (rawBits === sixteenEnum) {
    return true;
  }
  if (typeof rawBits === "number") {
    return rawBits === 16;
  }

  const bitsText = String(rawBits || "").toUpperCase();
  if (bitsText === "16" || bitsText.includes("SIXTEEN")) {
    return true;
  }

  const enumText = String(sixteenEnum || "").toUpperCase();
  return enumText.length > 0 && bitsText === enumText;
}

function buildGetPixelsOptions(bounds, options = {}) {
  const getPixelsOptions = {
    sourceBounds: {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom
    },
    applyAlpha: true
  };

  if (options.forceEightBit) {
    getPixelsOptions.componentSize = 8;
  }
  if (options.forceRgbSrgb) {
    getPixelsOptions.colorSpace = "RGB";
    getPixelsOptions.colorProfile = "sRGB IEC61966-2.1";
  }

  return getPixelsOptions;
}

function disposeImageData(imageData) {
  if (imageData && typeof imageData.dispose === "function") {
    imageData.dispose();
  }
}

function createSelection({ app, constants, core, imaging, logLine }) {
  async function getImageDataFromSelection(bounds, options = {}) {
    if (!bounds) {
      core.showAlert("No Selection.");
      throw new Error("No Selection");
    }

    const isSixteenBit = isSixteenBitDocument(app, constants);
    const getPixelsOptions = buildGetPixelsOptions(bounds, {
      forceEightBit: isSixteenBit,
      forceRgbSrgb: options.forceRgbSrgb === true
    });

    try {
      if (isSixteenBit && typeof logLine === "function") {
        if (options.forceRgbSrgb) {
          logLine("16-bit compatibility fallback: forcing RGB/sRGB 8-bit pixels for encode.");
        } else {
          logLine("16-bit compatibility mode: forcing 8-bit pixels for encode.");
        }
      }

      const result = await imaging.getPixels(getPixelsOptions);
      console.log("image data obtained from selection.");
      return result.imageData;
    } catch (error) {
      console.log("error getting image data from selection: " + error);
      throw error;
    }
  }

  async function getImageDataToBase64(bounds) {
    return core.executeAsModal(async () => {
      let imageData = null;
      const isSixteenBit = isSixteenBitDocument(app, constants);
      try {
        imageData = await getImageDataFromSelection(bounds);
      } catch (error) {
        console.error("Error getting imageData from selection: " + error);
        return "";
      }

      try {
        const base64Data = await imaging.encodeImageData({
          imageData: imageData,
          base64: true
        });
        return base64Data;
      } catch (error) {
        if (!isSixteenBit) {
          console.error(error);
          if (typeof logLine === "function") {
            logLine(error.message);
          }
          throw error;
        }

        if (typeof logLine === "function") {
          logLine("16-bit compatibility fallback: retrying encode with RGB/sRGB 8-bit pixels.");
        }

        disposeImageData(imageData);
        imageData = null;

        try {
          imageData = await getImageDataFromSelection(bounds, { forceRgbSrgb: true });
          const base64Data = await imaging.encodeImageData({
            imageData: imageData,
            base64: true
          });
          return base64Data;
        } catch (fallbackError) {
          console.error(fallbackError);
          if (typeof logLine === "function") {
            logLine(fallbackError.message);
          }
          throw fallbackError;
        }
      } finally {
        disposeImageData(imageData);
      }
    });
  }

  return {
    getImageDataFromSelection,
    getImageDataToBase64
  };
}

module.exports = {
  createSelection
};
