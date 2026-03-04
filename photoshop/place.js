function createPlacer({ app, core, constants, fs, imaging, base64ToArrayBuffer, logLine }) {
  function base64ToBuffer(base64) {
    const buffer = base64ToArrayBuffer(base64)
    const bytes = new Uint8Array(buffer)
    if (typeof logLine === "function") {
      logLine("Received server byte length: " + bytes.byteLength)
    }
    console.log("converted base64 to buffer, byte length: " + bytes.byteLength)
    return buffer
  }

  async function writeBase64ToTargetFile(base64, options = {}) {
    const persistGeneratedImages = options.persistGeneratedImages === true
    const targetFolder = persistGeneratedImages
      ? await fs.getDataFolder()
      : await fs.getTemporaryFolder()
    const targetModeLabel = persistGeneratedImages ? "persistent data folder" : "temporary folder"
    const fileNameNoExt = `generated_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const fileName = `${fileNameNoExt}.png`
    const targetFile = await targetFolder.createFile(fileName, { overwrite: true })
    await targetFile.write(base64ToBuffer(base64))
    console.log("Written base64 to output file..., length" + base64.length)
    console.log("API generated image is written at (" + targetModeLabel + "):\n" + targetFile.nativePath)
    if (typeof logLine === "function") {
      logLine("API generated image is written at (" + targetModeLabel + "):\n" + targetFile.nativePath)
    }
    return targetFile
  }

  function buildSelectionCommands(bounds) {
    return [
      {
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
      },
      {
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
      }
    ]
  }

  function findLayerSuffix(layers) {
    let layerSuffix = 1
    for (let i = 0; i < layers.length; i += 1) {
      const layer = layers[i]
      if (layer.name.startsWith("Generated Image")) {
        layerSuffix += 1
      }
    }
    return layerSuffix
  }

  async function placeFileToCurrentDocAtSelection(targetFile, bounds, suffix = "", options = {}) {
    let placedLayer = null
    try {
      await core.executeAsModal(async () => {
        const sessionToken = fs.createSessionToken(targetFile)
        console.log("session token created: " + sessionToken)
        const placeCommand = {
          _obj: "placeEvent",
          null: { _path: sessionToken, _kind: "local" },
          linked: false
        }

        await app.batchPlay(
          [
            ...buildSelectionCommands(bounds),
            placeCommand
          ],
          { synchronousExecution: true }
        )

        const layers = app.activeDocument.layers
        placedLayer = app.activeDocument.activeLayers[0]

        if (!placedLayer) {
          console.error("NO LAYER PLACED WHY?")
          if (typeof logLine === "function") {
            logLine("Error: no layer placed after batchPlay!")
          }
          return
        }

        placedLayer.scale(
          bounds.width / placedLayer.bounds.width * 100,
          bounds.height / placedLayer.bounds.height * 100
        )

        if (app.activeDocument.layers[0]) {
          placedLayer.move(app.activeDocument.layers[0], constants.ElementPlacement.PLACEBEFORE)
        }

        const layerSuffix = findLayerSuffix(layers)
        placedLayer.name = suffix
          ? `Generated Image ${layerSuffix} - ${suffix}`
          : `Generated Image ${layerSuffix}`

        await applyMaskWithGaussianBlur(placedLayer, bounds, options.skipMask, 0.10, true)
      })
    } catch (error) {
      if (error?.message?.includes("modal state")) {
        if (typeof logLine === "function") {
          logLine("Cannot place the generated image because host is in modal state, but the file has been saved. Check the log for path of the file.")
        }
      }
      console.error(error)
    }
    return placedLayer
  }

  function findDocumentLayerById(layerId) {
    const layers = app.activeDocument?.layers || []
    for (let i = 0; i < layers.length; i += 1) {
      if (layers[i].id === layerId) {
        return layers[i]
      }
    }
    return null
  }

  function createBatchGroupName(suffix = "") {
    return suffix ? `Generated Batch - ${suffix}` : "Generated Batch"
  }

  async function placeToCurrentDocAtSelection(base64, bounds, suffix = "", options = {}) {
    if (!base64 || base64?.length === 0) {
      console.log("No base64 data to place.")
      return
    }

    const targetFile = await writeBase64ToTargetFile(base64, options)
    return placeFileToCurrentDocAtSelection(targetFile, bounds, suffix, options)
  }

  async function placeBatchToCurrentDocAtSelection(base64Images, bounds, suffix = "", options = {}) {
    if (!Array.isArray(base64Images) || base64Images.length === 0) {
      console.log("No base64 batch data to place.")
      return []
    }

    const targetFiles = []
    for (const base64 of base64Images) {
      if (!base64 || base64.length === 0) {
        continue
      }
      targetFiles.push(await writeBase64ToTargetFile(base64, options))
    }

    const placedLayerIds = []
    for (const targetFile of targetFiles) {
      const placedLayer = await placeFileToCurrentDocAtSelection(targetFile, bounds, suffix, options)
      if (placedLayer?.id) {
        placedLayerIds.push(placedLayer.id)
      }
    }

    if (placedLayerIds.length > 1) {
      try {
        await core.executeAsModal(async () => {
          const fromLayers = placedLayerIds
            .map(layerId => findDocumentLayerById(layerId))
            .filter(Boolean)
          if (fromLayers.length > 1) {
            await app.activeDocument.createLayerGroup({
              name: createBatchGroupName(suffix),
              fromLayers
            })
          }
        })
      } catch (error) {
        console.error("Error creating generated layer group:", error)
        if (typeof logLine === "function") {
          logLine("Error creating generated layer group: " + (error?.message || String(error)))
        }
      }
    }

    return placedLayerIds
  }

  async function applyMaskWithGaussianBlur(layer, bounds, skipMask, radius = 0.10, alreadyInModal = false) {
    const doc = app.activeDocument
    if (skipMask || (bounds.width === doc.width && bounds.height === doc.height)) {
      return
    }
    if (radius >= 1) {
      return
    }

    const applyMask = async () => {
      try {
        const maskWidth = Math.max(1, Math.round(bounds.width * (1 - radius)))
        const maskHeight = Math.max(1, Math.round(bounds.height * (1 - radius)))
        const offsetX = Math.round((bounds.width - maskWidth) / 2)
        const offsetY = Math.round((bounds.height - maskHeight) / 2)
        const maskBounds = {
          left: bounds.left + offsetX,
          top: bounds.top + offsetY,
          right: bounds.left + offsetX + maskWidth,
          bottom: bounds.top + offsetY + maskHeight
        }

        const bufferBlack = new Uint8Array(doc.width * doc.height)
        bufferBlack.fill(0)

        const bufferWhite = new Uint8Array(maskWidth * maskHeight)
        bufferWhite.fill(255)

        const imageDataBlack = await imaging.createImageDataFromBuffer(
          bufferBlack,
          {
            width: doc.width,
            height: doc.height,
            components: 1,
            colorSpace: "Grayscale",
            chunky: true
          }
        )

        const imageDataWhite = await imaging.createImageDataFromBuffer(
          bufferWhite,
          {
            width: maskWidth,
            height: maskHeight,
            components: 1,
            colorSpace: "Grayscale",
            chunky: true
          }
        )

        try {
          await imaging.putLayerMask({
            layerID: layer.id,
            imageData: imageDataBlack,
            commandName: "Apply Mask to Generated Image Black"
          })

          await imaging.putLayerMask({
            layerID: layer.id,
            imageData: imageDataWhite,
            targetBounds: maskBounds,
            replace: false,
            commandName: "Apply Mask to Generated Image White"
          })
          const K = 0.015
          layer.layerMaskFeather = K * maskWidth

          imageDataBlack.dispose()
          imageDataWhite.dispose()
        } catch (error) {
          console.error("cannot putlayermask", error)
        }
      } catch (e) {
        console.error(e)
      }
    }

    if (alreadyInModal) {
      await applyMask()
      return
    }

    await core.executeAsModal(applyMask)
  }

  return {
    placeToCurrentDocAtSelection,
    placeBatchToCurrentDocAtSelection
  }
}

module.exports = {
  createPlacer
}
