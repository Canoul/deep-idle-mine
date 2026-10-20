"""Génère les textures 16x16 du jeu dans textures/ (PNG, stdlib uniquement).

Usage : python scripts/gen_textures.py
Les textures sont ensuite chargées par le jeu (voir deep-idle-mine.html).
"""
import os
import random
import struct
import zlib

S = 16
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'textures')


def png(path, px):
    """px : liste de S*S tuples (r, g, b, a)."""
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *px[y * S + x]) for x in range(S)) for y in range(S))

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c, k):
    return (max(0, min(255, int(c[0] * k))), max(0, min(255, int(c[1] * k))), max(0, min(255, int(c[2] * k))), c[3])


def blank():
    return [(0, 0, 0, 0)] * (S * S)


def rect(px, x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= xx < S and 0 <= yy < S:
                px[yy * S + xx] = c


def noisy(base, seed, spread=0.12):
    r = random.Random(seed)
    return [shade(base, 1 + (r.random() - 0.5) * 2 * spread) for _ in range(S * S)]


def ore(base_seed, stone_hex, dot_hex):
    px = noisy(hexc(stone_hex), base_seed)
    d = hexc(dot_hex)
    for (x, y, w, h) in [(3, 3, 4, 4), (9, 6, 4, 4), (4, 10, 4, 3), (10, 11, 3, 3)]:
        rect(px, x, y, w, h, d)
        rect(px, x, y, w, 1, shade(d, 1.2))
    return px


def main():
    os.makedirs(OUT, exist_ok=True)
    tex = {}

    # blocs
    dirt = noisy(hexc('#7a5230'), 1)
    r = random.Random(11)
    for _ in range(14):
        rect(dirt, r.randrange(S - 1), r.randrange(S - 1), 2, 2, hexc('#8d6240'))
    tex['dirt'] = dirt

    grass = list(dirt)
    rect(grass, 0, 0, S, 3, hexc('#4caf50'))
    rect(grass, 0, 3, S, 1, hexc('#3b8a3e'))
    tex['grass'] = grass

    stone = noisy(hexc('#7d828c'), 2)
    r = random.Random(22)
    for _ in range(10):
        rect(stone, r.randrange(S - 1), r.randrange(S - 1), 2, 2, hexc('#9298a3'))
    tex['stone'] = stone

    # pierre dure : plus sombre et plus dense que la pierre, veinée de fissures
    hard = noisy(hexc('#575c66'), 12, 0.10)
    r = random.Random(23)
    for _ in range(8):
        rect(hard, r.randrange(S - 1), r.randrange(S - 1), 2, 2, hexc('#6c727d'))
    for (x, y) in [(2, 3), (3, 4), (4, 4), (5, 5), (10, 9), (11, 10), (12, 10), (12, 11), (7, 12), (8, 13)]:
        rect(hard, x, y, 1, 1, hexc('#2f3238'))
    tex['hardstone'] = hard

    # coffre au trésor enfoui : un petit coffre dans la roche
    treasure = noisy(hexc('#7d828c'), 13)
    rect(treasure, 2, 5, 12, 9, hexc('#8a5a2b'))
    rect(treasure, 2, 5, 12, 3, hexc('#5c3a1a'))
    rect(treasure, 2, 13, 12, 1, hexc('#3b2410'))
    rect(treasure, 2, 5, 1, 9, hexc('#d4a017'))
    rect(treasure, 13, 5, 1, 9, hexc('#d4a017'))
    rect(treasure, 7, 7, 2, 3, hexc('#ffd23f'))
    rect(treasure, 7, 9, 2, 1, hexc('#3b2410'))
    tex['treasure'] = treasure

    # icônes d'inventaire des objets Treasure TX : même coffre, ferrures à la couleur du tier
    # (T1 argent, T2 or) et marques de tier (1 ou 2 barres) en bas à droite
    for tier, trim, lock in [(1, '#c0c6cf', '#e8ecf1'), (2, '#d4a017', '#ffd23f')]:
        icon = blank()
        rect(icon, 1, 4, 14, 10, hexc('#8a5a2b'))
        rect(icon, 1, 4, 14, 3, hexc('#5c3a1a'))
        rect(icon, 1, 13, 14, 1, hexc('#3b2410'))
        rect(icon, 1, 4, 1, 10, hexc(trim))
        rect(icon, 14, 4, 1, 10, hexc(trim))
        rect(icon, 1, 7, 14, 1, hexc(trim))
        rect(icon, 7, 6, 2, 3, hexc(lock))
        for i in range(tier):
            rect(icon, 11 + i * 2, 15, 1, 1, hexc(lock))
            rect(icon, 11 + i * 2, 14, 1, 1, hexc(lock))
        tex['treasure_t%d' % tier] = icon

    # blueprint : feuille bleue roulée en haut, tracé blanc d'un objet
    bp = blank()
    rect(bp, 2, 2, 12, 12, hexc('#2f6fb5'))
    rect(bp, 2, 2, 12, 2, hexc('#5b95d6'))
    rect(bp, 2, 13, 12, 1, hexc('#1d4a7d'))
    line = hexc('#e8f1fb')
    rect(bp, 5, 6, 6, 1, line)
    rect(bp, 5, 6, 1, 5, line)
    rect(bp, 10, 6, 1, 5, line)
    rect(bp, 5, 10, 6, 1, line)
    rect(bp, 7, 8, 2, 1, line)
    tex['blueprint'] = bp

    # morceaux de blueprint : trois fragments de feuille bleue
    parts = blank()
    for (x, y, w, h) in [(1, 2, 6, 5), (9, 4, 6, 5), (4, 9, 7, 5)]:
        rect(parts, x, y, w, h, hexc('#2f6fb5'))
        rect(parts, x, y, w, 1, hexc('#5b95d6'))
        rect(parts, x + 1, y + 2, w - 2, 1, hexc('#e8f1fb'))
    tex['bp_parts'] = parts

    # gemmes inférieures : petite pierre taillée, reflet clair en haut à gauche
    for name, base in [('gem_ruby', '#c81d3a'), ('gem_jade', '#2fa66a'), ('gem_sapphire', '#2a5bd7')]:
        g = blank()
        c = hexc(base)
        rect(g, 6, 3, 4, 1, shade(c, 1.3))
        rect(g, 4, 4, 8, 2, shade(c, 1.15))
        rect(g, 3, 6, 10, 2, c)
        rect(g, 4, 8, 8, 2, shade(c, 0.85))
        rect(g, 5, 10, 6, 2, shade(c, 0.7))
        rect(g, 7, 12, 2, 1, shade(c, 0.55))
        rect(g, 5, 5, 2, 1, hexc('#ffffff'))
        tex[name] = g

    tex['coal'] = ore(3, '#7d828c', '#1b1b1f')
    tex['iron'] = ore(4, '#7d828c', '#d9a67f')
    tex['gold'] = ore(5, '#7d828c', '#ffd23f')
    tex['diamond'] = ore(6, '#7d828c', '#4de8f0')

    # fond de galerie creusée
    tex['tunnel'] = noisy(hexc('#2a1f18'), 7, 0.05)

    # barrière infranchissable (fond d'area verrouillée)
    barrier = [hexc('#34344a')] * (S * S)
    for i in range(0, S, 4):
        rect(barrier, i, (i // 4) % 2 * 8, 2, 8, hexc('#4a4a66'))
    tex['barrier'] = barrier

    # passerelle : planches de bois, posée par le mineur pour combler un trou
    # dalle d'un quart de bloc : remplit le haut de la case (4 px), transparente en dessous
    bridge = blank()
    rect(bridge, 0, 0, S, 4, hexc('#9a6b36'))
    rect(bridge, 0, 3, S, 1, hexc('#5c3a1a'))
    rect(bridge, 5, 0, 1, 3, hexc('#5c3a1a'))
    rect(bridge, 11, 0, 1, 3, hexc('#5c3a1a'))
    rect(bridge, 2, 1, 1, 1, hexc('#3b2410'))
    rect(bridge, 8, 1, 1, 1, hexc('#3b2410'))
    rect(bridge, 14, 1, 1, 1, hexc('#3b2410'))
    tex['bridge'] = bridge

    # ciel
    tex['sky'] = [hexc('#6cc3ee')] * (S * S)

    # objets (fond transparent)
    ladder = blank()
    wood = hexc('#b98a4a')
    rect(ladder, 4, 0, 2, S, wood)
    rect(ladder, 10, 0, 2, S, wood)
    for i in range(2, S, 5):
        rect(ladder, 4, i, 8, 2, wood)
    tex['ladder'] = ladder

    chest = blank()
    rect(chest, 1, 5, 14, 10, hexc('#8a5a2b'))
    rect(chest, 1, 5, 14, 3, hexc('#5c3a1a'))
    rect(chest, 7, 8, 2, 3, hexc('#ffd23f'))
    tex['chest'] = chest

    miner = blank()
    rect(miner, 4, 5, 8, 10, hexc('#ffd23f'))
    rect(miner, 3, 2, 10, 4, hexc('#e63946'))
    rect(miner, 11, 3, 2, 2, hexc('#fff7b0'))  # lampe frontale (regarde à droite)
    tex['miner'] = miner

    mimic = blank()
    rect(mimic, 2, 9, 12, 4, hexc('#a1121b'))
    for i in range(3, 13, 3):
        rect(mimic, i, 9, 2, 2, hexc('#ffffff'))
    rect(mimic, 4, 4, 3, 3, hexc('#ffffff'))
    rect(mimic, 9, 4, 3, 3, hexc('#ffffff'))
    tex['mimic'] = mimic

    bug = blank()
    for yy in range(S):
        for xx in range(S):
            if ((xx - 8) / 7.0) ** 2 + ((yy - 10) / 5.0) ** 2 <= 1:
                bug[yy * S + xx] = hexc('#d14b4b')
    rect(bug, 4, 6, 3, 3, hexc('#ffffff'))
    rect(bug, 9, 6, 3, 3, hexc('#ffffff'))
    rect(bug, 5, 7, 1, 2, hexc('#000000'))
    rect(bug, 10, 7, 1, 2, hexc('#000000'))
    tex['bug'] = bug

    # gobelin : tête verte, grandes oreilles pointues, yeux jaunes, sourire
    goblin = blank()
    green, dark = hexc('#4f9d3a'), hexc('#2f6b22')
    rect(goblin, 4, 4, 8, 9, green)
    rect(goblin, 1, 5, 3, 2, green)
    rect(goblin, 0, 4, 1, 1, green)
    rect(goblin, 12, 5, 3, 2, green)
    rect(goblin, 15, 4, 1, 1, green)
    rect(goblin, 5, 6, 2, 2, hexc('#ffd23f'))
    rect(goblin, 9, 6, 2, 2, hexc('#ffd23f'))
    rect(goblin, 6, 7, 1, 1, hexc('#000000'))
    rect(goblin, 9, 7, 1, 1, hexc('#000000'))
    rect(goblin, 5, 10, 6, 1, dark)
    rect(goblin, 6, 11, 1, 1, hexc('#ffffff'))
    rect(goblin, 9, 11, 1, 1, hexc('#ffffff'))
    rect(goblin, 5, 13, 6, 3, hexc('#7a5230'))  # tunique
    tex['goblin'] = goblin

    # lingots (four) : barre trapézoïdale, reflet clair en haut, ombre en bas
    for name, base, light, dark in [('ingot_iron', '#c9cdd4', '#eef0f3', '#8a8f98'),
                                    ('ingot_gold', '#f2c230', '#fff1a8', '#b8871a'),
                                    ('ingot_diamond', '#5fe3ec', '#d6fbff', '#2a9aa6')]:
        ing = blank()
        for i, yy in enumerate(range(6, 12)):
            rect(ing, 4 - i // 2, yy, 8 + (i // 2) * 2, 1, hexc(base))
        rect(ing, 4, 6, 8, 1, hexc(light))
        rect(ing, 5, 7, 3, 1, hexc(light))
        rect(ing, 2, 11, 12, 1, hexc(dark))
        tex[name] = ing

    torch = blank()
    rect(torch, 7, 6, 2, 8, hexc('#7a5230'))
    rect(torch, 6, 3, 4, 4, hexc('#ff9f1c'))
    rect(torch, 7, 2, 2, 3, hexc('#ffd23f'))
    tex['torch'] = torch

    for name, px in tex.items():
        png(os.path.join(OUT, name + '.png'), px)
    print('%d textures écrites dans %s' % (len(tex), os.path.normpath(OUT)))


if __name__ == '__main__':
    main()
