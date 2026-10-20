#!/usr/bin/env bash
# Met le jeu à jour depuis GitHub (branche main) et le redémarre, seulement si quelque chose a changé.
# Lancé toutes les 2 min par deep-idle-mine-update.timer. À la main : sudo deep-idle-mine-update
# (--force : redémarre même sans changement).
# Installé par install.sh dans /usr/local/sbin (copie fixe : un push ne peut pas changer ce qui tourne en root).
set -euo pipefail

main() {
  local APP_DIR="/opt/deep-idle-mine"
  local FORCE="${1:-}"
  cd "$APP_DIR"

  as_dim git fetch -q origin main
  local OLD NEW
  OLD="$(as_dim git rev-parse HEAD)"
  NEW="$(as_dim git rev-parse origin/main)"
  if [ "$OLD" = "$NEW" ] && [ "$FORCE" != "--force" ]; then exit 0; fi

  local OLD_LOCK
  OLD_LOCK="$(sha256sum package-lock.json 2>/dev/null || true)"
  as_dim git reset -q --hard origin/main
  if [ "$OLD_LOCK" != "$(sha256sum package-lock.json 2>/dev/null || true)" ] || [ ! -d node_modules ]; then
    as_dim npm ci --cache /var/lib/deep-idle-mine/.npm --omit=dev --no-audit --no-fund --loglevel=error
  fi

  systemctl restart deep-idle-mine
  echo "Mis à jour : ${OLD:0:7} -> $(as_dim git log -1 --format='%h %s')"
}

as_dim() { runuser -u dim -- env HOME=/var/lib/deep-idle-mine "$@"; }

main "$@"
