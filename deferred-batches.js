const STORAGE_KEY = "deferredBatchPlacements";
const FILE_PREFIX = "deferred-batch-";

function cloneBounds(bounds) {
  if (!bounds || typeof bounds !== "object") {
    return null;
  }

  return {
    left: Number(bounds.left),
    right: Number(bounds.right),
    top: Number(bounds.top),
    bottom: Number(bounds.bottom),
    width: Number(bounds.width),
    height: Number(bounds.height)
  };
}

function normalizeCount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeDocName(docId, docName) {
  if (typeof docName === "string" && docName.trim()) {
    return docName.trim();
  }
  if (docId !== null && typeof docId !== "undefined") {
    return `Document ${docId}`;
  }
  return "Unknown Document";
}

function normalizeQueueEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const id = typeof entry.id === "string" ? entry.id : "";
  const fileName = typeof entry.fileName === "string" ? entry.fileName : "";
  if (!id || !fileName) {
    return null;
  }

  return {
    id,
    fileName,
    docId: entry.docId ?? null,
    docName: normalizeDocName(entry.docId ?? null, entry.docName),
    successCount: normalizeCount(entry.successCount),
    requestedCount: Math.max(
      normalizeCount(entry.requestedCount),
      normalizeCount(entry.successCount)
    ),
    createdAt: normalizeCount(entry.createdAt, Date.now())
  };
}

function loadQueue(storageBackend) {
  if (!storageBackend || typeof storageBackend.getItem !== "function") {
    return [];
  }

  const raw = storageBackend.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeQueueEntry)
      .filter(Boolean)
      .sort((left, right) => right.createdAt - left.createdAt);
  } catch {
    return [];
  }
}

function saveQueue(storageBackend, queue) {
  if (!storageBackend || typeof storageBackend.setItem !== "function") {
    return;
  }

  storageBackend.setItem(STORAGE_KEY, JSON.stringify(
    Array.isArray(queue)
      ? queue.map(normalizeQueueEntry).filter(Boolean)
      : []
  ));
}

function createBatchId(now = Date.now()) {
  return `${now}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBatchFileName(id) {
  return `${FILE_PREFIX}${id}.json`;
}

async function findBatchFile(fs, fileName) {
  const folder = await fs.getDataFolder();
  if (typeof folder.getEntries !== "function") {
    throw new Error("Deferred batch storage is unavailable.");
  }

  const entries = await folder.getEntries();
  const file = Array.isArray(entries)
    ? entries.find(entry => entry?.name === fileName)
    : null;

  return { folder, file };
}

function clonePlacementOptions(options) {
  if (!options || typeof options !== "object") {
    return {};
  }

  return {
    skipMask: options.skipMask === true,
    persistGeneratedImages: options.persistGeneratedImages === true,
    enableGeneratedGroupColorLabel: options.enableGeneratedGroupColorLabel === true,
    generatedGroupColorLabel: options.generatedGroupColorLabel
  };
}

function cloneImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.filter(image => typeof image === "string" && image.length > 0);
}

function createDeferredBatchManager({
  fs,
  app,
  placer,
  storageBackend = typeof localStorage !== "undefined" ? localStorage : null,
  logLine
}) {
  function getPendingBatches() {
    return loadQueue(storageBackend);
  }

  async function writePayload(payload) {
    const folder = await fs.getDataFolder();
    const fileName = createBatchFileName(payload.id);
    const file = await folder.createFile(fileName, { overwrite: true });
    await file.write(JSON.stringify(payload));
    return fileName;
  }

  async function readPayload(fileName) {
    const { file } = await findBatchFile(fs, fileName);
    if (!file || typeof file.read !== "function") {
      throw new Error(`Deferred batch payload not found: ${fileName}`);
    }

    const content = await file.read();
    return JSON.parse(content);
  }

  async function deletePayload(fileName) {
    try {
      const { file } = await findBatchFile(fs, fileName);
      if (file && typeof file.delete === "function") {
        await file.delete();
      }
    } catch (error) {
      if (typeof logLine === "function") {
        logLine("Failed to delete deferred batch payload: " + (error?.message || String(error)));
      }
    }
  }

  function removeQueueEntry(batchId) {
    const queue = getPendingBatches();
    const index = queue.findIndex(entry => entry.id === batchId);
    if (index === -1) {
      return null;
    }

    const [entry] = queue.splice(index, 1);
    saveQueue(storageBackend, queue);
    return entry;
  }

  async function removeBatch(batchId) {
    const entry = removeQueueEntry(batchId);
    if (!entry) {
      return null;
    }

    await deletePayload(entry.fileName);
    return entry;
  }

  async function deferBatch({
    images,
    requestDocument,
    bounds,
    targetModel,
    placementOptions,
    requestedCount,
    successCount
  }) {
    const deferredImages = cloneImages(images);
    if (deferredImages.length === 0) {
      throw new Error("Cannot defer an empty batch.");
    }

    const id = createBatchId();
    const createdAt = Date.now();
    const docId = requestDocument?.id ?? null;
    const docName = normalizeDocName(docId, requestDocument?.name);
    const payload = {
      id,
      createdAt,
      docId,
      docName,
      bounds: cloneBounds(bounds),
      targetModel: typeof targetModel === "string" ? targetModel : "",
      placementOptions: clonePlacementOptions(placementOptions),
      requestedCount: Math.max(normalizeCount(requestedCount, deferredImages.length), deferredImages.length),
      successCount: Math.max(normalizeCount(successCount, deferredImages.length), deferredImages.length),
      images: deferredImages
    };

    const fileName = await writePayload(payload);
    const queue = getPendingBatches();
    const entry = normalizeQueueEntry({
      id,
      fileName,
      docId,
      docName,
      requestedCount: payload.requestedCount,
      successCount: payload.successCount,
      createdAt
    });

    queue.unshift(entry);
    saveQueue(storageBackend, queue);
    return entry;
  }

  async function placeImages(payload) {
    const images = cloneImages(payload?.images);
    if (images.length === 0) {
      return;
    }

    if (images.length > 1 && typeof placer.placeBatchToCurrentDocAtSelection === "function") {
      await placer.placeBatchToCurrentDocAtSelection(
        images,
        payload.bounds,
        payload.targetModel,
        payload.placementOptions
      );
      return;
    }

    if (images.length === 1) {
      await placer.placeToCurrentDocAtSelection(
        images[0],
        payload.bounds,
        payload.targetModel,
        payload.placementOptions
      );
      return;
    }

    if (typeof placer.placeBatchToCurrentDocAtSelection === "function") {
      await placer.placeBatchToCurrentDocAtSelection(
        images,
        payload.bounds,
        payload.targetModel,
        payload.placementOptions
      );
      return;
    }

    for (const image of images) {
      await placer.placeToCurrentDocAtSelection(
        image,
        payload.bounds,
        payload.targetModel,
        payload.placementOptions
      );
    }
  }

  async function recoverBatch(batchId) {
    const entry = getPendingBatches().find(candidate => candidate.id === batchId);
    if (!entry) {
      return { status: "missing" };
    }

    const currentDocId = app?.activeDocument?.id ?? null;
    if (entry.docId !== currentDocId) {
      return {
        status: "document_mismatch",
        entry,
        currentDocId
      };
    }

    let payload;
    try {
      payload = await readPayload(entry.fileName);
    } catch (error) {
      removeQueueEntry(batchId);
      return {
        status: "missing_payload",
        entry,
        error
      };
    }

    try {
      await placeImages(payload);
    } catch (error) {
      if (error?.code === "HOST_MODAL_STATE") {
        return {
          status: "host_modal_state",
          entry,
          error
        };
      }
      throw error;
    }

    await removeBatch(batchId);
    return {
      status: "placed",
      entry
    };
  }

  return {
    getPendingBatches,
    deferBatch,
    removeBatch,
    recoverBatch
  };
}

module.exports = {
  createDeferredBatchManager
};
