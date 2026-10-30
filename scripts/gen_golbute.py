"""Le Golbute, boss de l'Instance II (30/10/2026, Jules : direction « Darkest Dungeon », comme les boss des tours).

80 × 80 pixels = 5 × 5 cases en pleine résolution. Colosse de pierre voûté : petite tête enfoncée sous une arcade
lourde, yeux de braise, épaules en rochers, bras de gorille dont les poings touchent le sol, fers brisés aux poignets,
cœur de cristal dans la poitrine et éclats de cristal qui percent le dos (sa forme cristallisée s'annonce), sueur
blanche du golem de la mine.
Rendu : chaque partie du corps est découpée en facettes (cellules de Voronoï, graine fixe) éclairées d'en haut à
gauche, ombre qui monte du sol, gros trait d'encre autour de la silhouette et entre les parties.
Cristallisé : même silhouette et mêmes facettes, en cristal bleu (arêtes claires, reflets), yeux blancs.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

from gen_bosses import hx

S = 80
LIGHT = (-0.55, -0.7, 0.75)
_n = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _n for c in LIGHT)

# palettes, du plus sombre au plus clair (index 0 = encre)
STONE = ['#0e0d0f', '#1f1e22', '#2e2c30', '#413e41', '#56524f', '#6e6862', '#8a8279', '#a89e90']
CRYSTAL = ['#06131f', '#0f2d47', '#17466b', '#22648f', '#3487b5', '#56acd6', '#8fd6f2', '#d8f6ff']
IRON = ['#0e0d0f', '#25262a', '#3d3f45', '#5c5f66', '#9a9ca3']
RUST = '#7a3a1a'
EMBER = ['#7a2408', '#d4500e', '#ff8a2a', '#ffd27a']
VEIN = ['#1b4560', '#3f8fb8', '#7fd6ff', '#e6fbff']
DRIP = ['#b9b2a2', '#efeadc']


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
    """symétrique gauche-droite d'un polygone"""
    return [(S - x, y) for x, y in pts]


# parties du corps, de l'arrière vers l'avant : (nom, forme, matière)
PARTS = [
    ('dos', _ellipse(40, 17, 23, 13), 'body'),
    ('eclat1', _poly([(22, 15), (17, 1), (27, 11)]), 'shard'),
    ('eclat2', _poly([(28, 11), (27, 0), (34, 9)]), 'shard'),
    ('eclat3', _poly([(48, 9), (55, 2), (54, 12)]), 'shard'),
    ('eclat4', _poly([(55, 13), (64, 5), (60, 16)]), 'shard'),
    ('jambeG', _poly([(22, 52), (38, 52), (37, 70), (40, 79), (18, 79), (21, 70)]), 'body'),
    ('jambeD', _poly(_mx([(22, 52), (38, 52), (37, 70), (40, 79), (18, 79), (21, 70)])), 'body'),
    ('bassin', _poly([(24, 47), (56, 47), (53, 59), (27, 59)]), 'body'),
    ('torse', _poly([(16, 23), (64, 23), (59, 45), (51, 54), (29, 54), (21, 45)]), 'body'),
    ('brasG', _poly([(5, 27), (19, 29), (17, 50), (3, 48)]), 'body'),
    ('brasD', _poly(_mx([(5, 27), (19, 29), (17, 50), (3, 48)])), 'body'),
    ('avbrasG', _poly([(2, 45), (18, 46), (20, 66), (0, 67)]), 'body'),
    ('avbrasD', _poly(_mx([(2, 45), (18, 46), (20, 66), (0, 67)])), 'body'),
    ('poingG', _ellipse(10, 72, 10.5, 8.5), 'body'),
    ('poingD', _ellipse(70, 72, 10.5, 8.5), 'body'),
    ('ferG', _poly([(0, 57), (20, 58), (20, 64), (0, 64)]), 'iron'),
    ('ferD', _poly(_mx([(0, 57), (20, 58), (20, 64), (0, 64)])), 'iron'),
    ('epauleG', _ellipse(18, 24, 14, 11), 'body'),
    ('epauleD', _ellipse(62, 23, 15, 12), 'body'),
    ('tete', _ellipse(40, 25, 9, 8.5), 'body'),
    ('arcade', _poly([(29, 18), (51, 18), (50, 23), (40, 25), (30, 23)]), 'body'),
    ('machoire', _poly([(32, 28), (48, 28), (46, 34), (34, 34)]), 'body'),
]


def _facets(part, rng):
    """découpe chaque partie en facettes : cellule de Voronoï la plus proche (graine fixe)"""
    seeds = [(rng.uniform(0, S), rng.uniform(0, S)) for _ in range(150)]
    cell = [[None] * S for _ in range(S)]
    for y in range(S):
        for x in range(S):
            if part[y][x] is None:
                continue
            best = min(range(len(seeds)), key=lambda i: (seeds[i][0] - x) ** 2 + (seeds[i][1] - y) ** 2 * 1.3)
            cell[y][x] = (part[y][x], best)
    return cell


def _dist(part):
    """distance (en pixels) de chaque pixel au bord de sa partie : sert à bomber les volumes"""
    INF = 99
    d = [[0 if part[y][x] is None else INF for x in range(S)] for y in range(S)]
    for y in range(S):
        for x in range(S):
            if d[y][x]:
                p = part[y][x]
                edge = any(not (0 <= x + dx < S and 0 <= y + dy < S) or part[y + dy][x + dx] != p
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                d[y][x] = 1 if edge else INF
    for _ in range(2):   # chamfrein deux passes
        for y in range(S):
            for x in range(S):
                if d[y][x] > 1:
                    for dx, dy in ((-1, 0), (0, -1), (-1, -1), (1, -1)):
                        if 0 <= x + dx < S and 0 <= y + dy < S and part[y + dy][x + dx] == part[y][x]:
                            d[y][x] = min(d[y][x], d[y + dy][x + dx] + 1)
        for y in range(S - 1, -1, -1):
            for x in range(S - 1, -1, -1):
                if d[y][x] > 1:
                    for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 1)):
                        if 0 <= x + dx < S and 0 <= y + dy < S and part[y + dy][x + dx] == part[y][x]:
                            d[y][x] = min(d[y][x], d[y + dy][x + dx] + 1)
    return d


def _build():
    part = [[None] * S for _ in range(S)]
    z = {}
    for i, (name, inside, _) in enumerate(PARTS):
        z[name] = i
        for y in range(S):
            for x in range(S):
                if inside(x, y):
                    part[y][x] = name
    return part, z


def golbute_sprite(crystal=False):
    rng = random.Random(1730)
    part, z = _build()
    mat = {name: m for name, _, m in PARTS}
    cell = _facets(part, rng)
    d = _dist(part)

    # normale bombée (gradient de la distance au bord) puis moyenne par facette, avec un peu de hasard : pierre taillée
    def pillow(x, y):
        p, R = part[y][x], 7.0
        h = lambda xx, yy: min(d[yy][xx], R) / R if 0 <= xx < S and 0 <= yy < S and part[yy][xx] == p else 0
        gx, gy = h(x - 1, y) - h(x + 1, y), h(x, y - 1) - h(x, y + 1)
        nz = 0.9
        n = math.sqrt(gx * gx + gy * gy + nz * nz)
        return gx / n, gy / n, nz / n
    acc = {}
    for y in range(S):
        for x in range(S):
            if cell[y][x] is not None:
                a = acc.setdefault(cell[y][x], [0, 0, 0, 0])
                nx, ny, nz = pillow(x, y)
                a[0] += nx; a[1] += ny; a[2] += nz; a[3] += 1
    fnorm = {}
    for k, (ax, ay, az, n) in sorted(acc.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        jx, jy = rng.uniform(-.45, .45), rng.uniform(-.45, .45)
        vx, vy, vz = ax / n + jx, ay / n + jy, az / n
        m = math.sqrt(vx * vx + vy * vy + vz * vz)
        fnorm[k] = (vx / m, vy / m, vz / m)

    out = [[(0, 0, 0, 0)] * S for _ in range(S)]
    level = [[0] * S for _ in range(S)]
    bayer = [[0, 2], [3, 1]]
    pal = {'body': CRYSTAL if crystal else STONE, 'shard': CRYSTAL, 'iron': IRON}
    for y in range(S):
        for x in range(S):
            p = part[y][x]
            if p is None:
                continue
            m = mat[p]
            fn = fnorm[cell[y][x]]
            pn = pillow(x, y)
            nx, ny, nz = (fn[i] * .7 + pn[i] * .3 for i in range(3))
            lum = max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) ** 1.6
            lum = .06 + .94 * lum
            lum *= 1 - .6 * max(0, (y - 28) / 52)                # le bas du corps plonge dans l'ombre
            if crystal or m == 'shard':                          # le cristal s'éclaire de l'intérieur, autour du cœur
                lum = .12 + .7 * lum + .35 * max(0, 1 - math.hypot(x - 40, y - 40) / 34)
            if p == 'tete' and 23 <= y:                          # visage noyé dans l'ombre de l'arcade
                lum *= .25
            P = pal[m]
            v = lum * (len(P) - 1.5) + 1 + (bayer[y % 2][x % 2] - 1.5) * .07
            k = max(1, min(len(P) - 1, int(v)))
            level[y][x] = k
            out[y][x] = hx(P[k])

    # lumière qui tombe d'en haut : le bord supérieur de chaque partie accroche la lumière
    for y in range(1, S):
        for x in range(S):
            p = part[y][x]
            if p is None or mat[p] == 'iron' or (p == 'tete' and y >= 23):
                continue
            q = part[y - 1][x]
            if q is None or z[q] < z[p]:
                P = pal[mat[p]]
                k = min(len(P) - 1, level[y][x] + (3 if y < 40 else 1))
                out[y][x] = hx(P[k])
                if y + 1 < S and part[y + 1][x] == p:
                    out[y + 1][x] = hx(P[min(len(P) - 1, level[y + 1][x] + 1)])

    # arêtes des facettes : plus sombres sur la pierre (taille), plus claires sur le cristal (reflet)
    for y in range(S):
        for x in range(S):
            c = cell[y][x]
            if c is None or mat[c[0]] == 'iron':
                continue
            for dx, dy in ((1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if xx < S and yy < S and cell[yy][xx] is not None and cell[yy][xx][0] == c[0] and cell[yy][xx] != c:
                    P = pal[mat[c[0]]]
                    if crystal or mat[c[0]] == 'shard':
                        tx, ty = (x, y) if level[y][x] >= level[yy][xx] else (xx, yy)
                        out[ty][tx] = hx(P[min(len(P) - 1, level[ty][tx] + 1)])
                    else:
                        tx, ty = (x, y) if level[y][x] <= level[yy][xx] else (xx, yy)
                        out[ty][tx] = hx(P[max(1, level[ty][tx] - 1)])

    def put(x, y, c):
        if 0 <= x < S and 0 <= y < S:
            out[y][x] = hx(c) if isinstance(c, str) else c

    def line(x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            put(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), c)

    # fissures profondes (pierre) / failles laiteuses (cristal)
    for pts in [[(22, 30), (26, 35), (25, 40), (29, 44)], [(57, 28), (54, 34), (56, 39)], [(8, 31), (11, 37), (9, 42)],
                [(70, 52), (73, 58)], [(28, 62), (31, 67), (30, 73)], [(51, 60), (49, 66)], [(64, 18), (67, 22)]]:
        for (a, b), (c, e) in zip(pts, pts[1:]):
            line(a, b, c, e, CRYSTAL[6] if crystal else STONE[0])

    # filons de cristal qui partent du cœur (forme de pierre : la lumière bleue sous la roche)
    if not crystal:
        for pts in [[(40, 39), (34, 36), (30, 31)], [(40, 39), (47, 43), (52, 41), (55, 35)], [(40, 41), (38, 47), (40, 52)]]:
            for (a, b), (c, e) in zip(pts, pts[1:]):
                line(a, b, c, e, VEIN[1])
        for (x, y) in [(30, 31), (55, 35), (40, 52), (34, 36), (52, 41)]:
            put(x, y, VEIN[2])

    # cœur de cristal enchâssé dans la poitrine
    heart = _poly([(40, 33), (45, 39), (40, 46), (35, 39)])
    for y in range(30, 48):
        for x in range(32, 48):
            if heart(x, y):
                put(x, y, (VEIN if not crystal else ['#ffffff'] * 4)[2 if (x + y) % 3 else 1])
    for (x, y, c) in [(39, 36, 3), (40, 37, 3), (38, 38, 3), (41, 41, 1), (42, 40, 1)]:
        put(x, y, VEIN[c])
    put(40, 35, '#ffffff'); put(39, 37, '#ffffff')

    # yeux de braise sous l'arcade (cristal : blancs)
    E = ['#9fe8ff', '#ffffff', '#ffffff', '#ffffff'] if crystal else EMBER
    for ex in (33, 43):
        for x in range(ex, ex + 4):
            put(x, 24, E[1]); put(x, 25, E[2])
        put(ex + 1, 25, E[3]); put(ex + 2, 25, E[3])
        put(ex - 1, 25, E[0]); put(ex + 4, 24, E[0])
    # halo des yeux dans l'ombre du visage
    for ex in (33, 43):
        for x in range(ex - 1, ex + 5):
            put(x, 26, E[0])
    # gueule béante : trou noir, crocs de pierre en haut et en bas
    maw, tooth = (CRYSTAL[1], CRYSTAL[7]) if crystal else (STONE[0], STONE[6])
    for y, (x0, x1) in [(29, (35, 45)), (30, (34, 46)), (31, (34, 46)), (32, (35, 45))]:
        for x in range(x0, x1 + 1):
            put(x, y, maw)
    for x in (35, 38, 42, 45):
        put(x, 29, tooth); put(x, 30, tooth)
    for x in (36, 40, 44):
        put(x, 32, tooth); put(x, 31, tooth)
    # jointures des poings : doigts repliés
    for fx in (10, 70):
        for k in (-5, -1, 3):
            for y in range(66, 71):
                put(fx + k + (1 if fx > 40 else 0), y, STONE[0] if not crystal else CRYSTAL[1])

    # fers brisés : rivets, rouille, chaîne qui pend
    for fx in (0, S - 20):
        for x in range(fx, fx + 20):
            put(x, 59, IRON[4] if x % 5 else IRON[3]); put(x, 63, IRON[1])
        for x in range(fx + 2, fx + 20, 5):
            put(x, 61, IRON[4]); put(x + 1, 62, IRON[1])
        for (x, y) in [(fx + 7, 62), (fx + 8, 62), (fx + 14, 60), (fx + 15, 61)]:
            put(x, y, RUST)
    # chaînes brisées qui pendent des fers : maillons de 3 × 3, alternés de face et de profil
    for cx, top, n in [(16, 64, 3), (63, 64, 4)]:
        for i in range(n):
            y = top + i * 4
            if i % 2 == 0:
                for (a, b) in [(-1, 0), (0, 0), (1, 0), (-1, 1), (1, 1), (-1, 2), (0, 2), (1, 2)]:
                    put(cx + a, y + b, IRON[4] if b == 0 else IRON[3])
                put(cx, y + 1, IRON[0])
            else:
                for b in range(4):
                    put(cx, y + b, IRON[4] if b < 2 else IRON[3])
            put(cx + 2, y + 1, IRON[0]); put(cx - 2, y + 1, IRON[0])

    # sueur blanche du golem de la mine (pas sur le cristal)
    if not crystal:
        for x, y, h in [(36, 34, 4), (44, 34, 6), (25, 33, 5), (60, 34, 7), (7, 37, 6), (73, 36, 5), (47, 52, 4)]:
            for i in range(h):
                put(x, y + i, DRIP[0] if i < h - 1 else DRIP[1])

    # encre : entre les parties (sur celle de derrière) et autour de la silhouette
    ink = hx(CRYSTAL[0] if crystal else STONE[0])
    inks = []
    for y in range(S):
        for x in range(S):
            p = part[y][x]
            if p is None:
                if any(0 <= x + dx < S and 0 <= y + dy < S and part[y + dy][x + dx] is not None
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    inks.append((x, y))
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < S and 0 <= yy < S and part[yy][xx] is not None and z[part[yy][xx]] > z[p]:
                    inks.append((x, y))
                    break
    for x, y in inks:
        out[y][x] = ink
    return [c for row in out for c in row]


def golbute():
    """{ nom : (largeur, hauteur, pixels) } : le Golbute et sa forme cristallisée"""
    return {'golbute': (S, S, golbute_sprite(False)), 'golbute_crystal': (S, S, golbute_sprite(True))}
