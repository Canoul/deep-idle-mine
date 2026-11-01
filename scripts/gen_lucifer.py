"""Lucifer, le boss de He's coming (01/11/2026, Geoffrey) : 80 × 80 pixels = 5 × 5 cases.

Gros démon charismatique : seuls la tête, le torse et les bras sortent du sol, poings posés sur le bord du portail. Peau rouge
éclairée d'en haut à gauche, longues cornes noires, cheveux et barbiche noirs, yeux d'or, sourire en coin ; le bas du torse
s'embrase au contact de la lave. Portail : 96 × 16 pixels, de la lave entre deux bords de roche sombre.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

from gen_bosses import hx

S = 80
EMPTY = (0, 0, 0, 0)
INK = hx('#14060a')
SKIN = [hx('#4a0c12'), hx('#7a1218'), hx('#a81c1e'), hx('#cf3226'), hx('#ee5a3a')]
HORN = [hx('#17131a'), hx('#2d2730'), hx('#544a55'), hx('#8a7d82')]
HAIR = hx('#120c12')
GOLD = hx('#ffd23f')
LAVA = [hx('#7a1a08'), hx('#d4380e'), hx('#ff7a1a'), hx('#ffc23f'), hx('#fff0a0')]


def tone(ramp, k):
    return ramp[max(0, min(len(ramp) - 1, int(k * len(ramp))))]


def lucifer():
    px = [EMPTY] * (S * S)

    def put(x, y, c):
        if 0 <= x < S and 0 <= y < S:
            px[y * S + x] = c

    def ball(cx, cy, rx, ry, ramp, boost=0.0):
        """ovale éclairé d'en haut à gauche"""
        for y in range(int(cy - ry), int(cy + ry) + 2):
            for x in range(int(cx - rx), int(cx + rx) + 2):
                u, v = (x - cx) / rx, (y - cy) / ry
                if u * u + v * v <= 1:
                    put(x, y, tone(ramp, 0.62 - 0.42 * u - 0.38 * v + boost))

    def limb(pts, r0, r1, ramp):
        """membre : une suite de points, épaisseur de r0 à r1"""
        for i in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            n = int(max(abs(bx - ax), abs(by - ay))) * 2 + 1
            for k in range(n + 1):
                t = (i + k / n) / (len(pts) - 1)
                ball(ax + (bx - ax) * k / n, ay + (by - ay) * k / n, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, ramp)

    # cornes, derrière la tête
    limb([(32, 16), (24, 11), (19, 5), (20, 0)], 3.2, 0.8, HORN)
    limb([(48, 16), (56, 11), (61, 5), (60, 0)], 3.2, 0.8, HORN)

    # torse : épaules larges, taille plus fine, jusqu'au sol
    for y in range(36, S):
        half = 27 - (y - 36) * 0.22 if y > 44 else 19 + (y - 36)
        for x in range(int(40 - half), int(40 + half) + 1):
            put(x, y, tone(SKIN, 0.6 - 0.45 * (x - 40) / half - 0.1 * (y - 36) / 44))

    # bras : de l'épaule au poing, posé sur le bord du portail
    limb([(15, 43), (8, 56), (11, 69)], 7.5, 6, SKIN)
    limb([(65, 43), (72, 56), (69, 69)], 7.5, 6, SKIN)
    ball(11, 73, 7.5, 5.5, SKIN, 0.05)
    ball(69, 73, 7.5, 5.5, SKIN, 0.05)
    ball(15, 42, 9, 8, SKIN, 0.1)
    ball(65, 42, 9, 8, SKIN, 0.1)
    for x in (6, 10, 14):
        put(x, 76, SKIN[0]); put(x, 75, SKIN[0])
    for x in (65, 69, 73):
        put(x, 76, SKIN[0]); put(x, 75, SKIN[0])

    # muscles : pectoraux et abdominaux, en creux
    ball(31, 49, 10, 7, SKIN, 0.12)
    ball(49, 49, 10, 7, SKIN, 0.02)
    for y in range(42, 72):
        put(40, y, SKIN[0])
    for y in (58, 64, 70):
        for x in range(32, 49):
            put(x, y, SKIN[1])
    for x in range(22, 40):
        put(x, 55 + abs(x - 31) // 5, SKIN[0])
    for x in range(41, 59):
        put(x, 55 + abs(x - 49) // 5, SKIN[0])

    # cou et tête
    limb([(40, 30), (40, 38)], 7, 8, SKIN)
    ball(40, 22, 12, 14, SKIN, 0.1)
    for y in range(28, 37):                      # mâchoire carrée
        half = 10 - (y - 28) * 0.9
        for x in range(int(40 - half), int(40 + half) + 1):
            put(x, y, tone(SKIN, 0.55 - 0.4 * (x - 40) / 11))

    # cheveux noirs, plaqués en pointe sur le front
    for y in range(7, 17):
        for x in range(27, 54):
            if abs(x - 40) + y < 25 and ((x - 40) ** 2 / 170 + (y - 22) ** 2 / 225) <= 1.1:
                put(x, y, HAIR)

    # sourcils en V, yeux d'or, nez, sourire en coin, barbiche
    for i in range(7):
        put(31 + i, 18 + i // 2, HAIR); put(31 + i, 19 + i // 2, HAIR)
        put(49 - i, 18 + i // 2, HAIR); put(49 - i, 19 + i // 2, HAIR)
    for x, y in [(34, 22), (35, 22), (36, 22), (44, 22), (45, 22), (46, 22)]:
        put(x, y, GOLD)
    put(35, 23, INK); put(45, 23, INK)
    for y in range(23, 29):
        put(40, y, SKIN[1])
    for x in range(36, 46):
        put(x, 32 - (x - 36) // 4, INK)
    for x in range(40, 45):
        put(x, 31 - (x - 40) // 3, hx('#f4efe6'))
    for y in range(34, 41):
        half = max(0, 3 - (y - 34) // 2)
        for x in range(40 - half, 41 + half):
            put(x, y, HAIR)

    # le bas du corps s'embrase
    rng = random.Random(1666)
    for y in range(64, S):
        for x in range(S):
            if px[y * S + x] != EMPTY and rng.random() < (y - 62) / 18:
                put(x, y, tone(LAVA, (y - 62) / 18 * rng.uniform(0.5, 1)))

    # trait d'encre autour de la silhouette
    out = list(px)
    for y in range(S):
        for x in range(S):
            if px[y * S + x] == EMPTY and any(0 <= x + dx < S and 0 <= y + dy < S and px[(y + dy) * S + x + dx] != EMPTY
                                              for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y * S + x] = INK
    return out


def portal():
    W, H = 96, 16
    rng = random.Random(666)
    px = []
    for y in range(H):
        for x in range(W):
            edge = min(x, W - 1 - x) + y * 0.35
            wave = 0.5 + 0.25 * math.sin(x * 0.45 + y * 0.9) + 0.2 * math.sin(x * 0.17 - y * 0.6) + rng.uniform(-0.12, 0.12)
            if edge < 4 + rng.uniform(0, 2):
                px.append(hx('#1c1215') if rng.random() < 0.6 else hx('#2e1a1c'))
            else:
                px.append(tone(LAVA, wave - y * 0.015))
    return px


def lucifer_textures():
    """{ nom : (largeur, hauteur, pixels) }"""
    return {'lucifer': (S, S, lucifer()), 'lucifer_portal': (96, 16, portal())}
