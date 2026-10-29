"""Le Carreau, la ville du spawn (29/10/2026) : textures en pixel art, direction « Crépuscule de forge » (inspiration
Darkest Dungeon, choisie par Jules). Appelé par scripts/gen_textures.py ; renvoie { nom: (largeur, hauteur, pixels) }.

Chaque bâtiment a sa propre silhouette et tient en largeur dans sa place (TOWN.buildings : w cases × 16 px, h cases de
haut au plus). Tons sombres et éteints, lumières orange (fenêtres, four, feu) et verte (tour du mage). finish() ajoute
le contour noir d'un pixel à l'extérieur des formes, puis une lumière rasante orange sur les pixels exposés au ciel
(le soleil couchant derrière la ville)."""
import math
import random

T = (0, 0, 0, 0)


def H(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


INK = H('#0a0605')
WOOD, WOOD2, WOODL = H('#33211a'), H('#24160f'), H('#4e3420')
PLAST, PLAST2 = H('#4e3d32'), H('#403128')
BRICK, BRICK2, MORT = H('#52281f'), H('#401d16'), H('#24110d')
ROOF, ROOF2 = H('#28191a'), H('#36231f')
SLATE, SLATE2 = H('#22232c'), H('#30323e')
STONE, STONE2, STONEL = H('#3e3842'), H('#302a34'), H('#4e4852')
BLUE, BLUE2 = H('#343a4e'), H('#283044')
IRON, IRON2 = H('#34343c'), H('#55555f')
LIT, LIT2, LIT3 = H('#ff9a3a'), H('#ffcf6a'), H('#fff0b0')
MAGIC, MAGIC2, MAGICD = H('#5aff8a'), H('#c8ffd8'), H('#1f6a3a')
CLOTH, CLOTH2 = H('#6e1a16'), H('#8a2a20')
STRAW, STRAW2 = H('#8a6a30'), H('#6a5022')
DARK = H('#140c08')
GEMS = [H('#ff3b5c'), H('#3db8ff'), H('#5aff8a'), H('#ffd23f'), H('#c77dff')]


class Pix:
    def __init__(s, W, Hh, seed):
        s.W, s.H, s.p, s.rnd = W, Hh, [T] * (W * Hh), random.Random(seed)

    def set(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.W and 0 <= y < s.H:
            s.p[y * s.W + x] = c

    def get(s, x, y):
        return s.p[y * s.W + x] if 0 <= x < s.W and 0 <= y < s.H else T

    def rect(s, x, y, w, h, c):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                s.set(xx, yy, c)

    def poly(s, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for i in range(len(pts)):
                (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
                if (y1 <= y + .5 < y2) or (y2 <= y + .5 < y1):
                    xs.append(x1 + (y + .5 - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(int(round(a)), int(round(b))):
                    s.set(x, y, c)

    def line(s, x0, y0, x1, y1, c, th=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(int(n) + 1):
            s.rect(round(x0 + (x1 - x0) * i / n) - th // 2, round(y0 + (y1 - y0) * i / n) - th // 2, th, th, c)

    def disc(s, cx, cy, r, c):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r:
                    s.set(x, y, c)

    def ring(s, cx, cy, r, c, th=2):
        for y in range(int(cy - r - 2), int(cy + r + 3)):
            for x in range(int(cx - r - 2), int(cx + r + 3)):
                if r - th <= math.hypot(x + .5 - cx, y + .5 - cy) <= r:
                    s.set(x, y, c)

    def speckle(s, x, y, w, h, base, alt, k=.14):
        """remplit un rectangle de base, quelques pixels alt (crépi, terre)"""
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                s.set(xx, yy, alt if s.rnd.random() < k else base)

    def recolor(s, x, y, w, h, frm, to, every=1, axis='y'):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                if s.get(xx, yy) == frm and ((yy if axis == 'y' else xx) % every == 0):
                    s.set(xx, yy, to)

    # ---------- matières ----------
    def bricks(s, x, y, w, h, a=BRICK, b=BRICK2, m=MORT):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                row = (yy - y) // 4
                mort = (yy - y) % 4 == 3 or (xx - x + (row % 2) * 5) % 10 == 0
                s.set(xx, yy, m if mort else (a if s.rnd.random() < .7 else b))

    def stones(s, x, y, w, h, a=STONE, b=STONE2, m=INK):
        """gros moellons irréguliers"""
        for yy in range(int(y), int(y + h)):
            row = (yy - y) // 6
            for xx in range(int(x), int(x + w)):
                off = (row * 7) % 12
                joint = (yy - y) % 6 == 5 or (xx - x + off) % 12 == 0
                s.set(xx, yy, H('#1c171e') if joint else (a if (xx // 12 + row) % 3 else b))

    def planks(s, x, y, w, h, vertical=True, a=WOOD, b=WOOD2):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                k = (xx - x) if vertical else (yy - y)
                s.set(xx, yy, b if k % 5 == 4 else a)

    def shingles(s, pts, a=ROOF, b=ROOF2):
        s.poly(pts, a)
        ys = [p[1] for p in pts]
        for yy in range(int(min(ys)), int(max(ys)) + 1):
            for xx in range(s.W):
                if s.get(xx, yy) == a and ((yy % 4 == 0) or ((xx + (yy // 4) % 2 * 3) % 6 == 0 and yy % 4 < 3)):
                    s.set(xx, yy, b)

    def window(s, x, y, w=8, h=10, lit=LIT, lit2=LIT2, frame=WOOD2):
        s.rect(x - 1, y - 1, w + 2, h + 2, frame)
        s.rect(x, y, w, h, lit)
        s.rect(x + 1, y + 1, w - 2, max(1, h // 2 - 1), lit2)
        s.rect(x + w // 2, y, 1, h, frame)
        s.rect(x, y + h // 2, w, 1, frame)

    def arch_door(s, x, y, w, h, c=DARK, frame=WOOD2):
        s.poly([(x - 1, y + h), (x - 1, y + 5), (x + 2, y), (x + w - 2, y), (x + w + 1, y + 5), (x + w + 1, y + h)], frame)
        s.poly([(x, y + h), (x, y + 6), (x + 3, y + 2), (x + w - 3, y + 2), (x + w, y + 6), (x + w, y + h)], c)

    def lantern(s, x, y):
        s.rect(x, y, 6, 8, LIT)
        s.rect(x + 1, y + 1, 4, 3, LIT3)
        s.rect(x - 1, y - 2, 8, 2, IRON)

    def finish(s, rim=True):
        q = list(s.p)
        for y in range(s.H):
            for x in range(s.W):
                if s.get(x, y)[3] == 0 and any(s.get(x + dx, y + dy)[3] and s.get(x + dx, y + dy) != INK
                                               for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    q[y * s.W + x] = INK
        s.p = q
        if rim:
            q = list(s.p)
            for y in range(1, s.H):
                for x in range(s.W):
                    c = s.get(x, y)
                    if c[3] and c != INK and s.get(x, y - 1) == INK and c not in (LIT, LIT2, LIT3, MAGIC, MAGIC2):
                        q[y * s.W + x] = tuple(min(255, int(c[i] * .6 + (190, 92, 40)[i] * .4)) for i in range(3)) + (255,)
            s.p = q
        return (s.W, s.H, s.p)


# ---------------------------------------------------------------- bâtiments

def tavern():
    """Taverne (Social, 7 × 8) : rez à colombages, étage en surplomb qui penche, toit affaissé, tonneaux"""
    c = Pix(112, 128, 2910)
    c.speckle(10, 86, 92, 42, PLAST, PLAST2)
    for x in (10, 40, 70, 99):
        c.rect(x, 86, 3, 42, WOOD)
    c.rect(10, 86, 92, 3, WOOD)
    c.line(13, 126, 39, 90, WOOD, 2)
    c.line(72, 90, 98, 126, WOOD, 2)
    c.poly([(2, 88), (6, 46), (108, 42), (112, 86)], PLAST)
    c.recolor(2, 42, 110, 46, PLAST, PLAST2, 3)
    for x0, x1 in ((6, 4), (38, 37), (72, 72), (104, 108)):
        c.line(x0, 46, x1, 87, WOOD, 3)
    c.line(4, 66, 110, 64, WOOD, 3)
    c.rect(2, 85, 110, 4, WOOD2)
    for i in range(14):
        c.rect(4 + i * 8, 89, 3, 3, WOOD2)
    c.shingles([(0, 48), (30, 14), (50, 22), (66, 4), (112, 44), (112, 50), (0, 52)])
    c.bricks(84, 2, 10, 22)
    c.rect(82, 0, 14, 3, BRICK2)
    c.window(16, 52); c.window(52, 50, 10, 10); c.window(88, 50)
    c.window(80, 98, 12, 10); c.window(22, 98, 12, 10)
    c.arch_door(47, 98, 20, 30)
    c.set(62, 115, LIT2)
    for cx, cy, r in ((100, 120, 8), (109, 123, 5)):
        c.disc(cx, cy, r, WOODL)
        c.rect(cx - r, cy - 1, 2 * r, 2, IRON)
    c.line(2, 70, 0, 70, IRON, 2)
    c.rect(0, 72, 4, 8, CLOTH)                                     # enseigne usée
    return c.finish()


def archives():
    """Archives (Historique, 5 × 7) : maison du greffier en pierre, pignon à horloge, piles de registres"""
    c = Pix(80, 112, 2911)
    c.stones(6, 54, 68, 58)
    c.shingles([(0, 58), (40, 22), (80, 58)], SLATE, SLATE2)
    c.stones(26, 6, 28, 34)                                        # pignon-clocher
    c.shingles([(22, 10), (40, 0), (58, 10)], SLATE, SLATE2)
    c.disc(40, 24, 9, H('#d8c89a'))
    c.ring(40, 24, 9, IRON2, 2)
    c.line(40, 24, 40, 18, INK)
    c.line(40, 24, 45, 26, INK)
    c.window(14, 66, 10, 12); c.window(56, 66, 10, 12)
    c.arch_door(31, 84, 18, 28)
    c.rect(56, 98, 16, 14, WOOD)                                   # caisse de registres
    for y in (100, 104, 108):
        c.rect(57, y, 14, 2, H('#6e5a3a'))
    c.rect(8, 104, 12, 8, H('#5a4630'))
    return c.finish()


def library():
    """Bibliothèque (Recherche, 6 × 9) : chapelle gothique, rosace allumée, clocheton pointu, porte en arc brisé"""
    c = Pix(96, 144, 2912)
    c.stones(4, 70, 66, 74)
    c.poly([(0, 74), (37, 30), (74, 74)], SLATE)
    c.recolor(0, 30, 74, 45, SLATE, SLATE2, 4)
    c.stones(68, 36, 24, 108, STONE2, STONE)                       # clocheton
    c.shingles([(64, 40), (80, 0), (96, 40)], SLATE, SLATE2)
    c.window(76, 52, 8, 12)
    c.disc(37, 84, 11, LIT)
    c.ring(37, 84, 11, STONEL, 2)
    c.line(37, 74, 37, 94, STONEL)
    c.line(27, 84, 47, 84, STONEL)
    c.disc(37, 84, 3, LIT3)
    c.poly([(26, 144), (26, 118), (37, 104), (48, 118), (48, 144)], STONEL)
    c.poly([(28, 144), (28, 119), (37, 108), (46, 119), (46, 144)], DARK)
    c.window(10, 106, 6, 16); c.window(58, 106, 6, 16)
    for x in (2, 70):
        c.rect(x, 74, 4, 70, STONE2)                               # contreforts
    return c.finish()


def training():
    """Salle d'entraînement (Skills, 6 × 7) : palissade de pieux, cabane au toit de chaume, mannequin, râtelier"""
    c = Pix(96, 112, 2913)
    c.planks(30, 54, 60, 58, True, WOOD, WOOD2)                    # cabane
    c.poly([(24, 58), (60, 30), (96, 58)], STRAW)
    for y in range(30, 58, 3):
        for x in range(96):
            if c.get(x, y) == STRAW and (x + y) % 5 == 0:
                c.set(x, y, STRAW2)
    c.window(68, 68, 10, 10)
    for i, x in enumerate(range(0, 96, 7)):                         # palissade pointue
        top = 78 + (i % 3) * 3
        c.poly([(x, 112), (x, top + 4), (x + 3, top), (x + 6, top + 4), (x + 6, 112)], WOODL if i % 2 else WOOD)
    c.rect(0, 92, 96, 3, WOOD2)
    c.rect(18, 70, 3, 42, WOOD)                                    # mannequin d'entraînement
    c.rect(10, 78, 19, 3, WOOD)
    c.poly([(12, 82), (27, 82), (25, 102), (14, 102)], STRAW)
    c.disc(19.5, 72, 5, STRAW2)
    c.rect(16, 86, 7, 2, CLOTH)
    c.line(52, 112, 52, 84, WOOD, 2); c.line(60, 112, 60, 84, WOOD, 2)   # râtelier
    c.rect(50, 86, 12, 2, WOOD2)
    for x in (53, 56, 59):
        c.line(x, 84, x + 2, 70, IRON2)
    c.lantern(88, 60)
    return c.finish()


def mage_tower():
    """Tour du mage (Sorts, 4 × 11) : tour penchée en pierre bleutée, chapeau pointu tordu, fenêtres vertes"""
    c = Pix(64, 176, 2914)
    for y in range(64, 176):
        lean = int((176 - y) * .06)
        for x in range(14 + lean, 50 + lean):
            row = (y - 64) // 6
            joint = (y - 64) % 6 == 5 or (x + (row % 2) * 6) % 12 == 0
            c.set(x, y, H('#1c2030') if joint else (BLUE if (x // 12 + row) % 3 else BLUE2))
    c.poly([(8, 72), (20, 52), (26, 30), (36, 10), (46, 2), (44, 18), (40, 40), (56, 72)], SLATE)
    c.recolor(0, 0, 64, 72, SLATE, SLATE2, 5)
    c.rect(12, 70, 46, 4, IRON)
    for y, x in ((90, 30), (122, 26), (150, 24)):
        c.window(x, y, 10, 12, MAGIC, MAGIC2, INK)
    c.disc(40, 60, 3, MAGIC)
    c.arch_door(22, 152, 18, 24)
    for x, y in ((4, 40), (58, 28), (54, 96), (2, 118)):
        c.set(x, y, MAGIC2)
    return c.finish()


def armory():
    """Armurerie (Stuff, 6 × 6) : forge ouverte sous un auvent sur poteaux, enclume, foyer rougeoyant, râtelier"""
    c = Pix(96, 96, 2915)
    c.stones(36, 34, 58, 62)                                       # mur du fond en pierre
    c.shingles([(0, 40), (28, 22), (96, 22), (96, 40)], ROOF, ROOF2)
    c.bricks(70, 0, 14, 24)
    c.rect(68, 0, 18, 3, IRON)
    for x in (4, 34):
        c.rect(x, 40, 4, 56, WOOD)
    c.rect(2, 40, 38, 3, WOOD2)
    c.bricks(48, 66, 34, 30)                                       # foyer
    c.poly([(52, 96), (52, 80), (65, 72), (78, 80), (78, 96)], LIT)
    c.poly([(57, 96), (57, 84), (65, 79), (73, 84), (73, 96)], LIT2)
    c.poly([(10, 84), (30, 84), (26, 88), (22, 88), (22, 96), (16, 96), (16, 88), (12, 88)], IRON)   # enclume
    c.rect(10, 84, 20, 1, IRON2)
    for x in (40, 44):
        c.line(x, 66, x, 50, IRON2)                                # épées accrochées
    c.poly([(84, 52), (94, 52), (94, 64), (89, 70), (84, 64)], CLOTH2)   # bouclier
    c.rect(88, 54, 2, 12, IRON2)
    return c.finish()


def warehouse():
    """Entrepôt (Inventaire, 7 × 7) : grange au toit brisé, grandes portes en X, lucarne et poulie, caisses et sacs"""
    c = Pix(112, 112, 2916)
    c.planks(8, 46, 96, 66, True, WOOD, WOOD2)
    c.shingles([(2, 50), (16, 26), (56, 8), (96, 26), (110, 50)], ROOF, ROOF2)
    c.rect(48, 26, 16, 16, WOOD2)                                  # lucarne
    c.rect(50, 28, 12, 12, LIT)
    c.rect(55, 28, 2, 12, WOOD2)
    c.rect(54, 14, 4, 10, WOOD)
    c.rect(40, 14, 32, 3, WOOD)                                    # poutre de la poulie
    c.line(70, 17, 70, 40, H('#8a7a5a'))
    c.rect(66, 40, 8, 6, WOOD2)
    for x0 in (32, 56):                                            # grandes portes
        c.rect(x0, 70, 24, 42, WOODL)
        c.rect(x0, 70, 24, 2, WOOD2); c.rect(x0, 110, 24, 2, WOOD2)
        c.line(x0, 72, x0 + 23, 109, WOOD2, 2)
        c.line(x0 + 23, 72, x0, 109, WOOD2, 2)
    c.rect(55, 70, 2, 42, DARK)
    c.window(14, 62, 8, 8); c.window(90, 62, 8, 8)
    for x, y, w in ((84, 96, 16), (90, 82, 12), (6, 98, 14)):     # caisses
        c.rect(x, y, w, 112 - y if y > 90 else 14, WOODL)
        c.line(x, y, x + w - 1, y + 13, WOOD2)
    c.disc(26, 106, 6, H('#7a6440'))                               # sac
    return c.finish()


def headframe():
    """Chevalement (Session, 5 × 7) : portique de bois noir en potence, molette, benne au bout du câble, lanterne"""
    c = Pix(80, 112, 2917)
    c.line(10, 111, 30, 22, WOOD, 5); c.line(70, 111, 50, 22, WOOD, 5)
    c.line(12, 111, 31, 26, WOODL, 1)
    for y in (48, 74, 98):
        k = (111 - y) / 89
        c.rect(round(10 + 20 * k), y, round(60 - 40 * k), 4, WOOD)
    c.line(16, 96, 62, 74, WOOD2, 2); c.line(18, 74, 64, 98, WOOD2, 2)
    c.line(22, 72, 58, 48, WOOD2, 2); c.line(22, 48, 58, 72, WOOD2, 2)
    c.rect(18, 20, 44, 6, WOOD); c.rect(14, 18, 52, 3, WOOD2)
    c.ring(40, 11, 11, IRON, 3); c.disc(40, 11, 2.5, IRON2)
    for a in range(0, 360, 45):
        for k in range(3, 9):
            c.set(round(40 + k * math.cos(math.radians(a))), round(11 + k * math.sin(math.radians(a))), IRON)
    c.line(29, 12, 29, 100, H('#1a1a20'))
    c.rect(25, 100, 9, 6, IRON); c.rect(25, 100, 9, 1, IRON2)
    c.lantern(56, 60)
    return c.finish()


def foundry():
    """Fonderie (Four, 6 × 9) : trapue en briques, cheminée géante cerclée de fer, gueule du four qui rougeoie"""
    c = Pix(96, 144, 2918)
    c.bricks(2, 96, 92, 48)
    c.shingles([(0, 98), (14, 78), (96, 74), (96, 98)], ROOF, ROOF2)
    c.bricks(64, 4, 22, 88, BRICK2, BRICK)
    for y in (20, 46, 70):
        c.rect(62, y, 26, 3, IRON); c.rect(62, y, 26, 1, IRON2)
    c.rect(60, 0, 30, 6, IRON)
    for x, col in ((66, LIT), (70, LIT2), (75, LIT), (80, LIT2), (83, LIT)):
        c.set(x, 6, col)
    c.poly([(22, 144), (22, 118), (30, 108), (42, 104), (54, 108), (62, 118), (62, 144)], DARK)
    c.poly([(26, 144), (26, 120), (32, 112), (42, 109), (52, 112), (58, 120), (58, 144)], LIT)
    c.poly([(31, 144), (31, 123), (36, 117), (42, 115), (48, 117), (53, 123), (53, 144)], LIT2)
    c.rect(37, 128, 10, 16, LIT3)
    for x in range(22, 63, 6):
        c.rect(x, 104 + abs(42 - x) // 5, 3, 3, STONE)
    c.window(8, 108, 8, 8); c.window(72, 108, 8, 8)
    c.disc(80, 142, 6, H('#1c1618'))
    return c.finish()


def crusher():
    """Concasseur (5 × 7) : machine à vapeur en fer riveté, grand volant, trémie, goulotte de cailloux, tuyau"""
    c = Pix(80, 112, 2919)
    c.rect(10, 56, 50, 56, IRON)                                   # bâti
    for y in range(58, 112, 8):
        for x in range(12, 60, 8):
            c.set(x, y, IRON2)
    c.rect(10, 56, 50, 3, IRON2)
    c.poly([(8, 56), (2, 26), (52, 26), (44, 56)], WOOD)           # trémie en bois
    c.recolor(0, 26, 60, 30, WOOD, WOOD2, 4)
    for x in range(6, 48, 4):
        c.set(x, 25, STONEL); c.set(x + 2, 24, STONE)
    c.ring(60, 74, 15, IRON, 3)                                    # volant
    for a in range(0, 360, 60):
        c.line(60, 74, round(60 + 12 * math.cos(math.radians(a))), round(74 + 12 * math.sin(math.radians(a))), IRON)
    c.disc(60, 74, 3, IRON2)
    c.rect(66, 0, 6, 58, IRON); c.rect(64, 0, 10, 4, IRON2)        # tuyau d'échappement
    c.poly([(60, 112), (60, 100), (78, 110), (78, 112)], IRON2)    # goulotte
    for i in range(16):
        c.disc(64 + c.rnd.randrange(0, 15), 108 + c.rnd.randrange(0, 4), 1.6, STONEL if i % 2 else STONE)
    c.window(22, 70, 12, 8, LIT, LIT2, IRON2)                      # foyer de la chaudière
    return c.finish()


def workshop():
    """Atelier (Craft, 6 × 7) : échoppe à colombages, auvent de toile rayée, établi dehors, outils au mur"""
    c = Pix(96, 112, 2920)
    c.speckle(6, 40, 84, 72, PLAST, PLAST2)
    for x in (6, 46, 86):
        c.rect(x, 40, 4, 72, WOOD)
    c.line(10, 40, 46, 76, WOOD, 2)
    c.shingles([(0, 44), (48, 8), (96, 44)], ROOF, ROOF2)
    c.window(58, 52, 14, 12)
    for i in range(8):                                             # auvent rayé
        c.poly([(4 + i * 11, 72), (15 + i * 11, 72), (15 + i * 11, 82), (4 + i * 11, 84)], CLOTH if i % 2 else CLOTH2)
    c.rect(4, 70, 88, 2, WOOD2)
    c.rect(8, 96, 40, 4, WOODL); c.rect(10, 100, 3, 12, WOOD); c.rect(43, 100, 3, 12, WOOD)   # établi
    c.line(16, 95, 26, 91, IRON2); c.rect(30, 92, 8, 4, IRON)
    c.arch_door(62, 86, 18, 26)
    for x, y in ((14, 50), (22, 48), (30, 50)):                    # outils au mur
        c.line(x, y, x, y + 14, WOOD2)
        c.rect(x - 2, y, 5, 3, IRON2)
    return c.finish()


def jeweler():
    """Joaillier (Amélioration, 5 × 8) : boutique étroite et haute, façade sombre, vitrine en saillie où brillent les gemmes"""
    c = Pix(80, 128, 2921)
    c.planks(10, 40, 60, 88, True, H('#2a1e2a'), H('#1e1520'))
    c.shingles([(4, 44), (40, 2), (76, 44)], SLATE, SLATE2)
    c.rect(34, 18, 12, 14, H('#2a1e2a'))
    c.window(36, 20, 8, 10, MAGIC, MAGIC2, INK)
    c.rect(6, 82, 50, 4, WOOD2)                                    # vitrine en saillie
    c.rect(8, 86, 46, 22, H('#1a1418'))
    c.rect(10, 88, 42, 18, H('#3a2a20'))
    for i in range(14):
        col = GEMS[i % len(GEMS)]
        x, y = 12 + c.rnd.randrange(0, 38), 90 + c.rnd.randrange(0, 14)
        c.rect(x, y, 2, 2, col)
        c.set(x, y, LIT3)
    c.rect(6, 108, 50, 3, WOOD2)
    c.window(18, 52, 10, 12); c.window(48, 52, 10, 12)
    c.arch_door(58, 100, 12, 28)
    c.rect(66, 70, 12, 2, IRON)                                    # enseigne en losange
    c.poly([(72, 72), (78, 79), (72, 86), (66, 79)], GEMS[1])
    c.set(72, 76, LIT3)
    return c.finish()


# ---------------------------------------------------------------- décor de la place et de la rue

def lamppost():
    c = Pix(16, 32, 2922)
    c.rect(7, 9, 2, 22, IRON); c.rect(5, 29, 6, 3, IRON)
    c.rect(3, 1, 10, 2, IRON); c.rect(4, 3, 8, 6, LIT); c.rect(5, 4, 6, 3, LIT3)
    c.rect(4, 8, 8, 2, IRON)
    return c.finish(False)


def campfire():
    c = Pix(16, 16, 2923)
    c.line(1, 14, 14, 11, WOOD, 2); c.line(1, 11, 14, 14, WOOD, 2)
    for col, x, y, w, h in [(CLOTH2, 4, 5, 8, 7), (LIT, 5, 3, 6, 8), (LIT2, 6, 6, 4, 5), (LIT3, 7, 8, 2, 3)]:
        c.rect(x, y, w, h, col)
    c.rect(7, 1, 2, 2, LIT)
    for x in (1, 13):
        c.rect(x, 12, 2, 2, STONE)
    return c.finish(False)


def pedestal():
    c = Pix(32, 16, 2924)
    c.stones(2, 2, 28, 14, STONEL, STONE)
    c.rect(0, 0, 32, 3, STONEL)
    c.rect(9, 6, 14, 4, H('#8a6a20')); c.rect(9, 6, 14, 1, LIT2)
    return c.finish(False)


def banner(cloth, dark, emblem):
    """bannière de jauge (16 × 32) : le jeu dessine la jauge dans le cadre (colonnes 4 à 11, lignes 6 à 25)"""
    c = Pix(16, 32, 2925)
    c.rect(1, 0, 2, 32, WOOD); c.rect(0, 0, 16, 2, IRON)
    c.rect(3, 2, 11, 26, cloth); c.rect(13, 2, 1, 26, dark)
    for x in range(3, 14):
        c.rect(x, 28, 1, max(0, 3 - abs(x - 8)), cloth)
    c.rect(4, 5, 8, 22, dark)
    c.rect(6, 2, 4, 2, emblem)
    return c.finish(False)


def cobble():
    c = Pix(16, 16, 2926)
    c.speckle(0, 0, 16, 16, H('#2e2622'), H('#262020'), .2)
    for y in (0, 5, 10, 15):
        c.rect(0, y, 16, 1, H('#140e0c'))
    for row, y0 in enumerate((1, 6, 11)):
        for x in range(2 if row % 2 else 6, 16, 7):
            c.rect(x, y0, 1, 4, H('#140e0c'))
    c.rect(0, 0, 16, 1, H('#4a3a30'))
    return (16, 16, c.p)


def cloud():
    """nuage de crépuscule (48 × 16) : longue traînée rouge sombre, dessous éclairé"""
    c = Pix(48, 16, 2927)
    for (x, y, w, h) in [(2, 8, 44, 5), (10, 5, 16, 5), (22, 3, 14, 7), (34, 6, 10, 4)]:
        c.rect(x, y, w, h, H('#6e2a1e', 200))
    c.rect(4, 12, 40, 1, H('#c86a3a', 200)); c.rect(8, 13, 32, 1, H('#e08a4a', 170))
    return (48, 16, c.p)


def town():
    """toutes les textures du Carreau : { nom: (largeur, hauteur, pixels) }"""
    return {
        'town_tavern': tavern(), 'town_archives': archives(), 'town_library': library(), 'town_training': training(),
        'town_mage_tower': mage_tower(), 'town_armory': armory(), 'town_warehouse': warehouse(),
        'town_headframe': headframe(), 'town_foundry': foundry(), 'town_crusher': crusher(),
        'town_workshop': workshop(), 'town_jeweler': jeweler(),
        'town_lamppost': lamppost(), 'town_campfire': campfire(), 'town_pedestal': pedestal(),
        'town_banner_angel': banner(H('#c8ccd8'), H('#7a8092'), LIT2),
        'town_banner_demon': banner(H('#5a2a8a'), H('#2e1248'), CLOTH2),
        'town_cobble': cobble(), 'town_cloud': cloud(),
    }
