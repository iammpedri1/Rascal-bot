#!/usr/bin/env bash
set -euo pipefail
UNIT_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/rascal-bot.service"
systemctl --user disable --now rascal-bot.service 2>/dev/null || true
rm -f "$UNIT_FILE"
systemctl --user daemon-reload
systemctl --user reset-failed rascal-bot.service 2>/dev/null || true
echo "Serviço de usuário rascal-bot removido. Dados e .env foram preservados."
