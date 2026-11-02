"""Icône de l'appli mobile -> mobile/assets/logo.png, la source de `cd mobile && npm run assets`.

Source unique : mobile/assets/icon-art.png, la lampe de mine en pixel art sur une grille de 64 × 64 (choix de Jules,
01/11/2026 : image faite avec Gemini, remise sur une vraie grille de pixels, voir docs/debug.md). Agrandie d'un facteur
ENTIER au plus proche voisin (pixels nets), puis réduite par moyenne si la taille voulue n'est pas un multiple de 64.
Écrit mobile/assets/logo.png (1024 × 1024, opaque) ; ensuite `cd mobile && npm run assets` (Capacitor Assets) en tire
les icônes Android et iPhone et les écrans de démarrage (docs/app-android.md).
Les visuels des stores (scripts/gen_store_art.py) reprennent la même icône.

    python scripts/gen_app_icon.py      (ou npm run app:icon)
"""
import math
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
ART = os.path.join(ROOT, 'mobile', 'assets', 'icon-art.png')
LOGO = os.path.join(ROOT, 'mobile', 'assets', 'logo.png')


def icon(size):
    """l'icône carrée, opaque, en size × size"""
    art = Image.open(ART).convert('RGBA')
    k = math.ceil(size / art.width)
    img = art.resize((art.width * k, art.height * k), Image.NEAREST)
    return img if img.width == size else img.resize((size, size), Image.BOX)


def main():
    icon(1024).convert('RGB').save(LOGO)
    print('Icône écrite :', os.path.relpath(LOGO, ROOT), '; ensuite : cd mobile && npm run assets')


if __name__ == '__main__':
    main()
