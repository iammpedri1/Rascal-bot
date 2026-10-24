#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js não foi encontrado no PATH desta sessão. Instale Node.js 22+ e tente novamente."
  exit 1
fi
NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 22 )); then
  echo "Este bot exige Node.js 22+. Encontrado: $("$NODE_BIN" --version)"
  exit 1
fi
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "Arquivo .env ausente em $APP_DIR. Configure DISCORD_TOKEN e GUILD_ID antes de instalar o serviço."
  exit 1
fi
if [[ ! -f "$APP_DIR/dist/index.js" ]]; then
  echo "Build ausente. Execute npm run build antes da instalação."
  exit 1
fi

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$UNIT_DIR/rascal-bot.service"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_FILE" <<UNIT
[Unit]
Description=Rascal Discord Bot
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=3

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=SERVICE_HOST=systemd-linux
Environment=NODE_OPTIONS=--max-old-space-size=512
MemoryMax=1G
ExecStart=$NODE_BIN $APP_DIR/dist/index.js
Restart=on-failure
RestartSec=8
KillSignal=SIGINT
TimeoutStopSec=30
UMask=0077

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now rascal-bot.service
systemctl --user --no-pager --full status rascal-bot.service

if command -v loginctl >/dev/null 2>&1; then
  LINGER="$(loginctl show-user "$USER" -p Linger --value 2>/dev/null || echo no)"
  if [[ "$LINGER" != "yes" ]]; then
    echo
    echo "Para manter o serviço ativo após sair da sessão e após reiniciar o PC, execute:"
    echo "sudo loginctl enable-linger $USER"
  fi
fi

echo
echo "Logs: journalctl --user -u rascal-bot -f"
