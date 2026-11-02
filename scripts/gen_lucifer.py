"""Lucifer, le boss de He's coming : 80 × 80 pixels = 5 × 5 cases (02/11/2026, Jules : « Roi déchu », boss final du raid ;
ancien : premier Lucifer de Geoffrey du 01/11, dégradés bruités sans trait d'encre).

DA du Golbute (scripts/gen_golbute.py) : gros trait d'encre autour de la silhouette et entre les parties, volumes bombés
nets, une lumière dominante : la lave du portail, d'en bas. Seuls la tête, le torse et les bras sortent du portail.
Peau cramoisie, cornes en lyre annelées avec des anneaux d'or, couronne fine au rubis, grand col dressé doublé de rouge,
cheveux plaqués en arrière, barbiche, torque d'or ; fers brisés aux poignets (le prisonnier qui s'évade) ; griffes
noires qui agrippent le bord du portail. Visage : un sourcil qui plonge, l'autre levé, paupière lourde, sourire en coin.

Animation du rugissement (src/render/hescoming.js, luciferFrame) : au repos, les deux mains sur le portail ('lucifer') ;
avant chaque rugissement il lève la main droite ('lucifer_roar1' à 3 : l'avant-bras vient vers nous, une étincelle,
la main à hauteur du visage) ; une flamme violette (la couleur du rugissement) y brûle et vacille ('lucifer_roar4' à 6).
Portail : 96 × 16 pixels, lave en bandes nettes entre deux bords de roche encrés.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

from gen_bosses import hx
from gen_golbute import _dist

S = 80
EMPTY = (0, 0, 0, 0)
INK = '#120609'
SK = [INK, '#4a0c12', '#6e1218', '#961a1e', '#bd2a24', '#e0503a']
HRN = [INK, '#1d1820', '#2f2933', '#4a424c', '#6f6570', '#a39a9e']
IRON = [INK, '#25262a', '#3d3f45', '#5c5f66', '#9a9ca3']
HAIR = [INK, '#150c12', '#221420', '#33202e', '#47304a']
CLOTH = [INK, '#140a12', '#1f0f1c', '#2c1428', '#3c1a36']
GOLD = ['#5a3a0a', '#a8741a', '#e0aa30', '#ffe07a']
VIO = ['#2a0f4a', '#6a2ccf', '#b06bff', '#e09aff', '#ffe6ff']
FIRE = ['#fff0a0', '#ffc23f', '#ff7a1a', '#c8401a']
LIT = ['#5a140e', '#8e2414', '#c8401a', '#f07a2a', '#ffc060']      # peau éclairée par la lave
KEY = (-.5, -.75, .6)            # lumière d'ambiance, en haut à gauche
LAVA_DIR = (0, .85, .5)          # la lave éclaire d'en bas


def _norm(v):
    m = math.sqrt(sum(c * c for c in v))
    return tuple(c / m for c in v)


def _ellipse(cx, cy, rx, ry):
    return lambda x, y: ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1


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


def _mx(pts):
    """symétrique gauche-droite"""
    return [(S - x, y) for x, y in pts]


def _tube(pts, w0, w1):
    """corne ou griffe : polyligne épaissie de w0 (base) à w1 (pointe) ; renvoie t (0 base → 1 pointe), ou None dehors"""
    segs, tot = [], 0
    for a, b in zip(pts, pts[1:]):
        l = math.dist(a, b)
        segs.append((a, b, tot, l))
        tot += l

    def f(x, y):
        px, py, best = x + .5, y + .5, None
        for (ax, ay), (bx, by), s0, l in segs:
            u = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (l * l)))
            d = math.hypot(px - (ax + u * (bx - ax)), py - (ay + u * (by - ay)))
            t = (s0 + u * l) / tot
            if d <= w0 + (w1 - w0) * t and (best is None or t < best):
                best = t
        return best
    return f


class _Body:
    """parties (nom, forme, matière) de l'arrière vers l'avant ; volumes bombés (distance au bord), lumière d'ambiance,
    puis la lave d'en bas qui remplace la teinte par LIT là où elle frappe fort ; on dessine les détails, puis l'encre"""

    def __init__(s, parts, mats, R=7.0, lava_from=40):
        s.part = part = [[None] * S for _ in range(S)]
        s.z, s.mat = {}, {}
        for i, (name, inside, m) in enumerate(parts):
            s.z[name], s.mat[name] = i, m
            for y in range(S):
                for x in range(S):
                    if inside(x, y):
                        part[y][x] = name
        d = _dist(part, S)
        key, lava = _norm(KEY), _norm(LAVA_DIR)

        def pillow(x, y):
            p = part[y][x]
            h = lambda xx, yy: min(d[yy][xx], R) / R if 0 <= xx < S and 0 <= yy < S and part[yy][xx] == p else 0
            return _norm((h(x - 1, y) - h(x + 1, y), h(x, y - 1) - h(x, y + 1), .9))
        s.out = [[EMPTY] * S for _ in range(S)]
        s.level = [[0] * S for _ in range(S)]
        s.lav = [[0] * S for _ in range(S)]
        for y in range(S):
            for x in range(S):
                p = part[y][x]
                if p is None:
                    continue
                M = mats[s.mat[p]]
                n = pillow(x, y)
                ramp = M['ramp']
                lum = .08 + .92 * max(0, sum(n[i] * key[i] for i in range(3))) ** 1.4
                s.level[y][x] = lv = int(max(1, min(len(ramp) - 1, lum * (len(ramp) - 1.2) + 1)))
                s.out[y][x] = hx(ramp[lv])
                prox = max(0, (y - lava_from) / (S - lava_from)) ** 1.3
                s.lav[y][x] = L = max(0, sum(n[i] * lava[i] for i in range(3))) * prox * M.get('lava', 1)
                if L > .3:
                    s.out[y][x] = hx(LIT[int(min(len(LIT) - 1, (L - .3) / .7 * len(LIT) * 1.1))])

    def put(s, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            s.out[y][x] = hx(c) if isinstance(c, str) else c

    def path(s, pts, c):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for i in range(n + 1):
                s.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)

    def fill(s, inside, c, only):
        for y in range(S):
            for x in range(S):
                if inside(x, y) and s.part[y][x] in only:
                    s.put(x, y, c)

    def ink(s, skip=()):
        """encre autour de la silhouette et entre les parties (sur celle de derrière)"""
        part, z, pts = s.part, s.z, []
        for y in range(S):
            for x in range(S):
                p = part[y][x]
                if p is None:
                    if any(0 <= x + dx < S and 0 <= y + dy < S and part[y + dy][x + dx] is not None
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        pts.append((x, y))
                    continue
                if p in skip:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < S and 0 <= yy < S and part[yy][xx] is not None and z[part[yy][xx]] > z[p] \
                            and part[yy][xx] not in skip:
                        pts.append((x, y))
                        break
        for x, y in pts:
            s.out[y][x] = hx(INK)

    def flames(s, x0, x1, base, amp, seed, phase=0):
        """langues de feu qui montent du portail (sans encre : elles éclairent)"""
        r = random.Random(seed)
        for x in range(x0, x1):
            h = base + amp * (.55 + .45 * math.sin(x * .95 + phase)) * (.6 + .4 * math.sin(x * .31 + 1.7 + phase))
            h = int(h + r.choice((0, 0, 1)))
            for i in range(h):
                t = i / max(1, h)
                s.put(x, S - 1 - i, FIRE[0] if t < .3 else FIRE[1] if t < .55 else FIRE[2] if t < .8 else FIRE[3])

    def pixels(s):
        return [c for row in s.out for c in row]


# anatomie (pixels du sprite ; le bord du portail est en bas, y = 80)
HEAD = _ellipse(40, 23, 9, 10)
JAW = _poly([(31, 24), (49, 24), (48, 31), (43, 36), (37, 36), (32, 31)])
EAR = [(32, 21), (25, 16), (28, 22), (32, 27)]
TRAPS = _poly([(33, 30), (47, 30), (58, 37), (22, 37)])
TORSO = _poly([(23, 35), (57, 35), (56, 48), (51, 64), (50, 80), (30, 80), (29, 64), (24, 48)])
ARM = [(11, 41), (25, 44), (20, 58), (8, 57)]
FORE = [(5, 54), (20, 55), (19, 70), (5, 70)]
HORN = [(34, 17), (29, 12), (25, 6), (26, 1), (29, 0)]
COLLAR = [(25, 37), (12, 27), (10, 15), (18, 18), (29, 28), (32, 34)]
LINING = [(24, 34), (14, 26), (13, 19), (18, 21), (28, 29)]


def _claws(cx, side):
    """griffes noires qui agrippent le bord du portail"""
    return [(f'griffe{side}{i}', (lambda f: lambda x, y: f(x, y) is not None)(
        _tube([(cx + k, 74), (cx + k - .6, 78), (cx + k + .4, 80)], 1.7, .5)), 'horn')
            for i, k in enumerate((-6, -2, 2, 6))]


# bras droit : au repos (sur le portail), qui se lève (avant-bras vers nous), levé (main à hauteur du visage) ;
# fb : pied de la flamme ; fer : fer brisé du poignet ; chain : chaîne qui en pend
POSES = {
    'rest': dict(arm=_poly(_mx(ARM)), fore=_poly(_mx(FORE)), hand=_ellipse(68, 72.5, 9, 5.5), claws=True, fb=None,
                 fer=_poly([(58.5, 62), (77.5, 62), (77.5, 66), (58.5, 66)]), rivets=[(62, 63), (66, 63), (70, 63), (74, 63)],
                 chain=[(77, 67), (78, 69), (78, 71)]),
    'lift': dict(arm=_poly([(56, 41), (68, 40), (77, 54), (69, 58)]), fore=_poly([(64, 58), (78, 56), (78, 47), (65, 48)]),
                 hand=_ellipse(71, 46, 6, 3.8), claws=False, fb=(71, 41),
                 fer=_poly([(64, 51), (78, 50), (78, 54), (64, 55)]), rivets=[(67, 52), (71, 52), (75, 51)],
                 chain=[(78, 55), (78, 57), (77, 59), (78, 61)]),
    'raise': dict(arm=_poly([(56, 41), (68, 40), (77, 53), (69, 57)]), fore=_poly([(67, 56), (78, 52), (75, 35), (65, 36)]),
                  hand=_ellipse(69.5, 33, 6.2, 3.8), claws=False, fb=(70, 22),
                  fer=_poly([(64, 42), (77, 40), (77.5, 44), (64.5, 46)]), rivets=[(67, 43), (71, 42), (75, 41)],
                  chain=[(77, 45), (78, 47), (78, 49), (77, 51), (78, 53)]),
}


def lucifer(pose='rest', fl=0.0, phase=0.0):
    """pose : 'rest', 'lift' ou 'raise' ; fl : taille de la flamme (0 à 1) ; phase : son vacillement"""
    P, FB = POSES[pose], POSES[pose]['fb']
    hl, hr = _tube(HORN, 4.4, .7), _tube(_mx(HORN), 4.4, .7)
    parts = [
        ('colG', _poly(COLLAR), 'cloth'), ('colD', _poly(_mx(COLLAR)), 'cloth'),
        ('cheveuxArr', _poly([(31, 18), (36, 12), (44, 12), (49, 18), (53, 30), (52, 37), (47, 31), (33, 31), (28, 37),
                              (27, 30)]), 'hair'),
        ('cornG', lambda x, y: hl(x, y) is not None, 'horn'), ('cornD', lambda x, y: hr(x, y) is not None, 'horn'),
        ('oreilleG', _poly(EAR), 'skin'), ('oreilleD', _poly(_mx(EAR)), 'skin'),
        ('traps', TRAPS, 'skin'), ('torse', TORSO, 'skin'),
        ('brasG', _poly(ARM), 'skin'), ('deltG', _ellipse(20, 40, 8.5, 7.5), 'skin'), ('avbG', _poly(FORE), 'skin'),
        ('poingG', _ellipse(12, 72.5, 9, 5.5), 'skin'),
        ('brasD', P['arm'], 'skin'), ('avbD', P['fore'], 'skin'), ('deltD', _ellipse(60, 40, 8.5, 7.5), 'skin'),
        ('mainD', P['hand'], 'skin'),
    ] + _claws(12, 'G') + (_claws(68, 'D') if P['claws'] else []) + [
        ('tete', HEAD, 'skin'), ('machoire', JAW, 'skin'),
        ('cheveux', _poly([(31, 22), (32, 16), (36, 13), (44, 13), (48, 16), (49, 22), (47, 18), (40, 16), (33, 18)]), 'hair'),
        ('barbe', _poly([(36, 33), (44, 33), (42, 40), (40, 45), (38, 40)]), 'hair'),
        ('ferG', _poly([(2.5, 62), (21.5, 62), (21.5, 66), (2.5, 66)]), 'iron'),
        ('ferD', P['fer'], 'iron'),
    ]
    g = _Body(parts, {'skin': {'ramp': SK}, 'horn': {'ramp': HRN, 'lava': .5}, 'hair': {'ramp': HAIR, 'lava': .4},
                      'iron': {'ramp': IRON, 'lava': .7}, 'cloth': {'ramp': CLOTH, 'lava': .5}})
    put = g.put

    # doublure rouge du col
    g.fill(_poly(LINING), SK[1], ('colG',))
    g.fill(_poly(_mx(LINING)), SK[1], ('colD',))
    g.path([(14, 19), (19, 21), (28, 29)], SK[2])
    g.path([(66, 19), (61, 21), (52, 29)], SK[2])

    # cornes annelées, un anneau d'or
    for y in range(S):
        for x in range(S):
            for f in (hl, hr):
                t = f(x, y)
                if t is None or g.part[y][x] not in ('cornG', 'cornD'):
                    continue
                if .30 <= t < .38:
                    put(x, y, GOLD[3] if t < .33 else GOLD[2] if t < .36 else GOLD[1])
                elif (t % .13) < .025:
                    put(x, y, HRN[max(1, g.level[y][x] - 1)])

    # muscles et creux des joues : un pli deux crans plus sombre (pas de l'encre)
    for pts in [[(24, 46), (30, 49), (37, 50), (39, 48)], [(56, 46), (50, 49), (43, 50), (41, 48)], [(40, 46), (40, 52)],
                [(34, 56), (46, 56)], [(35, 62), (45, 62)], [(40, 53), (40, 66)], [(11, 50), (14, 54)], [(6, 66), (10, 68)],
                [(69, 50), (66, 54)] if pose == 'rest' else [(70, 45), (72, 50)], [(33, 28), (35, 31)], [(47, 28), (45, 31)]]:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for i in range(n + 1):
                x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
                if g.part[y][x] in ('torse', 'brasG', 'avbG', 'brasD', 'avbD', 'tete', 'machoire') and g.lav[y][x] <= .3:
                    put(x, y, SK[max(1, g.level[y][x] - 2)])

    # couronne fine, rubis
    for x in range(33, 48):
        put(x, 15, GOLD[2]); put(x, 16, GOLD[1])
    for x, h in ((34, 1), (37, 2), (40, 3), (43, 2), (46, 1)):
        for i in range(h):
            put(x, 14 - i, GOLD[3] if i == h - 1 else GOLD[2])
    put(40, 15, '#ff3a4a'); put(40, 16, '#a8142a')

    # torque d'or au cou, attaches du col
    g.path([(33, 36), (36, 38), (40, 39), (44, 38), (47, 36)], GOLD[2])
    g.path([(34, 37), (40, 40), (46, 37)], GOLD[1])
    put(40, 40, GOLD[3]); put(40, 41, '#ff3a4a')
    for x, y in ((25, 36), (55, 36)):
        put(x, y, GOLD[3]); put(x + 1, y, GOLD[2]); put(x, y + 1, GOLD[1])

    # fers brisés : rivets, chaînes coupées qui pendent
    for k in (-6, -2, 2, 6):
        put(12 + k, 63, IRON[4])
    for x, y in P['rivets']:
        put(x, y, IRON[4])
    for chain in (P['chain'], [(3, 66), (2, 68), (2, 70)]):
        for i, (x, y) in enumerate(chain):
            put(x, y, IRON[3] if i % 2 else IRON[2])

    g.ink(skip=('cheveux', 'machoire'))

    # visage, après l'encre (le trait entre la tête et la mâchoire passerait sur les yeux)
    g.path([(32, 21), (35, 21), (38, 23)], INK); g.path([(32, 22), (35, 22), (38, 24)], INK)     # sourcil qui plonge
    g.path([(48, 18), (45, 19), (42, 21)], INK); g.path([(48, 19), (45, 20), (42, 22)], INK)     # sourcil levé
    for x, y in [(33, 24), (34, 24), (35, 24), (36, 24), (37, 25)]:
        put(x, y, GOLD[3])
    for x, y in [(33, 23), (34, 23), (35, 23), (36, 23), (37, 24)]:
        put(x, y, INK)                                                                           # paupière lourde
    for x, y in [(47, 23), (46, 23), (45, 23), (44, 23), (43, 24), (46, 24), (45, 24)]:
        put(x, y, GOLD[3])
    put(35, 24, '#ffffff'); put(45, 23, '#ffffff')
    g.path([(39, 26), (39, 28)], SK[1]); put(38, 29, INK); put(41, 29, INK)                     # nez
    g.path([(34, 31), (37, 32), (41, 32), (44, 31), (46, 29)], INK)                             # sourire en coin
    g.path([(37, 33), (41, 33)], SK[4]); put(47, 28, INK)

    if FB and fl > 0:
        # lueur violette de la flamme sur son flanc (par paliers : pixels nets)
        for y in range(S):
            for x in range(S):
                p = g.part[y][x]
                if p is None or p.startswith('corn') or p.startswith('col') or p == 'mainD':
                    continue
                d = math.hypot(x - FB[0], (y - FB[1]) * 1.2)
                if d < 22 and g.out[y][x] != hx(INK):
                    a = .09 * (3 if d < 9 else 2 if d < 15 else 1) * fl
                    c, v = g.out[y][x], hx(VIO[2])
                    put(x, y, tuple(round(c[i] + (v[i] - c[i]) * a) for i in range(3)) + (255,))
        # la flamme : une larme qui ondule, contour violet sombre
        Hb, Ht, Wd = 7.5 * fl ** .5, 18 * fl, 6.2 * fl ** .5
        pts = {}
        for y in range(S):
            for x in range(S):
                dy = y + .5 - FB[1]
                if dy > Hb or dy < -Ht:
                    continue
                w = Wd * math.sqrt(max(0, 1 - (dy / Hb) ** 2)) if dy > 0 else Wd * (1 + dy / Ht) ** 1.4
                r = abs(x + .5 - FB[0] - 2.0 * math.sin(dy * .4 + phase) * (-dy / Ht if dy < 0 else 0))
                if r <= w:
                    pts[(x, y)] = (r / max(w, .1), dy)
        for (x, y), (r, dy) in pts.items():
            edge = any((x + dx, y + ddy) not in pts for dx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            core = r < .5 and -6 * fl < dy < 5 * fl
            put(x, y, VIO[0] if edge else VIO[4] if core and r < .25 else VIO[3] if core else VIO[2] if r < .8 else VIO[1])
        if fl >= 1:      # étincelles
            for i, (x, y) in enumerate(((66, 6), (75, 9), (62, 12), (78, 16))):
                put(x, y - (1 if (i + int(phase * 2)) % 2 else 0), VIO[2])
    # griffes de la main ouverte, recourbées vers la flamme
    if pose == 'raise':
        for cx, lean in ((64, 1), (67, 0), (72, 0), (75, -1)):
            put(cx, 31, HRN[2]); put(cx, 30, HRN[3]); put(cx + lean, 29, HRN[4])
    elif pose == 'lift':
        for cx in (66, 69, 73, 76):
            put(cx, 44, HRN[2]); put(cx, 43, HRN[3])

    # le portail flambe autour de lui
    g.flames(28, 53, 3, 6, 7)
    g.flames(2, 22, 1, 2, 8, 1.3)
    g.flames(58, 78, 1, 2, 9, 2.1)
    return g.pixels()


def portal():
    """96 × 16 : bords de roche noire encrés, lave en bandes nettes, bulles"""
    W, H = 96, 16
    px = [EMPTY] * (W * H)
    ROCK = [INK, '#221418', '#33232a', '#4a3a40']
    LAVA = ['#7a1a08', '#c8401a', '#ff7a1a', '#ffc23f', '#fff0a0']
    for y in range(H):
        for x in range(W):
            if x < 10 or x >= W - 10:
                k = 0 if x in (0, 9, W - 10, W - 1) or y == H - 1 else 3 if y < 2 else 2 if y < 3 else 1
                px[y * W + x] = hx(ROCK[k])
            else:
                w = math.sin(x * .45 + y * .2) * .5 + math.sin(x * .17 - y * .6) * .5
                t = (y / H) * .9 - w * .2
                px[y * W + x] = hx(LAVA[4 if t < .08 else 3 if t < .25 else 2 if t < .5 else 1 if t < .75 else 0])
    for bx, by in [(20, 6), (47, 4), (71, 8), (33, 10), (60, 11)]:
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            px[(by + dy) * W + bx + dx] = hx(LAVA[4] if dy == 0 else LAVA[3])
        px[(by - 1) * W + bx] = hx(LAVA[2])
    return px


# images du rugissement, dans l'ordre : la main se lève (1 à 3), la flamme vacille (4 à 6)
ROAR = [('lift', 0, 0), ('lift', .3, 0), ('raise', .5, 0), ('raise', 1, 0), ('raise', 1, 1.6), ('raise', 1, 3.2)]


def lucifer_textures():
    """{ nom : (largeur, hauteur, pixels) }"""
    out = {'lucifer': (S, S, lucifer()), 'lucifer_portal': (96, 16, portal())}
    for i, (pose, fl, phase) in enumerate(ROAR, 1):
        out[f'lucifer_roar{i}'] = (S, S, lucifer(pose, fl, phase))
    return out
