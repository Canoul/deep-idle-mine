"""Icône de l'appli mobile -> mobile/ (projets Android et iOS de Capacitor, et une grande image).

Source unique : mobile/assets/icon-art.png, la lampe de mine en pixel art sur une grille de 64 × 64 (choix de Jules,
01/11/2026 : image faite avec Gemini, remise sur une vraie grille de pixels, voir docs/debug.md). Agrandie d'un facteur
ENTIER au plus proche voisin (pixels nets), puis réduite par moyenne si la taille voulue n'est pas un multiple de 64.
Écrit, pour chaque densité Android :
  - ic_launcher.png (icône classique) et ic_launcher_round.png (la même, découpée en disque) ;
  - ic_launcher_foreground.png (avant-plan de l'icône adaptative : l'icône entière sur la partie visible, 72 px sur 108,
    que le téléphone découpe en rond ou en carré arrondi) ; le fond, couleur du bord de l'icône, vient de
    values/ic_launcher_background.xml, réécrit ici ;
puis mobile/assets/icon-1024.png, et l'icône de l'iPhone (1024 px sans transparence) quand le projet iOS est là.
Les visuels des stores (scripts/gen_store_art.py) reprennent la même icône.

    python scripts/gen_app_icon.py      (ou npm run app:icon)
"""
import math
import os
import statistics
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
ART = os.path.join(ROOT, 'mobile', 'assets', 'icon-art.png')
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
BIG = os.path.join(ROOT, 'mobile', 'assets', 'icon-1024.png')
# iPhone : une seule image 1024 × 1024, sans transparence (Apple la refuse) ; l'iPhone arrondit les coins lui-même
IOS = os.path.join(ROOT, 'mobile', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png')

# densité -> (icône classique, avant-plan adaptatif), en px
DENSITIES = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
VISIBLE = 72 / 108             # icône adaptative : part visible de l'avant-plan (le reste ne se voit que s'il bouge)


def icon(size):
    """l'icône carrée, opaque, en size × size"""
    art = Image.open(ART).convert('RGBA')
    k = math.ceil(size / art.width)
    img = art.resize((art.width * k, art.height * k), Image.NEAREST)
    return img if img.width == size else img.resize((size, size), Image.BOX)


def edge_color():
    """couleur du bord de l'icône (médiane du tour), en #rrggbb"""
    art = Image.open(ART).convert('RGB')
    n = art.width - 1
    edge = [art.getpixel(p) for i in range(art.width) for p in ((i, 0), (i, n), (0, i), (n, i))]
    return '#' + ''.join(f'{int(statistics.median(c[k] for c in edge)):02x}' for k in range(3))


def round_crop(img):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    for d, (size, fg) in DENSITIES.items():
        folder = os.path.join(RES, f'mipmap-{d}')
        square = icon(size)
        square.save(os.path.join(folder, 'ic_launcher.png'))
        round_crop(square).save(os.path.join(folder, 'ic_launcher_round.png'))
        front = Image.new('RGBA', (fg, fg), (0, 0, 0, 0))
        inner = icon(round(fg * VISIBLE))
        front.alpha_composite(inner, ((fg - inner.width) // 2, (fg - inner.height) // 2))
        front.save(os.path.join(folder, 'ic_launcher_foreground.png'))
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{edge_color()}</color>\n</resources>\n')
    icon(1024).save(BIG)
    written = [RES, BIG]
    if os.path.isdir(os.path.dirname(IOS)):
        icon(1024).convert('RGB').save(IOS)
        written.append(IOS)
    print('Icône écrite :', ', '.join(os.path.relpath(p, ROOT) for p in written))


if __name__ == '__main__':
    main()
