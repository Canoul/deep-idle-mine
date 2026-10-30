"""Boss et mobs des tours du Jugement (30/10/2026, Jules : direction « guerriers » pour les deux camps).

Boss : 48 × 80 pixels = 3 × 5 cases en pleine résolution (avant : 24 × 40, chaque pixel doublé en jeu).
  - Ange : archange en cuirasse d'or, auréole, cheveux d'or, grandes ailes déployées, épée de lumière.
  - Démon : seigneur démon massif, peau rouge fissurée de lave, épaulières noires à pointes, cornes, ailes de
    chauve-souris, hache, queue ; liseré de braise pour qu'il se lise sur le fond sombre de sa tour.
Mobs des étages : 16 × 32 pixels = 1 × 2 cases.
  - Séraphin : petit soldat de l'Ange (casque et cuirasse d'or, ailes repliées, lance de lumière).
  - Diablotin : petit démon rouge (cornes, ailes de chauve-souris aux os clairs, fourche, queue, braises) ; sans
    liseré (à 16 pixels de large, il remplissait les creux entre les jambes et les ailes).
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math


def hx(c):
    c = c.lstrip('#')
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)


class Img:
    """petite toile de pixels : formes pleines, symétrie, contour"""
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.p = [[(0, 0, 0, 0)] * w for _ in range(h)]

    def px(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            s.p[y][x] = hx(c) if isinstance(c, str) else c

    def get(s, x, y):
        return s.p[y][x] if 0 <= x < s.w and 0 <= y < s.h else (0, 0, 0, 0)

    def rect(s, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                s.px(xx, yy, c)

    def ellipse(s, cx, cy, rx, ry, c):
        for y in range(s.h):
            for x in range(s.w):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    s.px(x, y, c)

    def ring(s, cx, cy, rx, ry, t, c):
        for y in range(s.h):
            for x in range(s.w):
                d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
                di = ((x + .5 - cx) / max(rx - t, .1)) ** 2 + ((y + .5 - cy) / max(ry - t, .1)) ** 2
                if d <= 1 and di > 1:
                    s.px(x, y, c)

    def line(s, x0, y0, x1, y1, c, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            for dx in range(w):
                for dy in range(w):
                    s.px(round(x - (w - 1) / 2 + dx), round(y - (w - 1) / 2 + dy), c)

    def poly(s, pts, c):
        for y in range(s.h):
            yc, xs = y + .5, []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(s.w):
                    if a <= x + .5 <= b:
                        s.px(x, y, c)

    def mirror(s, fn):
        """dessine fn(toile) et son symétrique gauche-droite"""
        t = Img(s.w, s.h)
        fn(t)
        for y in range(s.h):
            for x in range(s.w):
                if t.p[y][x][3]:
                    s.p[y][x] = t.p[y][x]
                    s.p[y][s.w - 1 - x] = t.p[y][x]

    def outline(s, c):
        """contour d'un pixel autour de la silhouette (lisibilité sur le fond des tours)"""
        o, add = hx(c), []
        for y in range(s.h):
            for x in range(s.w):
                if s.p[y][x][3]:
                    continue
                if any(s.get(x + dx, y + dy)[3] and s.get(x + dx, y + dy) != o for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    add.append((x, y))
        for x, y in add:
            s.p[y][x] = o

    def flat(s):
        return [c for row in s.p for c in row]


def angel():
    g = Img(48, 80)

    def wing(t):   # aile gauche, déployée vers le haut, en 5 rangs de plumes
        for i, (y, x0, col) in enumerate([(4, 0, '#ffffff'), (9, 1, '#f2f8ff'), (14, 2, '#e3effc'), (19, 4, '#cfe2f6'), (24, 7, '#bcd5ef')]):
            t.poly([(x0, y), (x0 + 4, y - 3), (19, 14 + i * 3), (19, 21 + i * 3), (x0 + 3, y + 6)], col)
        for i in range(5):
            t.line(1 + i, 6 + i * 5, 18, 17 + i * 3, '#9fbfe0')
    g.mirror(wing)
    g.ring(24, 7, 7, 2.6, 1.2, '#ffd23f')                                        # auréole
    g.ellipse(24, 15, 5, 6, '#f3dcc4')                                           # tête
    g.rect(19, 9, 10, 4, '#ffd76a'); g.rect(18, 11, 2, 7, '#ffd76a'); g.rect(28, 11, 2, 7, '#ffd76a')   # cheveux d'or
    g.rect(21, 15, 2, 1, '#2a6fd6'); g.rect(26, 15, 2, 1, '#2a6fd6')             # yeux
    g.rect(23, 18, 2, 1, '#c99a80')
    g.poly([(15, 23), (33, 23), (31, 42), (17, 42)], '#ffd23f')                  # cuirasse d'or
    g.poly([(19, 25), (29, 25), (28, 38), (20, 38)], '#ffe58a')
    g.rect(23, 25, 2, 15, '#d9a91c')
    g.ellipse(14, 24, 4, 3, '#ffd23f'); g.ellipse(34, 24, 4, 3, '#ffd23f')       # épaulières
    g.poly([(16, 42), (32, 42), (35, 62), (13, 62)], '#f4f7ff')                  # jupe
    g.poly([(22, 42), (26, 42), (27, 62), (21, 62)], '#bfe3ff')
    g.rect(13, 61, 23, 2, '#ffd23f')
    g.rect(17, 63, 5, 14, '#e8c45a'); g.rect(26, 63, 5, 14, '#e8c45a')           # jambières
    g.rect(16, 77, 7, 3, '#b8892a'); g.rect(25, 77, 7, 3, '#b8892a')
    g.rect(10, 26, 4, 14, '#f4f7ff'); g.rect(10, 40, 4, 3, '#f3dcc4')            # bras gauche
    g.rect(34, 26, 4, 12, '#f4f7ff'); g.rect(34, 37, 5, 4, '#f3dcc4')            # bras droit
    g.line(39, 6, 39, 38, '#eaf6ff', 3); g.line(39, 6, 39, 38, '#ffffff')        # épée de lumière
    g.rect(35, 38, 9, 2, '#ffd23f'); g.rect(38, 40, 3, 5, '#b8892a'); g.px(39, 4, '#ffffff'); g.px(39, 5, '#eaf6ff')
    g.outline('#3a4f6e')
    return g


def demon():
    g = Img(48, 80)

    def wing(t):   # aile de chauve-souris (os et membrane en dents) et corne
        t.poly([(19, 22), (2, 4), (0, 30), (5, 26), (6, 36), (11, 30), (14, 38), (19, 30)], '#5a1f2e')
        t.line(19, 22, 2, 4, '#c8b49a', 2); t.line(12, 16, 5, 26, '#c8b49a'); t.line(15, 19, 11, 30, '#c8b49a'); t.line(8, 11, 1, 29, '#c8b49a')
        t.poly([(17, 13), (13, 1), (11, 2), (14, 15)], '#e6d6bd')
        t.px(12, 0, '#ffffff')
    g.mirror(wing)
    g.ellipse(24, 15, 6, 6, '#b0303a')                                           # tête
    g.rect(19, 13, 4, 2, '#ffd23f'); g.rect(26, 13, 4, 2, '#ffd23f')             # yeux
    g.rect(20, 18, 9, 2, '#2a0a10'); g.px(21, 18, '#ffffff'); g.px(27, 18, '#ffffff')   # gueule, crocs
    g.poly([(12, 22), (36, 22), (33, 44), (15, 44)], '#9a2632')                  # torse massif
    g.poly([(18, 26), (30, 26), (29, 40), (19, 40)], '#c03a46')
    g.line(24, 26, 24, 40, '#ff8a2a'); g.line(20, 32, 28, 33, '#ff8a2a')         # fissures de lave
    g.ellipse(12, 23, 6, 4, '#2a1a20'); g.ellipse(36, 23, 6, 4, '#2a1a20')       # épaulières noires à pointes
    g.poly([(8, 21), (6, 15), (11, 19)], '#c8b49a'); g.poly([(40, 21), (42, 15), (37, 19)], '#c8b49a')
    g.rect(6, 26, 6, 16, '#9a2632'); g.rect(36, 26, 6, 13, '#9a2632')            # bras
    g.rect(5, 42, 8, 4, '#2a1a20'); g.rect(36, 39, 8, 5, '#2a1a20')              # poings gantés
    g.poly([(15, 44), (33, 44), (35, 52), (13, 52)], '#2a1a20')                  # ceinture et pagne
    g.rect(22, 45, 4, 4, '#ffd23f')
    g.poly([(14, 52), (22, 52), (21, 76), (15, 76)], '#7a1e28'); g.poly([(26, 52), (34, 52), (33, 76), (27, 76)], '#7a1e28')   # jambes
    g.rect(13, 76, 9, 4, '#1a0d10'); g.rect(26, 76, 9, 4, '#1a0d10')             # sabots
    g.line(34, 66, 44, 74, '#9a2632', 2); g.poly([(43, 72), (47, 71), (46, 76)], '#9a2632')   # queue
    g.line(40, 12, 40, 70, '#4a3a3a', 2)                                         # hache
    g.poly([(41, 12), (47, 8), (47, 26), (41, 22)], '#8a8f99'); g.line(47, 8, 47, 26, '#ff8a2a')
    g.outline('#ff6a3b')                                                         # liseré de braise
    return g


def seraph():
    g = Img(16, 32)

    def wing(t):   # ailes repliées dans le dos
        t.poly([(5, 9), (0, 5), (0, 19), (4, 16)], '#ffffff')
        t.line(1, 8, 4, 11, '#bfe3ff'); t.line(1, 12, 4, 14, '#bfe3ff')
    g.mirror(wing)
    g.ring(8, 1.6, 4, 1.4, 1, '#ffd23f')                                         # auréole
    g.rect(5, 3, 6, 6, '#f3dcc4')                                                # visage
    g.rect(4, 3, 8, 2, '#ffd23f'); g.rect(4, 3, 1, 5, '#ffd23f'); g.rect(11, 3, 1, 5, '#ffd23f')   # casque d'or
    g.px(6, 6, '#2a6fd6'); g.px(9, 6, '#2a6fd6')
    g.rect(4, 9, 8, 7, '#ffd23f'); g.rect(6, 10, 4, 5, '#ffe58a'); g.rect(7, 10, 2, 6, '#d9a91c')   # cuirasse
    g.poly([(4, 16), (12, 16), (13, 23), (3, 23)], '#f4f7ff'); g.rect(7, 16, 2, 7, '#bfe3ff')       # jupe
    g.rect(3, 23, 10, 1, '#ffd23f')
    g.rect(5, 24, 2, 6, '#e8c45a'); g.rect(9, 24, 2, 6, '#e8c45a')               # jambières
    g.rect(4, 30, 3, 2, '#b8892a'); g.rect(9, 30, 3, 2, '#b8892a')
    g.rect(12, 10, 2, 5, '#f4f7ff'); g.rect(12, 15, 2, 2, '#f3dcc4')             # bras
    g.line(14, 2, 14, 30, '#e8d9a0'); g.rect(13, 1, 3, 3, '#eaf6ff'); g.px(14, 0, '#ffffff')   # lance de lumière
    g.outline('#3a4f6e')
    return g


def imp():
    g = Img(16, 32)

    def side(t):   # aile de chauve-souris (os clairs) et corne
        t.poly([(5, 9), (0, 5), (0, 18), (2, 15), (3, 19), (5, 15)], '#7a2a4a')
        t.line(5, 9, 0, 5, '#c8b49a'); t.line(3, 8, 1, 16, '#c8b49a')
        t.poly([(5, 5), (3, 1), (4, 0), (6, 4)], '#e6d6bd')
    g.mirror(side)
    g.rect(5, 4, 6, 6, '#c0303a')                                                # tête
    g.px(6, 6, '#ffd23f'); g.px(9, 6, '#ffd23f'); g.rect(7, 8, 2, 1, '#2a0a10')
    g.rect(5, 10, 6, 8, '#b0303a'); g.rect(7, 11, 2, 6, '#8a1f2a'); g.px(6, 12, '#ff8a2a'); g.px(9, 14, '#ff8a2a')   # corps, braises
    g.rect(5, 18, 6, 2, '#2a1a20')                                               # pagne
    g.rect(5, 20, 2, 9, '#b0303a'); g.rect(9, 20, 2, 9, '#b0303a')               # jambes
    g.rect(4, 29, 3, 2, '#1a0d10'); g.rect(9, 29, 3, 2, '#1a0d10')               # sabots
    g.line(11, 19, 13, 25, '#8a1f2a'); g.px(14, 25, '#ff6a3b'); g.px(13, 26, '#ff6a3b')   # queue fourchue
    g.rect(3, 12, 2, 3, '#b0303a')                                               # bras qui tient la fourche
    g.line(2, 5, 2, 29, '#9a9aa5')                                               # fourche
    g.rect(1, 4, 3, 1, '#c8c8d2'); g.px(1, 3, '#c8c8d2'); g.px(2, 2, '#ffffff'); g.px(3, 3, '#c8c8d2')
    return g


def bosses():
    """{ nom : pixels } des boss (48 × 80)"""
    return {'boss_angel': angel().flat(), 'boss_demon': demon().flat()}


def tower_mobs():
    """{ nom : pixels } des mobs des étages (16 × 32)"""
    return {'seraph': seraph().flat(), 'imp': imp().flat()}
