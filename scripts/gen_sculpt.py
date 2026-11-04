"""Sculpteur de sprites (04/11/2026, Jules ; écrit pour Cerbère, scripts/gen_cerbere.py) : un sprite = des parties
(formes : ellipse, polygone, tube) posées de l'arrière vers l'avant, chacune avec sa matière (palette du plus sombre au
plus clair). Rendu : volumes bombés (distance au bord), facettes de Voronoï en option (pierre taillée, comme
gen_golbute.py), deux lumières (une clé froide d'en haut, la lave qui remonte du sol), ombre qui monte du sol, reflet
sur les bords du haut, puis l'encre : autour de la silhouette et entre les parties (sur celle de derrière).
Pixels hors des parties : '_fx' (cernés d'encre : pointes, griffes, chaîne) ou '_fl' (lumières sans encre : flammes,
gueules). Toile de W × H quelconque. stdlib uniquement.
"""
import math
import random


def hx(c):
    if isinstance(c, tuple):
        return c
    c = c.lstrip('#')
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)


def ellipse(cx, cy, rx, ry):
    return lambda x, y: ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1


def poly(pts):
    def inside(x, y):
        xc, yc, c = x + .5, y + .5, False
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                if xc < x0 + (yc - y0) * (x1 - x0) / (y1 - y0):
                    c = not c
        return c
    return inside


def tube(pts, w0, w1):
    """tube le long d'une ligne brisée, de largeur w0 à w1"""
    segs = list(zip(pts, pts[1:]))
    total = sum(math.dist(a, b) for a, b in segs) or 1

    def inside(x, y):
        p, acc = (x + .5, y + .5), 0
        for a, b in segs:
            L = math.dist(a, b) or 1
            t = max(0, min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L)))
            q = (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
            w = w0 + (w1 - w0) * (acc + t * L) / total
            if math.dist(p, q) <= w / 2:
                return True
            acc += L
        return False
    return inside


def union(*fs):
    return lambda x, y: any(f(x, y) for f in fs)


def norm(v):
    n = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / n for c in v)


class Sculpt:
    """parts : [(nom, forme, matière)] de l'arrière vers l'avant ; mats : matière -> {'pal': [encre, sombre..clair],
    'facets': True}. R : rayon de bombage ; key : direction de la lumière froide ; dark : (y où l'ombre du sol commence,
    hauteur sur laquelle elle monte, force) ; lava_up : (y où la lave commence, hauteur, palette) ; hi : niveaux gagnés
    par le bord du haut (premier pixel, second)"""

    def __init__(s, W, H, parts, mats, seed=1, nseeds=220, R=6.0, key=(-.55, -.7, .75), dark=None, hi=(2, 1),
                 lava_up=None):
        s.W, s.H = W, H
        rng = random.Random(seed)
        s.part = part = [[None] * W for _ in range(H)]
        s.z = z = {}
        s.mat = {n: m for n, _, m in parts}
        for i, (name, inside, _) in enumerate(parts):
            z[name] = i
            for y in range(H):
                for x in range(W):
                    if inside(x, y):
                        part[y][x] = name
        seeds = [(rng.uniform(0, W), rng.uniform(0, H)) for _ in range(nseeds)]
        cell = [[None] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                if part[y][x] is not None:
                    best = min(range(nseeds), key=lambda i: (seeds[i][0] - x) ** 2 + (seeds[i][1] - y) ** 2 * 1.3)
                    cell[y][x] = (part[y][x], best)
        d = s._dist()
        key = norm(key)

        def pillow(x, y):
            p = part[y][x]
            h = lambda xx, yy: min(d[yy][xx], R) / R if 0 <= xx < W and 0 <= yy < H and part[yy][xx] == p else 0
            return norm((h(x - 1, y) - h(x + 1, y), h(x, y - 1) - h(x, y + 1), .9))
        acc = {}
        for y in range(H):
            for x in range(W):
                if cell[y][x] is not None:
                    a = acc.setdefault(cell[y][x], [0, 0, 0, 0])
                    n = pillow(x, y)
                    a[0] += n[0]; a[1] += n[1]; a[2] += n[2]; a[3] += 1
        fnorm = {}
        for k, (ax, ay, az, n) in sorted(acc.items(), key=lambda kv: (kv[0][0], kv[0][1])):
            fnorm[k] = norm((ax / n + rng.uniform(-.45, .45), ay / n + rng.uniform(-.45, .45), az / n))
        s.out = out = [[(0, 0, 0, 0)] * W for _ in range(H)]
        level = [[0] * W for _ in range(H)]
        bayer = [[0, 2], [3, 1]]
        upn = norm((0, .9, .45))
        for y in range(H):
            for x in range(W):
                p = part[y][x]
                if p is None:
                    continue
                M = mats[s.mat[p]]
                P = M['pal']
                facets = M.get('facets', True)
                fn = fnorm[cell[y][x]] if facets else (0, 0, 1)
                pn = pillow(x, y)
                w = .7 if facets else 0
                n = tuple(fn[i] * w + pn[i] * (1 - w) for i in range(3))
                lum = .06 + .94 * max(0, sum(n[i] * key[i] for i in range(3))) ** 1.5
                if dark:
                    lum *= 1 - dark[2] * max(0, min(1, (y - dark[0]) / dark[1]))
                v = lum * (len(P) - 1.5) + 1 + (bayer[y % 2][x % 2] - 1.5) * .07
                k = max(1, min(len(P) - 1, int(v)))
                level[y][x] = k
                out[y][x] = hx(P[k])
                if lava_up:          # lave d'en bas : les faces tournées vers le bas, près du sol, prennent la lueur
                    g = max(0, (y - lava_up[0]) / lava_up[1]) ** 1.2 * max(0, sum(n[i] * upn[i] for i in range(3)))
                    if g > .3:
                        L = lava_up[2]
                        out[y][x] = hx(L[min(len(L) - 1, int((g - .3) / .7 * len(L)))])
        # arête du haut qui accroche la lumière
        for y in range(1, H):
            for x in range(W):
                p = part[y][x]
                if p is None:
                    continue
                q = part[y - 1][x]
                if q is None or z[q] < z[p]:
                    P = mats[s.mat[p]]['pal']
                    out[y][x] = hx(P[min(len(P) - 1, level[y][x] + hi[0])])
                    if y + 1 < H and part[y + 1][x] == p:
                        out[y + 1][x] = hx(P[min(len(P) - 1, level[y + 1][x] + hi[1])])
        # arêtes des facettes, taillées
        for y in range(H):
            for x in range(W):
                c = cell[y][x]
                if c is None or not mats[s.mat[c[0]]].get('facets', True):
                    continue
                for dx, dy in ((1, 0), (0, 1)):
                    xx, yy = x + dx, y + dy
                    if xx < W and yy < H and cell[yy][xx] is not None and cell[yy][xx][0] == c[0] and cell[yy][xx] != c:
                        P = mats[s.mat[c[0]]]['pal']
                        tx, ty = (x, y) if level[y][x] <= level[yy][xx] else (xx, yy)
                        out[ty][tx] = hx(P[max(1, level[ty][tx] - 1)])

    def _dist(s):
        """distance (en pixels) de chaque pixel au bord de sa partie : sert à bomber les volumes"""
        W, H, part = s.W, s.H, s.part
        d = [[0 if part[y][x] is None else 99 for x in range(W)] for y in range(H)]
        for y in range(H):
            for x in range(W):
                if d[y][x] and any(not (0 <= x + dx < W and 0 <= y + dy < H) or part[y + dy][x + dx] != part[y][x]
                                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    d[y][x] = 1
        for _ in range(2):   # chamfrein deux passes
            for y in range(H):
                for x in range(W):
                    if d[y][x] > 1:
                        for dx, dy in ((-1, 0), (0, -1), (-1, -1), (1, -1)):
                            if 0 <= x + dx < W and 0 <= y + dy < H and part[y + dy][x + dx] == part[y][x]:
                                d[y][x] = min(d[y][x], d[y + dy][x + dx] + 1)
            for y in range(H - 1, -1, -1):
                for x in range(W - 1, -1, -1):
                    if d[y][x] > 1:
                        for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 1)):
                            if 0 <= x + dx < W and 0 <= y + dy < H and part[y + dy][x + dx] == part[y][x]:
                                d[y][x] = min(d[y][x], d[y + dy][x + dx] + 1)
        return d

    def put(s, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.W and 0 <= y < s.H:
            s.out[y][x] = hx(c)

    def fx(s, x, y, c, kind='_fx'):
        """pixel qui peut sortir des parties : '_fx' (sera cerné d'encre) ou '_fl' (lumière, sans encre)"""
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.W and 0 <= y < s.H:
            s.out[y][x] = hx(c)
            if s.part[y][x] is None:
                s.part[y][x] = kind

    def line(s, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            s.put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c)

    def path(s, pts, c):
        for a, b in zip(pts, pts[1:]):
            s.line(a[0], a[1], b[0], b[1], c)

    def finish(s, ink, merge=()):
        """encre autour de la silhouette et entre les parties ; merge : groupes de parties fondues (pas d'encre entre
        elles : un seul bloc de muscles)"""
        W, H, part = s.W, s.H, s.part
        z = dict(s.z); z['_fx'] = z['_fl'] = 10 ** 6
        group = {n: i for i, g in enumerate(merge) for n in g}
        inks = []
        for y in range(H):
            for x in range(W):
                p = part[y][x]
                if p is None:
                    if any(0 <= x + dx < W and 0 <= y + dy < H and part[y + dy][x + dx] not in (None, '_fl')
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        inks.append((x, y))
                    continue
                if p in ('_fx', '_fl'):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    q = part[yy][xx] if 0 <= xx < W and 0 <= yy < H else None
                    if q not in (None, '_fx', '_fl') and z[q] > z[p] and not (p in group and group.get(q) == group[p]):
                        inks.append((x, y)); break
        for x, y in inks:
            s.out[y][x] = hx(ink)

    def pixels(s):
        return [c for row in s.out for c in row]
