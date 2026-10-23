function stamp() {
  return new Date().toISOString();
}

const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const currentLevel = LEVELS[String(process.env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;

function enabled(level) {
  return currentLevel >= LEVELS[level];
}

function debug(message, meta = {}) {
  if (enabled("debug")) console.log(`[DEBUG ${stamp()}]`, message, meta);
}

function info(message, meta = {}) {
  if (enabled("info")) console.log(`[INFO ${stamp()}]`, message, meta);
}

function success(message, meta = {}) {
  if (enabled("info")) console.log(`[OK ${stamp()}]`, message, meta);
}

function warn(message, meta = {}) {
  if (enabled("warn")) console.warn(`[WARN ${stamp()}]`, message, meta);
}

function error(message, err, meta = {}) {
  if (!enabled("error")) return;
  console.error(`[ERROR ${stamp()}]`, message, meta);
  if (err?.stack) console.error(err.stack);
  else if (err) console.error(String(err));
}

module.exports = {
  debug,
  error,
  info,
  success,
  warn,
};
