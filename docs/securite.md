# Sécurité de Deep Mine Idle

Point de situation après la revue du 22/10/2026 (Jules). À relire avant de toucher aux comptes, au serveur ou à
l'hébergement. Le détail technique de chaque correction est dans `docs/debug.md`.

## Ce qui est protégé, et comment

| Sujet | Protection |
|---|---|
| Mots de passe, codes de secours | Jamais stockés en clair : empreinte scrypt avec sel (`server/accounts/secrets.js`), comparaison à temps constant. |
| Connexion | Jeton aléatoire de 256 bits dans un cookie `HttpOnly`, `SameSite=Strict`, `Secure` en ligne. Le serveur n'en garde que l'empreinte. Changer ou récupérer son mot de passe coupe toutes les autres connexions. |
| Force brute | Limites de tentatives par pseudo et par adresse (connexion), par adresse (création de comptes), par compte (demandes d'ami, invitations, codes de groupe). |
| Deviner les pseudos | Un pseudo inexistant prend le même temps à vérifier qu'un vrai. |
| Formulaires piégés d'autres sites | L'API n'accepte que du JSON, et le cookie n'est jamais envoyé depuis un autre site. |
| Droits | Chaque route vérifie qui demande ; on n'agit que sur ses propres données (chef pour exclure, amis pour inviter / rejoindre…). Le serveur fait foi : le navigateur ne fait que demander. |
| Mode développeur | Activé seulement par le serveur (`npm run dev` / `DIM_DEV=1`), jamais par une requête. |
| Injections | Base : requêtes paramétrées uniquement. Page : tout texte venant d'un joueur est échappé, et un pseudo ne peut contenir que lettres, chiffres, « - », « _ ». |
| En-têtes | Politique de contenu stricte (seuls nos scripts, polices Google), pas d'affichage dans un cadre d'un autre site, `nosniff`, HSTS en https (`server/config.js`, `securityHeaders`). |
| Fichiers servis | Liste blanche : `index.html`, `wiki.html`, `src/`, `textures/`. Jamais `data/`, le code serveur, les scripts, la doc, `.git`. |
| Chat de session | Seuls les joueurs de la session encore présents lisent et écrivent ; nom donné par le serveur ; texte nettoyé (caractères de contrôle et d'inversion retirés, 200 caractères), un message par seconde, échappé à l'affichage. En mémoire seulement, effacé à la fin de la session. |
| Données personnelles | Le serveur ne garde ni e-mail ni adresse IP (les adresses ne servent qu'aux limites, en mémoire). Un compte public = ID, pseudo, date de création. |
| Économie | Suite anti-triche (`npm run test:anticheat`) : duplication, quantités invalides, demandes rejouées. |
| Serveur OVH | Jeu sur 127.0.0.1 derrière Caddy (https), utilisateur sans droits, service systemd verrouillé, pare-feu (22/80/443), fail2ban, mises à jour de sécurité automatiques, réglages (`/etc/deep-idle-mine.env`) lisibles par root seulement. |

## Règles à garder

- **Jamais de secret dans git** : l'adresse de la base (`DATABASE_URL`) vit seulement dans `/etc/deep-idle-mine.env`
  sur le serveur. Les fichiers `.env` sont ignorés par git.
- **Le dépôt GitHub est public** : tout ce qui est commité est lisible par tout le monde, joueurs compris (code,
  règles, anti-triche, journal). N'y mettez ni adresse IP, ni nom de VPS, ni e-mail, ni capture contenant un secret.
- **`main` = le jeu en ligne** : le serveur se met à jour seul depuis `main`. Quiconque peut pousser sur `main`
  contrôle le serveur. Comptes GitHub avec double authentification (2FA) obligatoire.
- **Toute nouvelle route** : vérifier `ctx.me`, valider chaque champ reçu, ne jamais faire confiance à un ID envoyé par
  le navigateur sans vérifier qu'il appartient au joueur.
- **Tout nouveau texte affiché** qui vient d'un joueur : passer par `esc(…)`.

## À faire (hors code)

- Activer la **protection de la branche `main`** sur GitHub (Settings → Branches) et la **2FA** sur les deux comptes.
- Si l'adresse de la base a pu fuiter un jour : changer le mot de passe dans Neon, puis mettre la nouvelle adresse
  dans `/etc/deep-idle-mine.env` et redémarrer le jeu.
- Vérifier que les **sauvegardes Neon** (restauration dans le temps) sont actives.
- Geoffrey : ses adresses e-mail (perso et pro) apparaissent dans les commits publics. Pour la suite, activer
  « Keep my email addresses private » dans GitHub et utiliser l'adresse `…@users.noreply.github.com` pour git.

## Administration (23/10/2026)
- `POST /api/admin/give` (donner un objet) : clé `DIM_ADMIN_TOKEN` (≥ 32 caractères) dans `/etc/deep-idle-mine.env`,
  jamais dans git ; acceptée seulement depuis la machine (127.0.0.1 / ::1) et sans en-tête de relais (donc jamais via
  Caddy) ; tout refus répond 404 comme une route inconnue. Sans clé réglée, l'administration est fermée.
