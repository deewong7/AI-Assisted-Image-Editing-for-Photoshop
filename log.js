const { getCurrentTime } = require("./utils");

function createLogger(ui = {}) {
  const logArea = ui.logArea;
  const logAreas = ui.logAreas;

  function getLogArea() {
    return logArea || document.getElementById("log");
  }

  function getLogAreas() {
    return logAreas || document.getElementsByClassName("logArea");
  }

  function logLine(...text) {
    let result;
    if (text.length > 1) {
      result = text.join(" ");
    } else {
      result = text[0];
    }

    if (typeof result === "string") {
      result = getCurrentTime() + " " + result;
      const target = getLogArea();
      if (target) {
        target.value = result + "\n" + target.value;
      }
    }
  }

  function clearLog() {
    const target = getLogArea();
    if (target) {
      target.value = "";
    }
  }

  function toggleLog(hide) {
    const targets = getLogAreas();
    for (const el of targets) {
      el.style.display = hide ? "none" : "";
    }
  }

  return {
    logLine,
    clearLog,
    toggleLog
  };
}

module.exports = {
  createLogger
};
