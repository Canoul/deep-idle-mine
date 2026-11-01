"""Visuels des fiches des stores -> mobile/store/ (Google Play et App Store), à partir des textures du jeu.

  - icon-google-512.png : l'icône de l'appli (la pioche de scripts/gen_app_icon.py) en 512 × 512 ;
  - icon-apple-1024.png : la même en 1024 × 1024, sans transparence (Apple la refuse, et arrondit les coins lui-même) ;
  - banner-google-1024x500.png : la bannière de Google Play (« feature graphic »), sans transparence. Une mine en coupe
    dessinée comme en session (src/render/canvas.js : cases de 16 px, assombries loin des lumières, noires tant qu'on
    ne les a pas vues, halo des torches), le mineur en acier qui pioche, et le titre du jeu en lettres pixel. Le tout
    à l'échelle de l'art (1 px = 1 pixel de texture) puis agrandi d'un facteur entier au plus proche voisin.

    python scripts/gen_store_art.py      (ou npm run store:art)
"""
import math
import os
from PIL import Image
from gen_app_icon import centered, BG, ICON_SHARE

ROOT = os.path.join(os.path.dirname(__file__), '..')
TEX = os.path.join(ROOT, 'textures')
OUT = os.path.join(ROOT, 'mobile', 'store')

# --- bannière : 1024 × 500 = 256 × 125 pixels d'art agrandis ×4 ------------------------------------------------------
W, H, ZOOM, TILE = 1024, 500, 4, 16
SKY = ['#16070a', '#3e140f', '#7a2e18', '#b45a2c']    # crépuscule du Carreau (TOWN.sky, src/config.js)
UNSEEN = '#060608'             # case jamais vue (src/render/canvas.js)
DARK = 0.72                    # assombrissement maximal d'une case loin des lumières (src/render/canvas.js)
GLOW = (255, 200, 90)          # halo des torches : 0,35 au centre, 0 à 3 cases (src/render/canvas.js), en 4 paliers nets
TORCH_R, MINER_R = 4.5, 4.0    # rayons de lumière (cases)
SEEN_R = 2.3                   # on a vu les cases à moins de SEEN_R d'une galerie (le reste est noir)

# la mine, case par case (comme les mines dessinées en texte des tests) : 16 colonnes, 8 lignes (la dernière est coupée)
MINE = [
    '~~~~~~~~~~~~~C~~',
    'ggggggggggLggggg',
    'ddsddcdddsLddcdd',
    'sdsddsdsT.L.K$sd',
    'ssissssssoNsisos',
    'sssscssss.L.MDos',
    'hhhshhhhhhLhhohh',
    'hhhhhhhhh.L.T.bh',
]
BLOCK = {'g': 'grass', 'd': 'dirt', 's': 'stone', 'h': 'hardstone', 'c': 'coal', 'i': 'iron', 'o': 'gold',
         'D': 'diamond', 'b': 'cobalt', 'm': 'mithril', '$': 'treasure'}
DUG = {'.': None, 'L': 'ladder', 'T': 'torch', 'M': None, 'K': None, 'N': 'ladder'}   # galerie, et ce qui y est posé

# une session à 3 (src/skins.js) : armure par-dessus le corps, pioche en main quand il mine (None : il grimpe)
def armor(metal):
    return ['skins/body'] + [f'skins/{metal}_{p}' for p in ('boots', 'legs', 'chest', 'helmet')]


MINERS = {
    'M': (armor('steel'), 'skins/pick_steel'),      # acier : pioche le diamant devant lui
    'K': (armor('chitin'), 'skins/pick_iron'),      # chitine : ouvre le treasure
    'N': (armor('mithril'), None),                  # mithril : remonte par l'échelle
}
PICK_ANGLE = 0.3               # pioche qui frappe le bloc devant (src/render/miner-sprite.js : pivot (11, 10), 13 × 13 px)

# --- titre : lettres pixel épaisses, 7 pixels de haut ----------------------------------------------------------------
GLYPHS = {
    'D': ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
    'E': ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
    'P': ['#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
    'M': ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
    'I': ['##', '##', '##', '##', '##', '##', '##'],
    'N': ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##'],
    'L': ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
}
TITLE = ['DEEP', 'MINE', 'IDLE']
TITLE_UNIT = 3                 # un pixel de lettre = 3 pixels d'art (12 px à l'écran)
TITLE_X, TITLE_Y = 14, 38      # coin haut gauche du bloc titre (pixels d'art)
FACE = ['#ffe6c4', '#ffc27a', '#ffc27a', '#ff7a2e', '#ff7a2e', '#e8601e', '#e8601e']   # du haut vers le bas
EDGE, OUTLINE = '#8f2f0c', '#0b0806'    # tranche (décalage franc d'un pixel de lettre vers le bas) et contour


def tex(name):
    return Image.open(os.path.join(TEX, name + '.png')).convert('RGBA')


def rgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def put(dst, src, x, y):
    """colle src en (x, y), même s'il dépasse du bord"""
    dst.alpha_composite(src.crop((max(0, -x), max(0, -y), src.width, src.height)), (max(0, x), max(0, y)))


def shade(dst, box, color, alpha):
    over = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (*color, round(255 * alpha)))
    put(dst, over, box[0], box[1])


def lights():
    out = []
    for y, row in enumerate(MINE):
        for x, c in enumerate(row):
            if c == 'T':
                out.append((x, y, TORCH_R))
            elif c in MINERS:
                out.append((x, y, MINER_R))
    return out


def mine_layer():
    rows = len(MINE)
    img = Image.new('RGBA', (len(MINE[0]) * TILE, rows * TILE), UNSEEN)
    dug = [(x, y) for y, row in enumerate(MINE) for x, c in enumerate(row) if c in DUG]
    src = lights()
    for y, row in enumerate(MINE):
        for x, c in enumerate(row):
            px, py = x * TILE, y * TILE
            if y == 0:                                  # ciel en bandes nettes
                band = TILE // len(SKY)
                for i, col in enumerate(SKY):
                    img.paste(rgb(col) + (255,), (px, py + i * band, px + TILE, py + (i + 1) * band))
                if c == 'C':
                    img.alpha_composite(tex('chest'), (px, py))
                continue
            if y > 1 and not any(math.hypot(x - a, y - b) <= SEEN_R for a, b in dug):
                continue                                # jamais vue : noire
            if c in DUG:
                img.alpha_composite(tex('tunnel'), (px, py))
                if DUG[c]:
                    img.alpha_composite(tex(DUG[c]), (px, py))
            else:
                img.alpha_composite(tex(BLOCK[c]), (px, py))
            if y > 1:
                light = max([max(0.0, 1 - math.hypot(x - a, y - b) / r) for a, b, r in src] + [0.0])
                shade(img, (px, py, px + TILE, py + TILE), (0, 0, 0), DARK * (1 - light))
    for y, row in enumerate(MINE):                      # halo des torches, par-dessus le noir comme en jeu
        for x, c in enumerate(row):
            if c == 'T':
                glow(img, x * TILE + 8, y * TILE + 8)
            elif c in MINERS:
                miner(img, x * TILE, y * TILE, *MINERS[c])
    return img


def glow(img, cx, cy, steps=4, radius=3 * TILE):
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    px = layer.load()
    for y in range(max(0, cy - radius), min(img.height, cy + radius)):
        for x in range(max(0, cx - radius), min(img.width, cx + radius)):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d < radius:
                k = int(d / radius * steps)             # palier, pas de dégradé lisse
                px[x, y] = (*GLOW, round(255 * 0.35 * (1 - (k + 0.5) / steps)))
    img.alpha_composite(layer)


def miner(img, px, py, layers, pick):
    for name in layers:
        img.alpha_composite(tex(name), (px, py))
    if not pick:
        return
    pick = tex(pick).resize((13, 13), Image.NEAREST)
    pad = Image.new('RGBA', (40, 40), (0, 0, 0, 0))     # pivot au centre, outil en (-3, -12) comme dans le jeu
    pad.alpha_composite(pick, (20 - 3, 20 - 12))
    pad = pad.rotate(-math.degrees(PICK_ANGLE), resample=Image.NEAREST, center=(20, 20))
    put(img, pad, px + 11 - 20, py + 10 - 20)


def title_layer(size):
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    u = TITLE_UNIT
    widths = [sum(len(GLYPHS[ch][0]) + 1 for ch in word) - 1 for word in TITLE]
    face, edge = set(), set()
    for line, word in enumerate(TITLE):
        gx = (max(widths) - widths[line]) // 2          # lignes centrées
        gy = line * (len(GLYPHS['E']) + 1)
        for ch in word:
            for r, bits in enumerate(GLYPHS[ch]):
                for c, b in enumerate(bits):
                    if b == '#':
                        face.add((gx + c, gy + r, r))
            gx += len(GLYPHS[ch][0]) + 1
    cells = {(x, y) for x, y, _ in face}
    edge = {(x, y + 1) for x, y in cells} - cells
    solid = cells | edge
    outline = {(x + dx, y + dy) for x, y in solid for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - solid

    def dot(x, y, col):
        img.paste(rgb(col) + (255,), (TITLE_X + x * u, TITLE_Y + y * u, TITLE_X + (x + 1) * u, TITLE_Y + (y + 1) * u))
    for x, y in outline:
        dot(x, y, OUTLINE)
    for x, y in edge:
        dot(x, y, EDGE)
    for x, y, r in face:
        dot(x, y, FACE[r])
    return img


def banner():
    art = Image.new('RGBA', (W // ZOOM, -(-H // ZOOM)), UNSEEN)
    put(art, mine_layer(), 0, 0)
    art.alpha_composite(title_layer(art.size))
    return art.resize((art.width * ZOOM, art.height * ZOOM), Image.NEAREST).crop((0, 0, W, H)).convert('RGB')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        'icon-google-512.png': centered(512, ICON_SHARE, BG),
        'icon-apple-1024.png': centered(1024, ICON_SHARE, BG).convert('RGB'),
        'banner-google-1024x500.png': banner(),
    }
    for name, img in files.items():
        img.save(os.path.join(OUT, name))
    print('Visuels écrits dans', os.path.relpath(OUT, ROOT), ':', ', '.join(files))


if __name__ == '__main__':
    main()
