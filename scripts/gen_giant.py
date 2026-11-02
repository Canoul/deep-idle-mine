"""Le Bloc géant : 80 × 80 pixels = 5 × 5 cases (02/11/2026, Jules : « Géode éventrée », choisie parmi 3 prototypes ;
ancien : bloc violet couvert de carrés de couleur, scripts/gen_textures.py giant() du 26/10).

DA du Golbute et de Lucifer (scripts/gen_golbute.py, scripts/gen_lucifer.py) : gros trait d'encre, volumes nets, une
lumière dominante. Un bloc de roche noire et violette, taillé en facettes, fendu de haut en bas : la fente montre
l'intérieur d'une géode (bandes d'agate sur ses lèvres, tapis de petits cristaux au fond) et une grappe de cristaux aux
couleurs des minerais du jeu (diamant, thorium, cobalt, or, fer, mithril, plus rubis, améthyste et rose pour
l'arc-en-ciel), qui éclaire les bords de la fente. Fissures qui partent de la fente, paillettes de minerai prises dans
la roche ; face gauche entaillée par les pioches (roche fraîche, plus claire), là où les mineurs frappent ; éclats de
cristal tombés au pied. Le jeu le fait pulser (src/render/giant.js).
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

S = 80
LIGHT = (-0.6, -0.65, 0.7)            # torche de la salle, en haut à gauche
_n = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _n for c in LIGHT)


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


INK = hx('#0e0a12')
STONE = [hx(c) for c in ['#0e0a12', '#1b1521', '#282030', '#372d40', '#483c52', '#5d4f66', '#76667c', '#938298']]
FRESH = [hx(c) for c in ['#3d3446', '#6a5d70', '#8f8292', '#b3a6b0']]          # roche fraîchement cassée
AGATE = [hx(c) for c in ['#d9c8f0', '#8a5cc8', '#4b2a7a', '#9fe4f0', '#2a1648']]  # bandes, du bord vers le cœur
HOLLOW = hx('#0b0614')
# rampes des cristaux (du plus sombre au plus clair, 6 tons) : minerais du jeu (src/config.js BLOCKS) + arc-en-ciel
ORES = {
    'diamant':   ['#0b3a4a', '#13707e', '#25a9b4', '#4de8f0', '#a6fbff', '#f2ffff'],
    'thorium':   ['#173a10', '#2f6e1c', '#4fa62c', '#7ee04a', '#c2f79a', '#f4ffe6'],
    'cobalt':    ['#0c1648', '#16308c', '#2450d0', '#3f7cff', '#97b8ff', '#eef3ff'],
    'or':        ['#4a2a04', '#8a5a0c', '#c88a18', '#ffc83a', '#ffe78f', '#fffbe6'],
    'fer':       ['#3a2214', '#6e4528', '#a0704a', '#d9a67f', '#f2cfb0', '#fff4ea'],
    'mithril':   ['#26324a', '#4a6080', '#7892b4', '#b8d4f0', '#e0eeff', '#ffffff'],
    'rubis':     ['#3e0612', '#7a0e24', '#b81c36', '#ee3a52', '#ff99a6', '#fff0f2'],
    'amethyste': ['#250c4a', '#46188a', '#6c2ccc', '#a35bff', '#d3a8ff', '#f8efff'],
    'rose':      ['#4a0a36', '#8a1866', '#c8309a', '#ff5bc8', '#ffaee4', '#fff0fa'],
}
ORES = {k: [hx(c) for c in v] for k, v in ORES.items()}

SIL = [(1, 5), (5, 1), (17, 0), (22, 2), (30, 0), (55, 1), (61, 0), (74, 1), (79, 5), (80, 22), (79, 26), (80, 80),
       (0, 80), (0, 61), (1, 57), (0, 30)]
GASH = [(37, 4), (41, 9), (46, 11), (49, 17), (55, 23), (58, 31), (57, 37), (62, 44), (60, 52), (58, 60), (53, 67),
        (49, 75), (43, 78), (36, 76), (30, 70), (24, 63), (22, 54), (24, 47), (21, 39), (25, 31), (27, 22), (32, 15),
        (34, 9)]


def _poly(pts):
    def inside(x, y):
        xc, yc, c = x + .5, y + .5, False
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                if xc < x0 + (yc - y0) * (x1 - x0) / (y1 - y0):
                    c = not c
        return c
    return inside


def _dot(n):
    m = math.sqrt(sum(c * c for c in n)) or 1
    return sum(a * b for a, b in zip((c / m for c in n), LIGHT))


class _Cv:
    """toile : couleur et profondeur (z) de chaque pixel ; l'encre passe autour de ce qui est devant"""

    def __init__(self):
        self.px = [[None] * S for _ in range(S)]
        self.z = [[-1] * S for _ in range(S)]

    def put(self, x, y, c, z=None):
        if 0 <= x < S and 0 <= y < S:
            self.px[y][x] = c
            if z is not None:
                self.z[y][x] = z

    def ink(self):
        out = []
        for y in range(S):
            for x in range(S):
                if self.px[y][x] is None:
                    continue
                z = self.z[y][x]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < S and 0 <= yy < S and (self.px[yy][xx] is None or self.z[yy][xx] > z):
                        out.append((x, y))
                        break
        for x, y in out:
            self.px[y][x] = INK


def _depth(inside):
    """distance (pixels, 4-voisins) de chaque pixel d'une forme à son bord"""
    d = {(x, y): 0 for y in range(S) for x in range(S) if inside(x, y)}
    front = [p for p in d if any((p[0] + dx, p[1] + dy) not in d for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for p in front:
        d[p] = 1
    k = 1
    while front:
        nxt = []
        for x, y in front:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if d.get(q) == 0:
                    d[q] = k + 1
                    nxt.append(q)
        front, k = nxt, k + 1
    return d


def _rock(cv, sil, rng):
    """roche en facettes (Voronoï) : chaque facette penchée au hasard, bords du bloc biseautés, ombre vers le bas"""
    seeds = [(rng.uniform(-4, S + 4), rng.uniform(-4, S + 4)) for _ in range(48)]
    tilt = [(rng.uniform(-.8, .8), rng.uniform(-.8, .8)) for _ in seeds]
    cell = {}
    for y in range(S):
        for x in range(S):
            if sil(x, y):
                cell[(x, y)] = min(range(len(seeds)), key=lambda i: (seeds[i][0] - x) ** 2 + ((seeds[i][1] - y) * 1.25) ** 2)

    def edge(x, y):
        nx = ny = 0.0
        for k in range(1, 8):
            w = (8 - k) / 7 / k
            nx += w * ((not sil(x + k, y)) - (not sil(x - k, y)))
            ny += w * ((not sil(x, y + k)) - (not sil(x, y - k)))
        return nx, ny
    for (x, y), i in cell.items():
        ex, ey = edge(x, y)
        L = _dot((tilt[i][0] + ex * .9, tilt[i][1] + ey * .9, 1)) - .35 * max(0, (y - 48) / 32) - .12 * x / S
        k = max(1, min(6, int(round((L + .25) / 1.25 * 6))))
        if cell.get((x + 1, y), i) != i or cell.get((x, y + 1), i) != i:
            k = max(1, k - 2)                     # joint sombre en bas / à droite de chaque facette
        elif cell.get((x, y - 1), i) != i and k >= 3:
            k += 1                                 # arête du haut qui prend la lumière
        cv.put(x, y, STONE[k], 0)


def _crystal(cv, bx, by, ang, L, w, R, z, dim=0):
    """prisme : trois faces (gauche, milieu, droite) éclairées d'en haut à gauche, pointe facettée, arête claire ;
    le pied s'assombrit (il plonge dans la géode). dim : tons de moins (cristaux du fond)"""
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy, dx
    tip = max(3.0, w * 2.1)
    lit_left = (px * LIGHT[0] + py * LIGHT[1]) < 0      # quelle face latérale voit la torche
    tones = [4, 3, 1] if lit_left else [1, 3, 4]         # face gauche, milieu, face droite (u croissant)
    x0, x1 = int(min(bx, bx + dx * L) - w - 2), int(max(bx, bx + dx * L) + w + 2)
    y0, y1 = int(min(by, by + dy * L) - w - 2), int(max(by, by + dy * L) + w + 2)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            vx, vy = x + .5 - bx, y + .5 - by
            t, u = vx * dx + vy * dy, vx * px + vy * py
            if t < 0 or t > L:
                continue
            half = w if t < L - tip else w * (L - t) / tip
            if abs(u) > half + .15:
                continue
            f = 0 if u < -half * .3 else 2 if u > half * .3 else 1
            k = tones[f]
            if t > L - tip:
                k = min(5, k + 1)                 # facettes de la pointe, plus claires
            if t < L * .25:
                k -= 1                            # pied dans l'ombre
            cv.put(x, y, R[max(0, k - dim)], z)
    # arêtes : une claire côté lumière, une sombre côté ombre ; reflet blanc près de la pointe
    for t10 in range(int(L * 2.5), int((L - .5) * 10)):
        t = t10 / 10
        half = w if t < L - tip else w * (L - t) / tip
        for side, tone in ((-1, 5 if lit_left else 0), (1, 0 if lit_left else 5)):
            x, y = int(bx + dx * t + px * side * half * .3 + .5), int(by + dy * t + py * side * half * .3 + .5)
            if tone == 5 and t < L * .4:
                continue
            cv.put(x, y, R[max(0, tone - dim)] if tone else R[0], z)
    if not dim:
        cv.put(int(bx + dx * (L - tip * .9) + .5), int(by + dy * (L - tip * .9) + .5), (255, 255, 255), z)


def _glow(cv, lights, zs):
    """lumière des cristaux posée sur la roche, en paliers nets"""
    for y in range(S):
        for x in range(S):
            c = cv.px[y][x]
            if c is None or c == INK or cv.z[y][x] not in zs:
                continue
            add = [0.0, 0.0, 0.0]
            for lx, ly, col, rad, st in lights:
                d = math.hypot(x - lx, (y - ly) * .8) / rad
                if d < 1:
                    f = math.ceil((1 - d) * 4) / 4 * st
                    for k in range(3):
                        add[k] += col[k] * f
            if any(add):
                keep = 1 - min(.55, sum(add) / 765 * .5)
                cv.px[y][x] = tuple(min(255, int(c[k] * keep + add[k])) for k in range(3))


def giant_block():
    """pixels (RGBA) du Bloc géant, 80 × 80"""
    rng = random.Random(2610)
    cv = _Cv()
    sil, gash = _poly(SIL), _poly(GASH)
    _rock(cv, sil, rng)

    # fissures qui partent de la fente vers les bords (trait d'encre, lèvre claire au-dessus)
    for sx, sy, a, n in [(33, 12, -2.6, 16), (26, 34, 3.0, 18), (23, 58, 2.6, 16), (55, 21, -.5, 14), (61, 46, .15, 15),
                         (54, 66, .8, 12), (45, 10, -1.2, 8)]:
        x, y = float(sx), float(sy)
        for i in range(n):
            a += rng.uniform(-.35, .35)
            x += math.cos(a); y += math.sin(a)
            if gash(int(x), int(y)) or not sil(int(x), int(y)):
                continue
            cv.put(int(x), int(y), STONE[0])
            if i % 2 == 0 and cv.px[int(y) - 1][int(x)] not in (None, STONE[0]):
                cv.put(int(x), int(y) - 1, STONE[6])

    # paillettes de minerai prises dans la roche
    names = list(ORES)
    for i in range(30):
        x, y = rng.randrange(3, S - 3), rng.randrange(3, S - 3)
        if gash(x, y) or any(gash(x + dx, y + dy) for dx in (-3, 3) for dy in (-3, 3)):
            continue
        R = ORES[names[i % len(names)]]
        cv.put(x, y, R[4]); cv.put(x, y + 1, R[1])
        if i % 3 == 0:
            cv.put(x + 1, y, R[3]); cv.put(x + 1, y + 1, R[1])

    # entailles des pioches sur la face gauche (là où l'on frappe) : coin creusé dans la roche, lèvre de roche fraîche
    # en haut, ombre au fond du creux, encre sur l'arête basse, fissure qui part du point d'impact
    for x0, y0, wd, ht in [(0, 43, 9, 6), (0, 54, 12, 7), (0, 66, 8, 5), (3, 49, 5, 3)]:
        for y in range(y0, y0 + ht + 1):
            k = (y - y0) / ht                                # 0 : lèvre du haut, 1 : arête basse
            reach = int(wd * (1 - abs(k - .45) * 1.6))      # pointe du coin vers la droite, au milieu
            for x in range(x0, x0 + max(1, reach) + 1):
                if y == y0:
                    c = FRESH[3]
                elif y == y0 + ht or x == x0 + reach:
                    c = INK
                elif k < .45:
                    c = FRESH[2] if x < x0 + reach - 1 else FRESH[1]
                else:
                    c = STONE[1] if x > x0 + reach * .4 else STONE[2]
                cv.put(x, y, c, 0)
        x, y = x0 + wd, y0 + ht // 2
        for _ in range(rng.randrange(3, 7)):
            x += 1; y += rng.choice([-1, 0, 0, 1])
            cv.put(x, y, INK, 0)

    # la fente : bandes d'agate sur les lèvres, tapis de petits cristaux (druse), creux sombre au cœur
    dep = _depth(gash)
    for (x, y), d in dep.items():
        if d <= 1:
            c = AGATE[0]
        elif d == 2:
            c = AGATE[1]
        elif d == 3:
            c = AGATE[2] if (x + y) % 5 else AGATE[1]
        elif d == 4:
            c = AGATE[3] if y < 40 else AGATE[2]
        elif d <= 7:
            c = AGATE[4]
            r = rng.random()
            if r < .16:
                c = (190, 160, 240)
            elif r < .22:
                c = (240, 230, 255)
        else:
            c = HOLLOW if (x * 3 + y) % 7 else AGATE[4]
        cv.put(x, y, c, 1)

    # cristaux du fond (sombres), stalactites du haut, puis grappe qui pousse du bas vers le haut (du fond vers nous)
    for x, y, a, L, w, col in [(31, 44, -1.25, 15, 2.8, 'cobalt'), (52, 40, -2.0, 15, 2.8, 'rose'),
                               (41, 33, -1.55, 11, 2.4, 'mithril'), (28, 56, -.85, 12, 2.6, 'thorium'),
                               (56, 53, -2.35, 12, 2.6, 'rubis'), (44, 46, -1.3, 12, 2.4, 'or')]:
        _crystal(cv, x, y, a, L, w, ORES[col], 2, dim=2)
    for i, (x, y, a, L, w, col) in enumerate([(38, 10, 1.65, 9, 2.2, 'amethyste'), (45, 15, 1.95, 8, 2.0, 'diamant'),
                                              (51, 22, 2.35, 8, 2.0, 'or'), (33, 18, 1.2, 6, 1.8, 'fer')]):
        _crystal(cv, x, y, a, L, w, ORES[col], 3 + i * .01)
    front = [(30, 67, -1.05, 19, 3.2, 'rubis'), (52, 66, -2.15, 19, 3.2, 'thorium'), (25, 58, -.7, 14, 2.8, 'or'),
             (57, 56, -2.5, 14, 2.8, 'cobalt'), (26, 47, -.45, 9, 2.2, 'fer'), (58, 46, -2.7, 9, 2.2, 'mithril'),
             (36, 72, -1.3, 23, 3.6, 'amethyste'), (47, 71, -1.85, 23, 3.6, 'rose'), (42, 76, -1.6, 34, 4.8, 'diamant'),
             (33, 75, -1.9, 9, 2.0, 'cobalt'), (51, 75, -1.2, 9, 2.0, 'or')]
    for i, (x, y, a, L, w, col) in enumerate(front):
        _crystal(cv, x, y, a, L, w, ORES[col], 4 + i * .01)

    # éclats de cristal tombés au pied du bloc
    for i, (x, y, a, L, w, col) in enumerate([(16, 79, -2.4, 6, 1.6, 'diamant'), (21, 80, -1.0, 4, 1.3, 'amethyste'),
                                              (64, 79, -.6, 6, 1.6, 'rose'), (70, 80, -2.2, 4, 1.3, 'thorium')]):
        _crystal(cv, x, y, a, L, w, ORES[col], 6 + i * .01)

    cv.ink()
    # la grappe éclaire les lèvres de la fente (roche seulement) : violet au cœur, cyan au milieu, chaud en bas
    _glow(cv, [(41, 46, (180, 110, 255), 34, .5), (42, 42, (110, 230, 255), 22, .38), (38, 64, (255, 120, 120), 18, .3)], (0,))
    # étincelles en croix sur les cristaux
    for x, y in [(43, 44), (32, 53), (52, 31), (60, 64)]:
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            cv.put(x + dx, y + dy, (255, 255, 255) if (dx, dy) == (0, 0) else (220, 235, 255))
    return [(*c, 255) if c else (0, 0, 0, 0) for row in cv.px for c in row]


# ---- la salle : grande torche et fontaine à oxygène (1 × 2 cases, 16 × 32 pixels ; 02/11/2026, Jules ; ancien : dessins
# en rectangles de gen_textures.py giant() du 26/10). Dessinées pixel par pixel ; l'encre est posée ensuite tout autour
# du fer et de la pierre (pas autour des flammes, de l'eau ni des bulles).

def _sheet(rows, pal, inked):
    """rows : 32 lignes de 16 caractères ('.' = vide) ; pal : caractère → couleur ; inked : caractères cerclés d'encre"""
    w, h = len(rows[0]), len(rows)
    assert all(len(r) == w for r in rows), [len(r) for r in rows]
    px = [[pal[c] if c != '.' else None for c in r] for r in rows]
    for y in range(h):
        for x in range(w):
            if px[y][x] is None and any(0 <= x + dx < w and 0 <= y + dy < h and rows[y + dy][x + dx] in inked
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[y][x] = INK
    return [(*c, 255) if c else (0, 0, 0, 0) for r in px for c in r]


IRON = {'1': hx('#25262a'), '2': hx('#3d3f45'), '3': hx('#5c5f66'), '4': hx('#9a9ca3'), 'G': hx('#d8783a')}
FIRE = {'R': hx('#8e1a0c'), 'r': hx('#d43a12'), 'o': hx('#ff7a1a'), 'y': hx('#ffc23f'), 'w': hx('#fff0a0'),
        'W': hx('#ffffff'), 'c': hx('#3a1208'), 'e': hx('#ff5a1a'), 'a': hx('#8a3010')}

TORCH = [
    '.......R........',
    '.......rR...R...',
    '...R..Rrr..Rr...',
    '...rR.rorR.rr...',
    '...rrRroorRro...',
    '..RrorrooyrroR..',
    '..rooroyyyoorr..',
    '..rooyyywyyoor..',
    '.Rroyyywwyyyor..',
    '.rroyywwwwyyorR.',
    '..roywwWWwwyor..',
    '..eoywwWWwwyoe..',
    '..ceaeceecaecc..',
    '.4G4G4G44G4G4G4.',
    '.33333332222211.',
    '..333322222111..',
    '...3322221111...',
    '.....322211.....',
    '.......41.......',
    '.......31.......',
    '.......13.......',
    '.......12.......',
    '.....433221.....',
    '.......41.......',
    '.......31.......',
    '.......13.......',
    '.......12.......',
    '......4321......',
    '.....3.32.1.....',
    '....3..32..1....',
    '...3...32...1...',
    '..433..432..211.',
]


def giant_torch():
    """grande torche : brasero de fer forgé à bords crénelés (reflets de braise), braises, grande flamme en langues,
    fût torsadé avec une bague, trépied"""
    return _sheet(TORCH, {**IRON, **FIRE}, set('1234Gcea'))


STONE_F = {'a': STONE[2], 'b': STONE[3], 'c': STONE[4], 'd': STONE[5], 'e': STONE[6], 'f': STONE[7]}
WATER = {'1': hx('#123a7a'), '2': hx('#1f62c8'), '3': hx('#3d8bff'), '4': hx('#8fc8ff'), '5': hx('#e6f6ff'),
         'o': hx('#bfe9ff'), 'O': hx('#ffffff')}

FOUNTAIN = [
    '................',
    '..o..........o..',
    '.o.o...55...o.o.',
    '..o...4554...o..',
    '.....345543.....',
    '....34.44.43....',
    '...34..44..43...',
    '..34.feeddc.43..',
    '..3...edcb...3..',
    '..4...dcbb...4..',
    '..3...dcba...3..',
    '......dcba......',
    '.4....dcba....4.',
    '.3...edcbba...3.',
    '.3..feddccba..3.',
    'f4feeddccbbaa4a.',
    'e45444444444335.',
    'ed3333333332222a',
    '.edd2222211ccba.',
    '..edddcccbbbaa..',
    '...eeddccbbaa...',
    '.....eddcba.....',
    '......dcba......',
    '......ecba......',
    '......dcba......',
    '.....fdcbaa.....',
    '....feddccba....',
    '...feedddccba...',
    '..ffeeddccbbaa..',
    '..eeddccbbbaaa..',
    '.feeddccbbbaaaa.',
    '.edddccccbbbaaa.',
]


def giant_fountain():
    """fontaine à oxygène : vasque de pierre (la pierre du Bloc géant), pilier central d'où jaillit l'eau, deux nappes
    qui retombent dans la vasque, socle à gradins ; bulles d'oxygène qui montent"""
    return _sheet(FOUNTAIN, {**STONE_F, **WATER}, set('abcdef'))
