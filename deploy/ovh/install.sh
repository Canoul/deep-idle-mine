#!/usr/bin/env bash
# Installe Deep Idle Mine sur un serveur loué (VPS OVHcloud ou autre), Ubuntu ou Debian.
# Usage (sur le serveur) :  sudo bash install.sh <adresse du site>
#   ex. sudo bash install.sh vps-1a2b3c4d.vps.ovh.net     (nom donné par OVH)
#       sudo bash install.sh jeu.mondomaine.fr            (ton nom de domaine, s'il pointe vers le serveur)
# Relançable sans risque : refait seulement ce qui manque, garde les réglages existants
# (/etc/deep-idle-mine.env). Pour changer d'adresse, relancer avec la nouvelle.
#
# Ce que ça installe :
#   - Node.js 24 et Caddy (proxy https : certificat gratuit et renouvelé tout seul) ;
#   - le jeu dans /opt/deep-idle-mine, lancé par l'utilisateur système « dim » (sans droits) ;
#   - le service deep-idle-mine (démarre avec le serveur, redémarre s'il plante) ;
#   - la mise à jour automatique : toutes les 2 min, si la branche main a changé sur GitHub ;
#   - le pare-feu : seuls SSH (22), http (80) et https (443) sont ouverts. Le jeu écoute sur 127.0.0.1:8000,
#     joignable uniquement par Caddy ;
#   - fail2ban (bloque les adresses qui essaient des mots de passe SSH en boucle) et les mises à jour de
#     sécurité automatiques du système.
set -euo pipefail

main() {
  local SITE="${1:-}"
  local REPO="https://github.com/Canoul/deep-idle-mine.git"
  local APP_DIR="/opt/deep-idle-mine"
  local APP_HOME="/var/lib/deep-idle-mine"
  local ENV_FILE="/etc/deep-idle-mine.env"

  [ "$(id -u)" = 0 ] || die "Lance le script avec sudo : sudo bash install.sh <adresse>"
  [ -n "$SITE" ] || die "Il manque l'adresse du site. Exemple : sudo bash install.sh vps-1a2b3c4d.vps.ovh.net"
  [[ "$SITE" =~ ^[A-Za-z0-9.-]+$ ]] || die "Adresse invalide : « $SITE » (juste le nom, sans https:// ni /)"
  . /etc/os-release
  case "$ID" in ubuntu|debian) ;; *) die "Système non prévu ($ID) : Ubuntu ou Debian seulement." ;; esac

  step "Paquets de base"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -q
  apt-get install -y -q curl git ca-certificates gnupg ufw unattended-upgrades fail2ban \
    debian-keyring debian-archive-keyring apt-transport-https

  step "Node.js"
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y -q nodejs
  fi
  echo "Node $(node -v)"

  step "Caddy (https)"
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      -o /etc/apt/sources.list.d/caddy-stable.list
    chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -q
    apt-get install -y -q caddy
  fi

  step "Utilisateur « dim » et code du jeu"
  id -u dim >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_HOME" --shell /usr/sbin/nologin dim
  mkdir -p "$APP_HOME/data"
  chown -R dim:dim "$APP_HOME"
  if [ ! -d "$APP_DIR/.git" ]; then
    git clone -q "$REPO" "$APP_DIR"
  fi
  chown -R dim:dim "$APP_DIR"
  as_dim git -C "$APP_DIR" fetch -q origin main
  as_dim git -C "$APP_DIR" reset -q --hard origin/main
  (cd "$APP_DIR" && as_dim npm ci --cache /var/lib/deep-idle-mine/.npm --omit=dev --no-audit --no-fund --loglevel=error)
  echo "Version : $(as_dim git -C "$APP_DIR" log -1 --format='%h %s')"

  step "Réglages ($ENV_FILE)"
  if [ ! -f "$ENV_FILE" ]; then
    local DB_URL=""
    echo "Colle l'adresse de connexion Neon (DATABASE_URL), puis Entrée."
    echo "Elle ne s'affiche pas pendant la saisie, c'est normal. Entrée seule = sans base (fichiers sur le serveur)."
    read -rsp "> " DB_URL </dev/tty || true
    echo
    umask 077
    cat > "$ENV_FILE" <<EOF
# Réglages de Deep Idle Mine. Après une modification : sudo systemctl restart deep-idle-mine
PORT=8000
# le jeu n'écoute que sur la machine : seul Caddy (https) peut le joindre
DIM_HOST=127.0.0.1
# un relais devant le jeu (Caddy) : l'adresse du joueur est la dernière de X-Forwarded-For
DIM_TRUST_PROXY=1
# jeu servi en https : cookie de connexion « Secure »
DIM_SECURE_COOKIE=1
# sessions de jeu en même temps (chacune occupe ~4 % d'un cœur)
DIM_MAX_LIVE=24
# utilisé seulement sans DATABASE_URL
DIM_DATA_DIR=$APP_HOME/data
EOF
    if [ -n "$DB_URL" ]; then
      printf 'DATABASE_URL=%s\n' "$DB_URL" >> "$ENV_FILE"
    else
      printf '# DATABASE_URL=postgresql://...\n' >> "$ENV_FILE"
    fi
    umask 022
  else
    echo "Déjà présent, gardé tel quel."
  fi
  chown root:root "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  step "Services"
  install -m 644 "$APP_DIR/deploy/ovh/deep-idle-mine.service"        /etc/systemd/system/
  install -m 644 "$APP_DIR/deploy/ovh/deep-idle-mine-update.service" /etc/systemd/system/
  install -m 644 "$APP_DIR/deploy/ovh/deep-idle-mine-update.timer"   /etc/systemd/system/
  # copie fixe : le script de mise à jour (lancé en root) ne change pas avec le dépôt
  install -m 755 "$APP_DIR/deploy/ovh/update.sh" /usr/local/sbin/deep-idle-mine-update
  systemctl daemon-reload
  systemctl enable -q deep-idle-mine deep-idle-mine-update.timer
  systemctl restart deep-idle-mine
  systemctl start deep-idle-mine-update.timer

  step "Caddy : https://$SITE"
  sed "s/__SITE__/$SITE/" "$APP_DIR/deploy/ovh/Caddyfile" > /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  systemctl enable -q caddy
  systemctl reload caddy 2>/dev/null || systemctl restart caddy

  step "Pare-feu"
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  ufw status | sed -n '1,12p'
  systemctl enable -q --now fail2ban unattended-upgrades

  step "Vérification"
  sleep 3
  if systemctl is-active -q deep-idle-mine; then
    journalctl -u deep-idle-mine -n 5 --no-pager -o cat
    echo
    echo "C'est en ligne : https://$SITE"
    echo "(le certificat https peut mettre 1 minute à arriver la toute première fois)"
  else
    journalctl -u deep-idle-mine -n 30 --no-pager -o cat
    die "Le jeu ne démarre pas : voir le journal ci-dessus."
  fi
}

# commande lancée en tant que « dim » (git et npm écrivent dans son dossier, pas dans celui de root)
as_dim() { runuser -u dim -- env HOME=/var/lib/deep-idle-mine "$@"; }
step() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mErreur : %s\033[0m\n' "$*" >&2; exit 1; }

main "$@"
