function createSelection({ core, imaging, logLine }) {
  async function getImageDataFromSelection(bounds) {
    if (!bounds) {
      core.showAlert("No Selection.");
      throw new Error("No Selection");
    }

    try {
      const result = await imaging.getPixels({
        sourceBounds: {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom
        },
        applyAlpha: true
      });
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
        console.error(error);
        if (typeof logLine === "function") {
          logLine(error.message);
        }
        throw error;
      } finally {
        if (imageData) {
          imageData.dispose();
        }
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
