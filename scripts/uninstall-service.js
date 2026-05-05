const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "discord-bot",
  script: path.join(__dirname, "..", "index.js"),
  workingDirectory: path.join(__dirname, ".."),
});

svc.on("uninstall", () => {
  console.log("Servico discord-bot removido.");
});

svc.on("alreadyuninstalled", () => {
  console.log("Servico discord-bot nao esta instalado.");
});

svc.on("error", err => {
  console.error("Erro ao remover o servico discord-bot:", err);
  process.exitCode = 1;
});

svc.uninstall();
