const BATCH_COUNT_MIN = 1;
const BATCH_COUNT_HARD_MAX = 16;
const DEFAULT_MAX_BATCH_COUNT = 8;

function clampMaxBatchCount(value) {
  return Math.min(BATCH_COUNT_HARD_MAX, Math.max(BATCH_COUNT_MIN, Number(value) || DEFAULT_MAX_BATCH_COUNT));
}

function clampBatchCount(value, maxBatchCount = DEFAULT_MAX_BATCH_COUNT) {
  return Math.min(clampMaxBatchCount(maxBatchCount), Math.max(BATCH_COUNT_MIN, Number(value) || BATCH_COUNT_MIN));
}

module.exports = {
  BATCH_COUNT_MIN,
  BATCH_COUNT_HARD_MAX,
  DEFAULT_MAX_BATCH_COUNT,
  clampMaxBatchCount,
  clampBatchCount
};
