const { execFileSync } = require("child_process");
const fs = require("fs");

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
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
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
