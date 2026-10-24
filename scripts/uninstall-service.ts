import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (process.platform === "linux") {
  const script = resolve(process.cwd(), "scripts/uninstall-linux-service.sh");
  const result = spawnSync("bash", [script], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} else if (process.platform === "win32") {
  const { Service } = require("node-windows");
  const service = new Service({
    name: "discord-bot",
    script: resolve(process.cwd(), "dist/index.js"),
    workingDirectory: process.cwd(),
  });
  service.on("uninstall", () => console.log("Serviço discord-bot removido."));
  service.on("alreadyuninstalled", () => console.log("Serviço discord-bot já estava removido."));
  service.on("error", (error: Error) => {
    console.error("Falha ao remover serviço do Windows", error);
    process.exitCode = 1;
  });
  service.uninstall();
} else {
  console.error(`Remoção de serviço não suportada em ${process.platform}.`);
  process.exitCode = 1;
}
