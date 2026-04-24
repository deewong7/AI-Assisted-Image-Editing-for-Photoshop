const test = require("node:test");
const assert = require("node:assert/strict");
const { renderBatchProgress, renderDeferredBatchPlacements } = require("../ui.js");

test.describe("renderBatchProgress", () => {
  test("renders batch completion progress for active parallel batches", () => {
    const ui = {
      jobCount: {
        style: { display: "none" },
        textContent: ""
      }
    };

    renderBatchProgress(ui, 2, 4);

    assert.equal(ui.jobCount.style.display, "");
    assert.equal(ui.jobCount.textContent, "Batch Progress: 2/4");
  });

  test("hides progress when batch mode is not active", () => {
    const ui = {
      jobCount: {
        style: { display: "" },
        textContent: "Batch Progress: 1/4"
      }
    };

    renderBatchProgress(ui, 0, 0);

    assert.equal(ui.jobCount.style.display, "none");
    assert.equal(ui.jobCount.textContent, "");
  });
});

test.describe("renderDeferredBatchPlacements", () => {
  test("renders deferred batch rows with document info and counts", () => {
    const ui = {
      deferredBatchList: {
        style: { display: "none" },
        innerHTML: ""
      }
    };

    renderDeferredBatchPlacements(ui, [{
      id: "batch-1",
      docName: "Poster.psd",
      successCount: 3,
      requestedCount: 4
    }]);

    assert.equal(ui.deferredBatchList.style.display, "");
    assert.match(ui.deferredBatchList.innerHTML, /Poster\.psd/);
    assert.match(ui.deferredBatchList.innerHTML, /3\/4/);
    assert.match(ui.deferredBatchList.innerHTML, /sp-label class="deferredBatchText"/);
    assert.match(ui.deferredBatchList.innerHTML, /data-batch-id="batch-1"/);
  });

  test("hides the deferred batch list when there is nothing pending", () => {
    const ui = {
      deferredBatchList: {
        style: { display: "" },
        innerHTML: "stale"
      }
    };

    renderDeferredBatchPlacements(ui, []);

    assert.equal(ui.deferredBatchList.style.display, "none");
    assert.equal(ui.deferredBatchList.innerHTML, "");
  });
});
