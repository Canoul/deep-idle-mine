#!/usr/bin/env node
/* Lance le serveur en MODE DÉVELOPPEUR (npm run dev) : toutes les vitesses, panneau dev, fin de session libre.
   Uniquement sur sa machine : jamais pour un serveur en ligne. */
process.env.DIM_DEV = '1';
await import('./main.js');
