#!/usr/bin/env bash
# Contrôle de l'appli dans un simulateur d'iPhone (workflow « Appli iPhone », lancé depuis mobile/ios/App).
#   bash ../../scripts/ios-sim-check.sh <UDID> <dossier App.app>
# La preuve est l'écran : le bouton orange « Se connecter » n'existe que si le jeu a démarré ET que le serveur a répondu à l'appli
# depuis capacitor://localhost. Un Mac de GitHub peut être lent : on attend le bouton, 120 s au plus, une capture toutes les 5 s.
# Tout reste dans sim/ (artefact). L'appli qui ne démarre pas est relancée UNE fois, et jamais s'il existe un rapport de plantage.
set -uo pipefail
UDID=$1; BUNDLE=$2
APP=fr.deepmineidle.app; MAX=120; REPORTS="$HOME/Library/Logs/DiagnosticReports"
mkdir -p sim/plantages
: > sim/console.txt

notice(){ echo "::notice title=$1::$2"; }
stop(){ echo "::error::$1"; report; exit 1; }
alive(){ xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "$APP"; }
crashes(){ ls "$REPORTS"/App[-_.]*.ips "$REPORTS"/App.ips 2>/dev/null; }
# tout ce qui sert à comprendre un arrêt, lisible dans l'artefact ; le type du plantage aussi dans les annotations
report(){
  cat sim/console-*.txt > sim/console.txt 2>/dev/null
  xcrun simctl spawn "$UDID" log show --last 5m --style compact --predicate 'process == "App" OR eventMessage CONTAINS "fr.deepmineidle.app"' > sim/journal.txt 2>&1
  for f in $(crashes); do
    cp "$f" sim/plantages/
    notice Plantage "$(basename "$f") : $(tr -d '\n' < "$f" | grep -o -E '"(exception|termination)" *: *\{[^}]*\}' | head -2 | tr -s ' ' | cut -c1-300)"
  done
}

xcrun simctl bootstatus "$UDID" -b > sim/bootstatus.txt 2>&1 || stop "le simulateur n'a pas fini de démarrer (voir bootstatus.txt)"
xcrun simctl install "$UDID" "$BUNDLE" > sim/installation.txt 2>&1 || stop "installation refusée : $(tail -1 sim/installation.txt | cut -c1-200)"
xcrun simctl get_app_container "$UDID" "$APP" app > /dev/null 2>&1 || stop "installation sans effet : l'appli n'est pas sur le simulateur"

# simctl reste attaché tant que l'appli tourne : s'il rend la main, c'est que le lancement a raté ou que l'appli s'est arrêtée
launch(){
  try=$1
  xcrun simctl launch --console "$UDID" "$APP" > "sim/console-$try.txt" 2>&1 &
  LP=$!
}
finished(){
  kill -0 "$LP" 2>/dev/null && return 1
  wait "$LP"; code=$?
  notice Lancement "essai $try : simctl launch a rendu le code $code : $(head -2 "sim/console-$try.txt" | tr '\n' ' ' | cut -c1-240)"
  return 0
}

try=1; launch 1
START=$(date +%s); FOUND=""; TRACE=""
while :; do
  t=$(( $(date +%s) - START ))
  shot="sim/ecran-$try-$(printf '%03d' "$t")s.png"
  xcrun simctl io "$UDID" screenshot "$shot" > /dev/null 2>&1 || true
  read -r orange colors light <<< "$(node ../../scripts/ios-screen.cjs "$shot")"
  TRACE="$TRACE $t s=$orange/$colors/$light"
  [ -f "$shot" ] && cp "$shot" sim/ecran.png
  [ "$orange" -gt 2000 ] && { FOUND=$t; break; }
  if finished && ! alive; then
    [ -z "$(crashes)" ] || { notice Ecran "temps=orange/couleurs/clarté :$TRACE"; stop "l'appli a planté (rapport dans plantages/)"; }
    if [ "$try" = 1 ]; then
      notice Relance "l'appli ne tourne pas, sans rapport de plantage : relancée une fois"
      TRACE="$TRACE relance"
      try=2; launch 2; START=$(date +%s)
      sleep 5; continue
    fi
    notice Ecran "temps=orange/couleurs/clarté :$TRACE"
    stop "l'appli ne démarre pas, même relancée"
  fi
  [ "$t" -ge "$MAX" ] && break
  sleep 5
done

notice Ecran "temps=orange/couleurs/clarté :$TRACE"
notice Serveur "$(curl -s -m 20 -o /dev/null -w 'réponse %{http_code} en %{time_total} s' https://deepmineidle.fr/api/game/info)"
cat sim/console-*.txt > sim/console.txt 2>/dev/null
errors=$(grep -c -E '\[error\]|Uncaught|SyntaxError|ReferenceError' sim/console.txt || true)
notice Simulateur "appli vivante : $(alive && echo oui || echo non) · essais : $try · erreurs JavaScript : $errors · lignes de console : $(wc -l < sim/console.txt | tr -d ' ')"
grep -E '\[error\]|Uncaught|SyntaxError|ReferenceError' sim/console.txt | head -3 | cut -c1-200 | while read -r l; do notice Erreur "$l"; done
alive || stop "l'appli s'est fermée dans le simulateur"
[ "$errors" = 0 ] || stop "erreurs JavaScript au démarrage"
[ -n "$(crashes)" ] && stop "rapport de plantage trouvé, même si l'appli tourne (voir plantages/)"
[ -n "$FOUND" ] || stop "le bouton Se connecter n'est pas apparu en $MAX s (captures dans l'artefact)"
notice Demarrage "bouton Se connecter visible après $FOUND s, essai $try"
