const test = require("node:test");
const assert = require("node:assert/strict");
const { renderBatchProgress } = require("../ui.js");

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
