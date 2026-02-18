function createPlacer({ app, core, constants, fs, imaging, base64ToArrayBuffer, logLine }) {
  function base64ToBuffer(base64) {
    const buffer = base64ToArrayBuffer(base64);
    const bytes = new Uint8Array(buffer);
    if (typeof logLine === "function") {
      logLine("Received server byte length: " + bytes.byteLength);
    }
    console.log("converted base64 to buffer, byte length: " + bytes.byteLength);
    return buffer;
  }

  async function placeToCurrentDocAtSelection(base64, bounds, suffix = "", options = {}) {
    if (!base64 || base64?.length === 0) {
      console.log("No base64 data to place.");
      return;
    }

    const persistGeneratedImages = options.persistGeneratedImages === true;
    const targetFolder = persistGeneratedImages
      ? await fs.getDataFolder()
      : await fs.getTemporaryFolder();
    const targetModeLabel = persistGeneratedImages ? "persistent data folder" : "temporary folder";
    const fileNameNoExt = `generated_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const fileName = `${fileNameNoExt}.png`;
    const targetFile = await targetFolder.createFile(fileName, { overwrite: true });
    await targetFile.write(base64ToBuffer(base64));
    console.log("Written base64 to output file..., length" + base64.length);
    console.log("API generated image is written at (" + targetModeLabel + "):\n" + targetFile.nativePath);
    if (typeof logLine === "function") {
      logLine("API generated image is written at (" + targetModeLabel + "):\n" + targetFile.nativePath);
    }

    try {
      await core.executeAsModal(async () => {
        const sessionToken = fs.createSessionToken(targetFile);
        console.log("session token created: " + sessionToken);

        const selectCommand = {
          "_obj": "select",
          "_target": [
            {
              "_id": app.activeDocument.layers[0].id,
              "_ref": "layer"
            }
          ],
          "layerID": [
            app.activeDocument.layers[0].id
          ],
          "makeVisible": false
        };

        const setSelectionCommand = {
          "_obj": "set",
          "_target": [
            {
              "_property": "selection",
              "_ref": "channel"
            }
          ],
          "to": {
            "_obj": "rectangle",
            "bottom": {
              "_unit": "pixelsUnit",
              "_value": bounds.bottom
            },
            "left": {
              "_unit": "pixelsUnit",
              "_value": bounds.left
            },
            "right": {
              "_unit": "pixelsUnit",
              "_value": bounds.right
            },
            "top": {
              "_unit": "pixelsUnit",
              "_value": bounds.top
            }
          }
        };

        const placeCommand = {
          _obj: "placeEvent",
          null: { _path: sessionToken, _kind: "local" },
          linked: false
        };

        const result = await app.batchPlay(
          [
            selectCommand,
            setSelectionCommand,
            placeCommand
          ],
          { synchronousExecution: true }
        );

        const layers = app.activeDocument.layers;
        let placedLayer;
        placedLayer = app.activeDocument.activeLayers[0];

        if (!placedLayer) {
          console.error("NO LAYER PLACED WHY?");
          if (typeof logLine === "function") {
            logLine("Error: no layer placed after batchPlay!");
          }
          return;
        }

        placedLayer.scale(
          bounds.width / placedLayer.bounds.width * 100,
          bounds.height / placedLayer.bounds.height * 100
        );

        placedLayer.move(app.activeDocument.layers[0], constants.ElementPlacement.PLACEBEFORE);

        let layerSuffix = 1;
        for (let i = 0; i < layers.length; i++) {
          const layer = layers[i];
          if (layer.name.startsWith("Generated Image")) {
            layerSuffix += 1;
          }
        }

        placedLayer.name = `Generated Image ${layerSuffix} - ${suffix}`;

        await applyMaskWithGaussianBlur(placedLayer, bounds, options.skipMask);
      });
    } catch (error) {
      if (error.message.includes("modal state")) {
        if (typeof logLine === "function") {
          logLine("Cannot place the generated image because host is in modal state, but the file has been saved. Check the log for path of the file.");
        }
      }
      console.error(error);
    }
  }

  async function applyMaskWithGaussianBlur(layer, bounds, skipMask, radius = 0.10) {
    const doc = app.activeDocument;
    if (skipMask || (bounds.width === doc.width && bounds.height === doc.height)) {
      return;
    }
    if (radius >= 1) {
      return;
    }
    await core.executeAsModal(async () => {
      try {
        const maskWidth = Math.max(1, Math.round(bounds.width * (1 - radius)));
        const maskHeight = Math.max(1, Math.round(bounds.height * (1 - radius)));
        const offsetX = Math.round((bounds.width - maskWidth) / 2);
        const offsetY = Math.round((bounds.height - maskHeight) / 2);
        const maskBounds = {
          left: bounds.left + offsetX,
          top: bounds.top + offsetY,
          right: bounds.left + offsetX + maskWidth,
          bottom: bounds.top + offsetY + maskHeight
        };

        const bufferBlack = new Uint8Array(doc.width * doc.height);
        bufferBlack.fill(0);

        const bufferWhite = new Uint8Array(maskWidth * maskHeight);
        bufferWhite.fill(255);

        const imageDataBlack = await imaging.createImageDataFromBuffer(
          bufferBlack,
          {
            width: doc.width,
            height: doc.height,
            components: 1,
            colorSpace: "Grayscale",
            chunky: true
          }
        );

        const imageDataWhite = await imaging.createImageDataFromBuffer(
          bufferWhite,
          {
            width: maskWidth,
            height: maskHeight,
            components: 1,
            colorSpace: "Grayscale",
            chunky: true
          }
        );

        try {
          await imaging.putLayerMask({
            layerID: layer.id,
            imageData: imageDataBlack,
            commandName: "Apply Mask to Generated Image Black"
          });

          await imaging.putLayerMask({
            layerID: layer.id,
            imageData: imageDataWhite,
            targetBounds: maskBounds,
            replace: false,
            commandName: "Apply Mask to Generated Image White"
          });
          const K = 0.015;
          layer.layerMaskFeather = K * maskWidth;

          imageDataBlack.dispose();
          imageDataWhite.dispose();
        } catch (error) {
          console.error("cannot putlayermask", error);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  return {
    placeToCurrentDocAtSelection
  };
}

module.exports = {
  createPlacer
};
