const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const forbiddenPaths = [
  /^\.env(?:\..*)?$/,
  /^node_modules[\\/]/,
  /^data[\\/].*\.(?:sqlite|sqlite-\w*|json)$/i,
  /(?:^|[\\/]).*\.log$/i,
];

const secretPatterns = [
  { name: "Discord bot token", pattern: /[MN][A-Za-z\d_-]{23,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}/ },
  { name: "Discord env token", pattern: /DISCORD_TOKEN\s*=\s*["']?\S+/ },
  { name: "Gemini API key", pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: "generic secret assignment", pattern: /(TOKEN|API_KEY|SECRET|PASSWORD|SENHA)\s*=\s*["']?[^\s"']{12,}/i },
];

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;

    console.warn("git nao esta disponivel; executando verificacao em todos os arquivos do projeto.");
    const files = [];
    const ignoredDirectories = new Set([".git", "node_modules"]);

    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          files.push(path.relative(process.cwd(), fullPath));
        }
      }
    }

    walk(process.cwd());
    return files;
  }
}

function isForbiddenPath(file) {
  if (file === ".env.example") return false;
  return forbiddenPaths.some(pattern => pattern.test(file));
}

function isTextFile(file) {
  try {
    const buffer = fs.readFileSync(file);
    return !buffer.includes(0);
  } catch {
    return false;
  }
}

const files = trackedFiles();
const problems = [];

for (const file of files) {
  if (isForbiddenPath(file)) {
    problems.push(`arquivo sensivel rastreado: ${file}`);
    continue;
  }

  if (file === ".env.example") continue;
  if (!isTextFile(file)) continue;

  const content = fs.readFileSync(file, "utf8");
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) {
      problems.push(`${rule.name} encontrado em ${file}`);
    }
  }
}

if (problems.length) {
  console.error("Falha na verificacão de segurança:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log("Verificacão de segurança ok.");
