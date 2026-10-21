# ⛏ Deep Idle Mine

Idle game navigateur : un mineur autonome explore une mine 2D en blocs pendant des sessions de 1 h, rapporte des
ressources, et on s'en sert entre les sessions pour crafter et améliorer son stuff. Jusqu'à 3 joueurs par session.

**Jouer :** https://deepmineidle.fr/

## Lancer le jeu en local

Il faut Node 20 ou plus.

```
npm start        # jeu normal → http://localhost:8000
npm run dev      # mode développeur (vitesse ×300, seed, mineurs de test…)
```

## Travailler sur le jeu avec Claude

1. Ouvre Claude dans ce dossier et dis ce que tu veux faire. Claude lit `CLAUDE.md` et sait comment travailler.
2. Claude crée une branche à ton nom (ex. `jules/nouveau-mob`) : tu peux tester en local, **rien n'est en ligne**.
3. Quand c'est bon, dis-lui **« mets en ligne »** : il vérifie, fusionne dans `main`, et le site se met à jour
   tout seul en ~2 min.

⚠️ Ne jamais pousser directement sur `main` : c'est le jeu en ligne.

## Où trouver quoi

| Fichier | Contenu |
|---|---|
| [`docs/journal.md`](docs/journal.md) | **Où en est le jeu** : qui a fait quoi, ce qui est en ligne |
| [`GAME_DESIGN.md`](GAME_DESIGN.md) | Les règles du jeu (source de vérité) |
| [`CLAUDE.md`](CLAUDE.md) | Les consignes pour Claude (méthode, architecture, tests) |
| [`docs/debug.md`](docs/debug.md) | Journal technique des modifications et de leur vérification |
| [`docs/comptes.md`](docs/comptes.md) | Comptes joueur et sécurité |
| [`docs/deploiement-ovh.md`](docs/deploiement-ovh.md) | Hébergement (VPS OVH + PostgreSQL Neon) |
| `src/config.js` | Toutes les valeurs d'équilibrage |
