const chalk = require("chalk");

function stamp() {
  return new Date().toISOString();
}

function info(message, meta = {}) {
  console.log(chalk.cyan(`[INFO ${stamp()}]`), message, meta);
}

function success(message, meta = {}) {
  console.log(chalk.green(`[OK ${stamp()}]`), message, meta);
}

function warn(message, meta = {}) {
  console.warn(chalk.yellow(`[WARN ${stamp()}]`), message, meta);
}

function error(message, err, meta = {}) {
  console.error(chalk.red(`[ERROR ${stamp()}]`), message, meta);
  if (err?.stack) console.error(chalk.red(err.stack));
  else if (err) console.error(chalk.red(String(err)));
}

module.exports = {
  error,
  info,
  success,
  warn,
};
