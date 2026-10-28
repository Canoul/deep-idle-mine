"""Icônes pixel 16×16 de l'interface -> src/ui/pxicons.js.

Source : Kenney 1-Bit Pack (CC0, scripts/assets/kenney-1bit.png). Chaque icône devient un petit SVG de carrés
(une suite de pixels = un rectangle) : nette à 2 ou 3 px par pixel, et coloriable en CSS (fill = currentColor).
Ajouter une icône : une ligne dans KENNEY (colonne, rangée de la planche), puis relancer.

    python scripts/build_pxicons.py
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(__file__)
SHEET = os.path.join(HERE, 'assets', 'kenney-1bit.png')
OUT = os.path.join(HERE, '..', 'src', 'ui', 'pxicons.js')

# nom -> (colonne, rangée) dans la planche 1-Bit (tuiles de 16 px)
KENNEY = {
    'house': (41, 16), 'pickaxe': (43, 5), 'bag': (47, 4), 'helmet': (36, 0), 'hammer': (37, 7), 'fire': (14, 10),
    'rock': (20, 5), 'gem': (23, 4), 'book': (45, 5), 'paper': (46, 5), 'sparkle': (36, 11), 'hourglass': (39, 12),
    'group': (44, 16), 'person': (43, 16), 'chest': (8, 6), 'skull': (34, 12), 'lock': (0, 10), 'key': (32, 11),
    'door': (0, 9), 'sword': (32, 8), 'shield': (37, 3), 'bubbles': (35, 11), 'ladder': (0, 6), 'sun': (27, 11),
    'arrow': (29, 20), 'target': (38, 12), 'feather': (29, 11), 'trophy': (40, 16), 'heart': (39, 10),
    'radiance': (28, 12),
    # états des mineurs et des mobs (28/10/2026, src/config.js EFFECTS)
    'daze': (29, 12), 'grab': (41, 1), 'alert': (35, 13), 'coin': (35, 16), 'heartbreak': (41, 10), 'moon': (47, 12),
    'horn': (37, 16), 'note': (39, 16), 'rocket': (34, 21), 'updown': (21, 21), 'ring': (45, 3), 'shrine': (21, 11),
    'crown': (43, 2), 'shout': (36, 13),
}


def runs(rows):
    """suites horizontales de pixels pleins -> chemin SVG compact"""
    d = []
    for y, row in enumerate(rows):
        x = 0
        while x < 16:
            if row[x]:
                x0 = x
                while x < 16 and row[x]: x += 1
                d.append(f'M{x0} {y}h{x - x0}v1h-{x - x0}z')
            else:
                x += 1
    return ''.join(d)


def main():
    sheet = Image.open(SHEET).convert('RGBA')
    icons = {}
    for name, (c, r) in KENNEY.items():
        tile = sheet.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16))
        icons[name] = runs([[tile.getpixel((x, y))[3] > 127 for x in range(16)] for y in range(16)])
    body = ('/* Icônes pixel 16×16 de l\'interface (Kenney 1-Bit Pack, CC0). Généré par scripts/build_pxicons.py : ne pas\n'
            '   modifier à la main. pxi(\'pickaxe\') renvoie un <svg> net qui prend la couleur du texte (currentColor). */\n'
            'const P = ' + json.dumps(icons, indent=0, ensure_ascii=False) + ';\n\n'
            'export const pxi = (name, cls = \'\') => P[name]\n'
            '  ? `<svg class="pi ${cls}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${P[name]}"/></svg>`\n'
            '  : \'\';\n'
            'export const PXI_NAMES = Object.keys(P);\n')
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(body)
    print(len(icons), 'icônes ->', os.path.relpath(OUT))


if __name__ == '__main__':
    main()
