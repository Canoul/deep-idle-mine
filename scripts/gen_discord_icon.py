"""Icône du serveur Discord -> bot/assets/icone-serveur.png (512 × 512, à téléverser dans Discord).

Volontairement différente de l'icône de l'appli (la lampe de mine, scripts/gen_app_icon.py). Dessinée avec les vraies
textures du jeu (textures/*.png) sur une grille de 128 × 128, agrandie ×4 au plus proche voisin (pixels nets).
Discord découpe l'icône en rond : tout ce qui compte reste dans le cercle central.

    python scripts/gen_discord_icon.py                  l'icône retenue (VARIANTE)
    python scripts/gen_discord_icon.py --toutes <dossier>  toutes les variantes + une planche de comparaison
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'bot', 'assets', 'icone-serveur.png')
GRID = 128            # taille de la grille de pixels
SCALE = 4             # 128 × 4 = 512, la taille conseillée par Discord
VARIANTE = 'chevalement'


def tex(name, k=1, mirror=False):
    """une texture du jeu, agrandie ×k au plus proche voisin"""
    img = Image.open(os.path.join(ROOT, 'textures', name + '.png')).convert('RGBA')
    if mirror:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img.resize((img.width * k, img.height * k), Image.NEAREST) if k != 1 else img


def put(canvas, img, x, y):
    canvas.alpha_composite(img, (x, y))


def gradient(top, bottom, h0=0, h1=GRID):
    """dégradé vertical par bandes de 4 pixels (aspect pixel art, pas de dégradé lisse)"""
    img = Image.new('RGBA', (GRID, GRID), bottom + (255,))
    d = ImageDraw.Draw(img)
    for y in range(h0, h1, 4):
        t = (y - h0) / max(1, h1 - h0 - 4)
        c = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        d.rectangle((0, y, GRID - 1, y + 3), fill=c + (255,))
    return img


def tile(canvas, name, x0, y0, cols, rows):
    t = tex(name)
    for j in range(rows):
        for i in range(cols):
            put(canvas, t, x0 + i * 16, y0 + j * 16)


def ring(canvas, color, dark, r=61):
    """anneau pixel art qui épouse le découpage rond de Discord"""
    d = ImageDraw.Draw(canvas)
    c = GRID / 2 - 0.5
    for y in range(GRID):
        for x in range(GRID):
            dist = ((x - c) ** 2 + (y - c) ** 2) ** 0.5
            if r - 3 <= dist < r - 1:
                d.point((x, y), fill=color + (255,))
            elif r - 1 <= dist < r or r - 4 <= dist < r - 3:
                d.point((x, y), fill=dark + (255,))


def stars(canvas, points, color=(255, 236, 190)):
    d = ImageDraw.Draw(canvas)
    for x, y in points:
        d.point((x, y), fill=color + (255,))


# --- Variante A : deux pioches croisées au-dessus d'un bloc de diamant -------------------------------------------
def pioches():
    c = gradient((52, 40, 66), (16, 12, 22))
    put(c, tex('pickaxe_mithril', 4), 42, 14)
    put(c, tex('pickaxe_nemesis', 4, mirror=True), 22, 14)
    put(c, tex('diamond', 2), 48, 78)
    ring(c, (214, 168, 74), (84, 56, 24))
    return c


# --- Variante B : coupe de la mine, le puits descend jusqu'au mineur ----------------------------------------------
def coupe():
    c = gradient((246, 150, 92), (120, 72, 120), 0, 16)
    stars(c, [(20, 6), (98, 4), (110, 10)])
    tile(c, 'grass', 0, 16, 8, 1)
    tile(c, 'dirt', 0, 32, 8, 1)
    rows = [['stone', 'coal', 'stone', None, 'stone', 'iron', 'stone', 'stone'],
            ['iron', 'stone', 'hardstone', None, 'gold', 'stone', 'cobalt', 'hardstone'],
            ['hardstone', 'mithril', 'hardstone', None, 'hardstone', 'hardstone', 'diamond', 'hardstone'],
            ['hellstone', 'hellstone', None, None, None, 'hellstone', 'hellstone', 'hellstone'],
            ['hellstone'] * 8]
    for j, row in enumerate(rows):
        for i, name in enumerate(row):
            put(c, tex(name or 'tunnel'), i * 16, 48 + j * 16)
    put(c, tex('tunnel'), 48, 16)
    put(c, tex('tunnel'), 48, 32)
    put(c, tex('winch_top'), 48, 0)
    for y in range(16, 112, 16):
        put(c, tex('ladder'), 48, y)
    put(c, tex('torch'), 32, 96)
    put(c, tex('miner'), 64, 96)
    return c


# --- Variante C : le chevalement au crépuscule, au-dessus du puits qui s'enfonce ---------------------------------
def chevalement():
    c = gradient((44, 30, 70), (236, 128, 76), 0, 100)
    stars(c, [(18, 30), (30, 18), (100, 22), (112, 36), (88, 12), (40, 40)])
    put(c, tex('town_headframe'), 24, 0)
    tile(c, 'grass', 0, 100, 8, 1)
    tile(c, 'dirt', 0, 116, 8, 1)
    put(c, tex('tunnel'), 56, 100)
    put(c, tex('tunnel'), 56, 116)
    put(c, tex('ladder'), 56, 108)
    return c


VARIANTES = {'pioches': pioches, 'coupe': coupe, 'chevalement': chevalement}


def icon(name):
    return VARIANTES[name]().resize((GRID * SCALE, GRID * SCALE), Image.NEAREST).convert('RGB')


def planche(icons):
    """chaque variante : en carré, découpée en rond, et en petit (taille de la barre de Discord)"""
    W, small = 256, 48
    sheet = Image.new('RGB', (len(icons) * (W + 16) + 16, W * 2 + small + 64), (49, 51, 56))
    d = ImageDraw.Draw(sheet)
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, W - 1, W - 1), fill=255)
    for i, (name, img) in enumerate(icons.items()):
        x = 16 + i * (W + 16)
        big = img.resize((W, W), Image.NEAREST)
        sheet.paste(big, (x, 16))
        sheet.paste(big, (x, W + 32), mask)
        s = img.resize((small, small), Image.LANCZOS)
        m = mask.resize((small, small), Image.LANCZOS)
        sheet.paste(s, (x, 2 * W + 48), m)
        d.text((x + small + 12, 2 * W + 64), name, fill=(255, 255, 255))
    return sheet


def main():
    if '--toutes' in sys.argv:
        out = sys.argv[sys.argv.index('--toutes') + 1]
        os.makedirs(out, exist_ok=True)
        icons = {n: icon(n) for n in VARIANTES}
        for n, img in icons.items():
            img.save(os.path.join(out, n + '.png'))
        planche(icons).save(os.path.join(out, 'planche.png'))
        print('Variantes écrites dans', out)
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    icon(VARIANTE).save(OUT)
    print('Icône écrite :', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
