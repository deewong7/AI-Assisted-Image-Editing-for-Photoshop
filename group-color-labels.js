const GROUP_COLOR_LABELS = Object.freeze([
  "none",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "violet",
  "gray"
]);

const DEFAULT_GROUP_COLOR_LABEL = "blue";

const ACTION_MANAGER_COLOR_MAP = Object.freeze({
  none: "none",
  red: "red",
  orange: "orange",
  yellow: "yellowColor",
  green: "grain",
  blue: "blue",
  violet: "violet",
  gray: "gray"
});

function normalizeGroupColorLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return GROUP_COLOR_LABELS.includes(normalized) ? normalized : DEFAULT_GROUP_COLOR_LABEL;
}

function toActionManagerColorValue(value) {
  const normalized = normalizeGroupColorLabel(value);
  return ACTION_MANAGER_COLOR_MAP[normalized] || ACTION_MANAGER_COLOR_MAP[DEFAULT_GROUP_COLOR_LABEL];
}

module.exports = {
  GROUP_COLOR_LABELS,
  DEFAULT_GROUP_COLOR_LABEL,
  normalizeGroupColorLabel,
  toActionManagerColorValue
};
