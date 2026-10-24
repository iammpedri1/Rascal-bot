#!/usr/bin/env bash
set -euo pipefail

if ! command -v flatpak >/dev/null 2>&1; then
  echo "Flatpak não está instalado. No Linux Mint, execute: sudo apt-get install -y flatpak"
  exit 1
fi

flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user --noninteractive -y flathub org.vinegarhq.Sober

CONFIG="$HOME/.var/app/org.vinegarhq.Sober/config/sober/config.json"
if [[ -f "$CONFIG" ]]; then
  python3 - "$CONFIG" <<'PY'
import json, re, sys
from pathlib import Path
p = Path(sys.argv[1])
s = re.sub(r'(?m)^\s*//.*$', '', p.read_text())
try:
    config = json.loads(s)
except Exception:
    print("Configuração preexistente não foi regravada. Ajuste pelo menu Settings do Sober.")
else:
    print("Config atual:", {
        "graphics_optimization_mode": config.get("graphics_optimization_mode"),
        "enable_gamemode": config.get("enable_gamemode"),
        "use_opengl": config.get("use_opengl"),
    })
    print("Para este PC, mantenha Performance + GameMode. Vulkan só deve ser ativado após validar o driver Radeon no desktop.")
PY
fi

echo "Sober instalado para este usuário. Abra-o no menu de aplicativos e use a instalação automática do Roblox; entre na conta manualmente."
