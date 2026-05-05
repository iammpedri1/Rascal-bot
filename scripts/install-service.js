const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "discord-bot",
  description: "Discord bot running as a Windows service.",
  script: path.join(__dirname, "..", "index.js"),
  workingDirectory: path.join(__dirname, ".."),
  env: [
    {
      name: "SERVICE_HOST",
      value: "node-windows",
    },
  ],
});

svc.on("install", () => {
  console.log("Servico instalado. Iniciando discord-bot...");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("Servico discord-bot ja esta instalado.");
});

svc.on("start", () => {
  console.log("Servico discord-bot iniciado.");
});

svc.on("error", err => {
  console.error("Erro no servico discord-bot:", err);
  process.exitCode = 1;
});

svc.install();
