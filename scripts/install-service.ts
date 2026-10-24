import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (process.platform === "linux") {
  const script = resolve(process.cwd(), "scripts/install-linux-service.sh");
  const result = spawnSync("bash", [script], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} else if (process.platform === "win32") {
  const path = require("node:path");
  const { Service } = require("node-windows");
  const service = new Service({
    name: "discord-bot",
    description: "Rascal Discord Bot",
    script: path.join(__dirname, "..", "index.js"),
    workingDirectory: process.cwd(),
    env: [
      { name: "NODE_ENV", value: "production" },
      { name: "NODE_OPTIONS", value: "--max-old-space-size=512" },
    ],
  });
  service.on("install", () => service.start());
  service.on("alreadyinstalled", () => console.log("Serviço discord-bot já está instalado."));
  service.on("error", (error: Error) => {
    console.error("Falha ao instalar serviço do Windows", error);
    process.exitCode = 1;
  });
  service.install();
} else {
  console.error(`Instalação de serviço não suportada em ${process.platform}.`);
  process.exitCode = 1;
}
