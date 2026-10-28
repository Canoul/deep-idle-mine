"""Icône de l'appli mobile -> mobile/ (projet Android de Capacitor, et une grande image pour iOS et les stores).

La pioche en acier du jeu (textures/pickaxe_steel.png, 16 × 16) agrandie d'un facteur ENTIER au plus proche voisin
(pixels nets), centrée sur le fond de la Forge noire. Écrit, pour chaque densité Android :
  - ic_launcher.png (icône classique) et ic_launcher_round.png (la même, découpée en disque) ;
  - ic_launcher_foreground.png (avant-plan de l'icône adaptative, fond transparent : la pioche reste dans la zone
    sûre, 66 px sur 108) ; le fond vient de values/ic_launcher_background.xml, réécrit ici.

    python scripts/gen_app_icon.py      (ou npm run app:icon)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'textures', 'pickaxe_steel.png')
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
BIG = os.path.join(ROOT, 'mobile', 'assets', 'icon-1024.png')
BG = '#191310'                 # fond des panneaux de la Forge noire (scripts/gen_ui.py, C['fill'])

# densité -> (icône classique, avant-plan adaptatif), en px
DENSITIES = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
ICON_SHARE = 0.6               # part du côté occupée par la pioche, icône classique
FG_SHARE = 0.5                 # avant-plan adaptatif : dans la zone sûre (66 / 108 ≈ 0,61)


def pickaxe(size, share):
    """la pioche (sans les marges vides de la texture) agrandie d'un facteur entier, au plus près de share × size"""
    src = Image.open(SRC).convert('RGBA')
    src = src.crop(src.getbbox())
    k = max(1, int(size * share // max(src.size)))
    return src.resize((src.width * k, src.height * k), Image.NEAREST)


def centered(size, share, background):
    img = Image.new('RGBA', (size, size), background)
    p = pickaxe(size, share)
    img.alpha_composite(p, ((size - p.width) // 2, (size - p.height) // 2))
    return img


def round_crop(img):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    for d, (icon, fg) in DENSITIES.items():
        folder = os.path.join(RES, f'mipmap-{d}')
        square = centered(icon, ICON_SHARE, BG)
        square.save(os.path.join(folder, 'ic_launcher.png'))
        round_crop(square).save(os.path.join(folder, 'ic_launcher_round.png'))
        centered(fg, FG_SHARE, (0, 0, 0, 0)).save(os.path.join(folder, 'ic_launcher_foreground.png'))
    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                f'    <color name="ic_launcher_background">{BG}</color>\n</resources>\n')
    os.makedirs(os.path.dirname(BIG), exist_ok=True)
    centered(1024, ICON_SHARE, BG).save(BIG)
    print('Icône écrite :', os.path.relpath(RES, ROOT), 'et', os.path.relpath(BIG, ROOT))


if __name__ == '__main__':
    main()
