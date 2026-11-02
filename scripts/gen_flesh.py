"""Le mur de chair : 16 × 96 pixels = 1 × 6 cases (03/11/2026, Jules : « entre le mur aux yeux et la gueule », mi pixel art
franc et lisible (couleurs saturées, ombres tramées), mi Darkest Dungeon (chair sombre et humide, gros trait d'encre) ;
ancien : bourrelets rouges au hasard, gen_textures.py flesh_wall() du 28/10).

De haut en bas : chair qui déborde, un grand œil de braise injecté de sang, une côte, deux petits yeux dans les plis,
une gueule verticale (lèvres épaisses, crocs en quinconce, gorge sombre, langue, filets de bave), une côte, un œil
mi-clos, chair qui coule. Partout derrière : cordes de muscle strié, veines violettes, pustules. Les yeux regardent à
gauche (le mur avance vers le mineur ; le jeu ne le retourne pas). Icône carrée (lobby, wiki) : le grand œil.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

W, H = 16, 96
ICON_Y = 4                      # icône 16 × 16 : lignes ICON_Y à ICON_Y + 15 (le grand œil)
LIGHT = (-0.55, -0.7, 0.75)
_n = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _n for c in LIGHT)
BAYER = (0.125, 0.625, 0.875, 0.375)   # trame 2 × 2 entre deux tons


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


INK = hx('#16030a')
FLESH = [hx(c) for c in ['#16030a', '#3e0812', '#6a1220', '#962032', '#c2364a', '#e8646e', '#ffb0ae']]
THROAT = [hx(c) for c in ['#0a0105', '#1e030c', '#360814', '#521020']]
TONGUE = [hx(c) for c in ['#5a1030', '#9a2a52', '#d05a7e', '#f4a0b8']]
BONE = [hx(c) for c in ['#16030a', '#6a5640', '#a8946e', '#dccca2', '#fbf3d8']]
VEIN = [hx(c) for c in ['#2a0f40', '#55206a', '#8a3c9e']]
PUS = [hx(c) for c in ['#5a4610', '#a8902a', '#e0c84a', '#fff4a8']]
SCLERA = [hx(c) for c in ['#a8885a', '#d8c494', '#f2e8c6']]
IRIS = [hx(c) for c in ['#6a0a08', '#c8300e', '#ff7a1a', '#ffc23f']]
SLIME = [hx(c) for c in ['#e8a0a8', '#ffd8dc']]


class _Cv:
    def __init__(self):
        self.px = [[None] * W for _ in range(H)]
        self.z = [[-1.0] * W for _ in range(H)]

    def put(self, x, y, c, z=None):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            self.px[y][x] = c
            if z is not None:
                self.z[y][x] = z

    def zat(self, x, y):
        x, y = int(x), int(y)
        return self.z[y][x] if 0 <= x < W and 0 <= y < H else None

    def ink(self, skip=()):
        out = []
        for y in range(H):
            for x in range(W):
                if self.px[y][x] is None or any(a <= self.z[y][x] < b for a, b in skip):
                    continue
                z = self.z[y][x]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and (self.px[yy][xx] is None or self.z[yy][xx] >= z + 1):
                        out.append((x, y))
                        break
        for x, y in out:
            self.px[y][x] = INK


def _tone(kf, x, y, lo, hi):
    """ton tramé : kf réel → index entier, trame 2 × 2 sur la transition"""
    return max(lo, min(hi, int(kf + BAYER[(x % 2) + (y % 2) * 2])))


def _lobe(cv, cx, cy, rx, ry, rmp, z, lo=1, spec=True, keep=None):
    """volume bombé et luisant (chair mouillée) : normale d'ellipsoïde, lumière en haut à gauche, reflet blanc"""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            nx, ny = (x + .5 - cx) / rx, (y + .5 - cy) / ry
            r2 = nx * nx + ny * ny
            if r2 > 1 or (keep and not keep(x, y)):
                continue
            d = nx * LIGHT[0] + ny * LIGHT[1] + math.sqrt(1 - r2) * LIGHT[2]
            k = _tone(lo + max(0, d) * (len(rmp) - 2 - lo), x, y, lo, len(rmp) - 2)
            if spec and d > .95:
                k = len(rmp) - 1
            cv.put(x, y, rmp[k], z)


def _muscle(cv, rng):
    """fond : trois cordes de muscle strié qui ondulent du haut en bas, bord irrégulier"""
    for i, (cx, w, ph) in enumerate(((3.6, 3.2, 0.0), (8.0, 3.4, 1.7), (12.4, 3.2, 3.1))):
        for y in range(H):
            xc = cx + math.sin(y / 7.0 + ph) * .7
            ww = w + math.sin(y / 5.0 + ph * 2) * .5
            for x in range(int(xc - ww) - 1, int(xc + ww) + 2):
                nx = (x + .5 - xc) / ww
                if abs(nx) > 1 or not 0 <= x < W:
                    continue
                d = nx * LIGHT[0] + math.sqrt(1 - nx * nx) * LIGHT[2] - .12
                kf = 1.6 + max(0, d) * 3.0
                if (y + int(nx * 3) + i * 2) % 4 == 0:
                    kf -= 1.1                              # stries des fibres
                cv.put(x, y, FLESH[_tone(kf, x, y, 1, 5)], i * .01)


def _rib(cv, y0, z):
    """côte : arc d'os qui traverse le mur, bourrelet sombre dessous"""
    for x in range(0, W):
        y = y0 + int(round(((x - 7.5) / 7.5) ** 2 * 2.5))
        cv.put(x, y - 1, BONE[4] if x < 9 else BONE[3], z)
        cv.put(x, y, BONE[3] if x < 11 else BONE[2], z)
        cv.put(x, y + 1, BONE[2] if x % 5 else BONE[1], z)
        if cv.zat(x, y + 3) is not None and cv.zat(x, y + 3) < 1:
            cv.put(x, y + 3, FLESH[1])
    for x in (2, 7, 12):                                   # entailles dans l'os
        y = y0 + int(round(((x - 7.5) / 7.5) ** 2 * 2.5))
        cv.put(x, y, BONE[1], z)


# Yeux et gueule dessinés pixel par pixel (à 16 pixels de large, les formes calculées font de la bouillie).
# k encre · 1 à 6 chair · S T U blanc de l'œil (ombre → lumière) · I J K L iris (sombre → braise) · W reflet · '.' rien
EYE_BIG = [
    '...kkkkkkkkkk...',
    '.kk5566665543kk.',
    'k45666655544332k',
    'k3kkkkkkkkkkkk2k',
    'kkkJKkKJUUTSkkkk',
    'kkUJWkLJUUTTSkkk',
    'k5UJLkLJUUTTSSkk',
    'kkTIJkJITTSSSkkk',
    'k3kkkkkkkkkkk2k.',
    'k4566666655432k.',
    '.k34555544332k..',
    '..kk33332222kk..',
    '....kkkkkkkk....',
]
EYE_HALF = [
    '..kkkkkkkk..',
    '.k55666554k.',
    'k3444443332k',
    'kkJLkLJTTSkk',
    'kkIJkJITSSkk',
    'k2346665432k',
    '.kk333222kk.',
    '...kkkkkk...',
]
EYE_SMALL = [
    '.kkkk.',
    'kJkTSk',
    'kIkSSk',
    '.kkkk.',
]


def _stamp(cv, x0, y0, rows, z):
    pal = {'k': INK, 'S': SCLERA[0], 'T': SCLERA[1], 'U': SCLERA[2], 'I': IRIS[0], 'J': IRIS[1], 'K': IRIS[2],
           'L': IRIS[3], 'W': (255, 255, 255), **{str(i): FLESH[i] for i in range(1, 7)}}
    for dy, row in enumerate(rows):
        for dx, c in enumerate(row):
            if c != '.':
                cv.put(x0 + dx, y0 + dy, pal[c], z)


# gueule : demi-ouverture (pixels de part et d'autre du milieu, entre les colonnes 7 et 8) ligne par ligne
MAW_OPEN = [0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0]
MAW_FANGS = {4: -1, 7: 1, 10: -1, 13: 1, 16: -1, 19: 1}      # ligne → côté du croc (−1 : lèvre gauche)


def _maw(cv, y0):
    """gueule verticale : lèvres épaisses (la droite, tournée vers la lumière, plus claire au bord), gorge sombre,
    crocs en quinconce, langue en bas ; renvoie les lignes de la gorge pour les filets de bave"""
    for r, hw in enumerate(MAW_OPEN):
        y = y0 + r
        a, b = 8 - hw, 7 + hw                                  # gorge : colonnes a à b
        crease = r % 6 == 3
        for x in range(1, 15):
            if hw and a <= x <= b:
                d = min(x - a, b - x)
                c = THROAT[0] if d >= 2 else THROAT[1] if d == 1 else THROAT[2]
            elif hw and x in (a - 1, b + 1):
                c = INK
            elif not hw and x in (7, 8):
                c = INK                                         # lèvres jointes
            elif x < 8:                                         # lèvre gauche (son bord intérieur est à l'ombre)
                inner = (a - 1 if hw else 7) - x
                c = FLESH[2] if x == 1 else FLESH[3] if inner <= 1 else FLESH[5] if inner == 3 else FLESH[4]
                if crease and 1 < x < (a - 1 if hw else 7) - 1:
                    c = FLESH[2]
            else:                                               # lèvre droite (bord intérieur éclairé, reflet mouillé)
                inner = x - (b + 1 if hw else 8)
                c = FLESH[2] if x == 14 else FLESH[6] if inner == 1 and r % 3 else FLESH[5] if inner <= 2 else FLESH[3]
                if crease and (b + 1 if hw else 8) + 2 < x < 14:
                    c = FLESH[2]
            cv.put(x, y, c, 6)
    for r, side in MAW_FANGS.items():                          # crocs : 3 pixels de haut, 2 de long
        hw = MAW_OPEN[r]
        x = 8 - hw if side < 0 else 7 + hw
        y = y0 + r
        cv.put(x, y - 1, BONE[4], 6); cv.put(x, y, BONE[3], 6); cv.put(x, y + 1, BONE[2], 6)
        cv.put(x - side, y, BONE[3] if side < 0 else BONE[4], 6)
    for r, cols in ((22, (7, 8)), (23, (6, 7, 8, 9)), (24, (6, 7, 8, 9)), (25, (7, 8))):   # langue
        for x in cols:
            cv.put(x, y0 + r, TONGUE[3] if (r, x) == (23, 7) else TONGUE[0] if x == 8 and r > 22 else TONGUE[2] if x < 8 else TONGUE[1], 6)
    return [y0 + r for r, hw in enumerate(MAW_OPEN) if hw == 3]


def flesh_wall():
    """pixels (RGBA) du mur de chair, 16 × 96, debout"""
    rng = random.Random(2810)
    cv = _Cv()
    _muscle(cv, rng)
    # chair qui déborde en haut et coule en bas (bourrelets)
    for cx, cy, rx, ry in ((3, 2, 3.4, 2.6), (8.5, 1.5, 3.6, 2.2), (13, 2.5, 3.0, 2.6), (4, 93, 3.4, 3), (11.5, 93.5, 3.6, 2.6)):
        _lobe(cv, cx, cy, rx, ry, FLESH, 1.0)
    _rib(cv, 24, 4)
    _rib(cv, 70, 4)
    # veines (seulement sur les cordes de muscle) et pustules
    for _ in range(12):
        x, y = rng.uniform(1, W - 2), rng.uniform(3, H - 4)
        for i in range(rng.randrange(7, 14)):
            if cv.zat(x, y) is not None and cv.zat(x, y) < .9:
                cv.put(x, y, VEIN[1])
                if i % 2 and cv.zat(x, y - 1) is not None and cv.zat(x, y - 1) < .9:
                    cv.put(x, y - 1, VEIN[2])
            x = min(W - 1, max(0, x + rng.uniform(-.9, .9))); y += rng.choice([1, 1, 1, -1])
    for x, y in ((2, 21), (13, 19), (1, 36), (14, 44), (2, 58), (13, 61), (3, 76), (13, 89), (6, 90)):
        if cv.zat(x, y) is not None and cv.zat(x, y) < 1:
            cv.put(x, y, PUS[2], 3); cv.put(x + 1, y, PUS[1], 3); cv.put(x, y + 1, PUS[1], 3); cv.put(x + 1, y + 1, PUS[0], 3)
            cv.put(x, y, PUS[3], 3)
    # encre : autour de tout ce qui est devant le muscle (pas entre les cordes, trop proches en z)
    cv.ink()
    # dessinés à la main, avec leur propre encre : grand œil (l'icône), deux petits yeux dans les plis, la gueule,
    # l'œil mi-clos du bas
    _stamp(cv, 0, 6, EYE_BIG, 5)
    _stamp(cv, 1, 29, EYE_SMALL, 5)
    _stamp(cv, 10, 30, EYE_SMALL[:1] + ['kkJTkk'[:6]] + EYE_SMALL[3:], 5)
    throat = _maw(cv, 37)
    _stamp(cv, 2, 78, EYE_HALF, 5)
    # filets de bave qui traversent la gorge, coulures sous la gueule et en bas
    for y in (throat[2], throat[8]):
        for x in range(5, 11):
            cv.put(x, y + (1 if x in (7, 8) else 0), SLIME[1] if x < 8 else SLIME[0])
    for x, y, n in ((7, 64, 3), (5, 92, 3), (12, 93, 2)):
        for k in range(n):
            if 0 <= y + k < H and cv.px[y + k][x] is not None:
                cv.put(x, y + k, SLIME[0] if k else SLIME[1])
    return [(*c, 255) if c else (0, 0, 0, 0) for row in cv.px for c in row]


def flesh_icon(px=None):
    """icône carrée (lobby, wiki) : le grand œil"""
    px = px or flesh_wall()
    return px[W * ICON_Y:W * (ICON_Y + 16)]
