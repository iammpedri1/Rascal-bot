const fs = require("fs");
const path = require("path");

const logger = require("./logger");

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function backupCorruptFile(filePath) {
  const backupPath = `${filePath}.corrupt-${Date.now()}`;
  fs.renameSync(filePath, backupPath);
  return backupPath;
}

function readJson(filePath, fallback, isValid = value => value !== null && typeof value === "object") {
  ensureDirectory(filePath);

  if (!fs.existsSync(filePath)) {
    writeJson(filePath, fallback);
    return fallback;
  }

  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!isValid(value)) {
      throw new Error("estrutura JSON invalida");
    }
    return value;
  } catch (error) {
    let backupPath;
    try {
      backupPath = backupCorruptFile(filePath);
    } catch (backupError) {
      logger.error("Falha ao fazer backup de JSON invalido", backupError, { filePath });
    }

    logger.error("JSON invalido; armazenamento reinicializado", error, {
      filePath,
      backupPath,
    });
    writeJson(filePath, fallback);
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDirectory(filePath);
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const content = `${JSON.stringify(value, null, 2)}\n`;

  try {
    fs.writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      logger.error("Falha ao limpar arquivo temporario JSON", cleanupError, {
        temporaryPath,
      });
    }
    logger.error("Falha ao gravar JSON", error, { filePath });
    throw error;
  }
}

module.exports = {
  readJson,
  writeJson,
};
