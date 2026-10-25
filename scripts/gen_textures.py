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


def png_wh(path, W, H, px):
    """image de W × H pixels (boss des tours : 3 × 5 cases)."""
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *px[y * W + x]) for x in range(W)) for y in range(H))

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) \
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
    for tier, trim, lock in [(1, '#c0c6cf', '#e8ecf1'), (2, '#d4a017', '#ffd23f'), (3, '#4de8f0', '#c8fbff')]:   # T3 : diamant
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

    # Gallianix (canard jaune, regard vers la droite) et fragment de cœur (moitié de cœur rouge, cassure en zigzag)
    duck = blank()
    rect(duck, 4, 8, 9, 5, hexc('#ffd23f'))          # corps
    rect(duck, 3, 9, 1, 3, hexc('#ffd23f'))          # queue
    rect(duck, 2, 8, 1, 2, hexc('#e6b81e'))
    rect(duck, 9, 3, 4, 5, hexc('#ffd23f'))          # tête
    rect(duck, 13, 5, 2, 2, hexc('#ff8c1a'))         # bec
    rect(duck, 11, 4, 1, 1, hexc('#1b1b1f'))         # œil
    rect(duck, 5, 9, 4, 1, hexc('#fff1a8'))          # reflet de l'aile
    rect(duck, 6, 10, 4, 2, hexc('#e6b81e'))         # aile
    rect(duck, 6, 13, 1, 2, hexc('#ff8c1a'))         # pattes
    rect(duck, 10, 13, 1, 2, hexc('#ff8c1a'))
    rect(duck, 5, 15, 3, 1, hexc('#ff8c1a'))
    rect(duck, 9, 15, 3, 1, hexc('#ff8c1a'))
    tex['duck'] = duck
    heart = blank()
    # moitié gauche d'un cœur, bord droit cassé en zigzag
    for y, x0, x1 in [(3, 3, 6), (4, 2, 7), (5, 2, 8), (6, 2, 7), (7, 3, 8), (8, 4, 7), (9, 5, 8), (10, 6, 7), (11, 7, 8), (12, 8, 8)]:
        rect(heart, x0, y, x1 - x0 + 1, 1, hexc('#d63a4a'))
    rect(heart, 3, 4, 2, 1, hexc('#ff8a96')); rect(heart, 3, 5, 1, 1, hexc('#ff8a96'))   # reflet
    for y, x in [(5, 8), (7, 8), (9, 8), (11, 8)]:
        rect(heart, x, y, 1, 1, hexc('#8e1f2b'))                                        # cassure
    tex['heart_fragment'] = heart

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
    tex['graphite'] = ore(19, '#7d828c', '#2f3b4d')   # graphite : veines gris-bleu métallique

    # fond de galerie creusée
    tex['tunnel'] = noisy(hexc('#2a1f18'), 7, 0.05)

    # barrière infranchissable (fond d'area verrouillée)
    barrier = [hexc('#34344a')] * (S * S)
    for i in range(0, S, 4):
        rect(barrier, i, (i // 4) % 2 * 8, 2, 8, hexc('#4a4a66'))
    tex['barrier'] = barrier

    # socle du coffre : dalle de pierre grise cerclée de fer, rivets aux coins (incassable)
    base = noisy(hexc('#5a5a62'), 18, 0.08)
    iron = hexc('#2e2e34')
    rect(base, 0, 0, 16, 2, iron); rect(base, 0, 14, 16, 2, iron)
    rect(base, 0, 0, 2, 16, iron); rect(base, 14, 0, 2, 16, iron)
    for (rx, ry) in ((2, 2), (12, 2), (2, 12), (12, 12)):
        rect(base, rx, ry, 2, 2, hexc('#b0b0b8'))
    rect(base, 4, 7, 8, 2, hexc('#46464e'))
    tex['chest_base'] = base

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

    # occultiste : mage noir humain, capuche et robe sombres, visage pâle dans l'ombre, yeux violets, orbe de lumière noire
    occ = blank()
    robe, robe_d, edge = hexc('#4b2d6b'), hexc('#2a1840'), hexc('#a070d8')
    rect(occ, 5, 1, 6, 2, robe)            # pointe de la capuche
    rect(occ, 4, 3, 8, 6, robe)            # capuche
    rect(occ, 6, 5, 4, 3, hexc('#c9b8a6'))  # visage pâle
    rect(occ, 6, 5, 4, 1, robe_d)          # ombre de la capuche sur le front
    rect(occ, 6, 6, 1, 1, hexc('#e0b0ff'))  # yeux violets
    rect(occ, 9, 6, 1, 1, hexc('#e0b0ff'))
    rect(occ, 3, 9, 10, 7, robe)           # robe
    rect(occ, 7, 9, 2, 7, robe_d)          # pli central
    rect(occ, 3, 15, 10, 1, edge)          # ourlet
    rect(occ, 4, 9, 8, 1, edge)            # col
    rect(occ, 0, 10, 3, 3, hexc('#140a1f'))  # orbe noire dans la main
    rect(occ, 1, 11, 1, 1, hexc('#e0b0ff'))
    tex['occultist'] = occ

    # méphite : masse de gaz verdâtre, ronde et flasque, deux yeux jaunes, traînée de volutes vers le bas
    meph = blank()
    gas, gas_d, gas_l = hexc('#7fae45'), hexc('#4f7a2a'), hexc('#b5d97a')
    rect(meph, 5, 2, 6, 1, gas)            # haut arrondi
    rect(meph, 3, 3, 10, 2, gas)
    rect(meph, 2, 5, 12, 4, gas)           # corps
    rect(meph, 3, 9, 10, 2, gas)           # bas flasque
    rect(meph, 2, 8, 12, 1, gas_d)         # pli
    rect(meph, 5, 3, 3, 1, gas_l)          # reflet
    rect(meph, 4, 4, 1, 1, gas_l)
    rect(meph, 5, 6, 2, 2, hexc('#ffd23f'))  # yeux jaunes
    rect(meph, 9, 6, 2, 2, hexc('#ffd23f'))
    rect(meph, 6, 7, 1, 1, hexc('#3a2a00'))  # pupilles
    rect(meph, 10, 7, 1, 1, hexc('#3a2a00'))
    rect(meph, 4, 11, 2, 1, gas_d)         # volutes
    rect(meph, 7, 11, 2, 2, gas)
    rect(meph, 11, 11, 1, 1, gas_d)
    rect(meph, 5, 13, 1, 1, gas_d)
    rect(meph, 8, 14, 1, 1, gas_d)
    rect(meph, 10, 13, 1, 1, gas_d)
    tex['mephite'] = meph

    # brique de donjon : pierre taillée violet sombre, joints noirs, briques décalées une rangée sur deux
    brick = noisy(hexc('#3d2c50'), 77, 0.10)
    mortar = hexc('#1a1224')
    for yy in (0, 4, 8, 12):
        rect(brick, 0, yy, 16, 1, mortar)
    for i, yy in enumerate((1, 5, 9, 13)):
        off = 0 if i % 2 == 0 else 4
        for xx in range(off, 16, 8):
            rect(brick, xx, yy, 1, 3, mortar)
        for xx in range(off + 1, 16, 8):
            rect(brick, xx, yy, 6, 1, hexc('#5a4473'))        # arête claire en haut de chaque brique
    tex['dungeon_brick'] = brick

    # résidus (Ange vs Démon) : pierre sombre, fissures lumineuses qui serpentent, halo plus pâle autour
    def residue(seed, glow, halo, core):
        px = noisy(hexc('#2c2f3a'), seed, 0.14)
        r = random.Random(seed)
        for (x, y) in [(2, 1), (5, 2), (11, 0), (1, 9), (13, 6)]:      # départs des fissures
            for _ in range(7):
                for (hx, hy) in ((x - 1, y), (x + 1, y)):
                    if 0 <= hx < S and 0 <= hy < S and px[hy * S + hx][3] == 255 and px[hy * S + hx][0] < 90:
                        px[hy * S + hx] = halo
                rect(px, x, y, 1, 1, glow)
                x = max(0, min(S - 1, x + r.choice((-1, 0, 1))))
                y = max(0, min(S - 1, y + 1))
        for (x, y) in [(4, 6), (10, 11)]:
            rect(px, x, y, 1, 1, core)                                 # éclats les plus brillants
        return px
    # coffres des tours : coffre bombé, bois clair et ferrures, avec l'emblème de son camp
    def tower_chest(wood, wood_d, band, glow, emblem):
        px = blank()
        rect(px, 2, 4, 12, 3, wood); rect(px, 3, 3, 10, 1, wood)          # couvercle bombé
        rect(px, 1, 7, 14, 7, wood_d)                                       # caisse
        rect(px, 1, 7, 14, 1, band); rect(px, 1, 13, 14, 1, band)           # ferrures
        rect(px, 3, 3, 1, 11, band); rect(px, 12, 3, 1, 11, band)
        rect(px, 6, 8, 4, 4, glow)                                          # emblème lumineux
        for (x, y) in emblem:
            rect(px, x, y, 1, 1, hexc('#ffffff'))
        rect(px, 4, 2, 8, 1, shade(glow, 0.8))                              # lueur sur le couvercle
        return px
    tex['chest_angel'] = tower_chest(hexc('#e9eef8'), hexc('#b8c6dd'), hexc('#ffd23f'), hexc('#8fd8ff'), [(7, 9), (8, 9), (7, 10), (8, 10)])
    tex['chest_demon'] = tower_chest(hexc('#4b2d6b'), hexc('#2a1840'), hexc('#a01b1b'), hexc('#ff3b3b'), [(6, 8), (9, 8), (7, 10), (8, 10)])

    # rune : pierre taillée en losange, glyphe lumineux
    rune = blank()
    for i, (x0, w) in enumerate([(7, 2), (6, 4), (5, 6), (4, 8), (3, 10), (2, 12), (2, 12), (3, 10), (4, 8), (5, 6), (6, 4), (7, 2)]):
        rect(rune, x0, 2 + i, w, 1, hexc('#5a5f6e'))
        rect(rune, x0, 2 + i, 1, 1, hexc('#8b91a3'))                      # arête claire
    for (x, y) in [(7, 4), (8, 4), (7, 5), (7, 6), (8, 6), (9, 7), (7, 7), (7, 8), (6, 9), (7, 9), (8, 9), (7, 10)]:
        rect(rune, x, y, 1, 1, hexc('#ffc27a'))                            # glyphe
    tex['rune'] = rune

    # fragment de rune (23/10) : la moitié gauche du losange, cassée en biais, glyphe à moitié éteint
    frag = blank()
    for i, (x0, w) in enumerate([(7, 1), (6, 2), (5, 3), (4, 4), (3, 5), (2, 6), (2, 5), (3, 3), (4, 2), (5, 1)]):
        rect(frag, x0 + 1, 3 + i, w, 1, hexc('#5a5f6e'))
        rect(frag, x0 + 1, 3 + i, 1, 1, hexc('#8b91a3'))
    for (x, y) in [(7, 5), (7, 6), (6, 7), (7, 8), (6, 9)]:
        rect(frag, x, y, 1, 1, hexc('#b88a55'))
    for (x, y) in [(10, 11), (11, 12), (9, 13)]:                       # éclats
        rect(frag, x, y, 1, 1, hexc('#6b7080'))
    tex['rune_fragment'] = frag

    # stonebrick des tours : briques claires (ange) / sombres (démon), joints, décalées ; l'indestructible a des ferrures
    def stonebrick(base, mortar, light, seed, hard=None):
        px = noisy(hexc(base), seed, 0.08)
        for yy in (0, 8):
            rect(px, 0, yy, 16, 1, hexc(mortar))
        for i, yy in enumerate((1, 9)):
            off = 0 if i == 0 else 8
            for xx in (off, (off + 8) % 16):
                rect(px, xx, yy, 1, 7, hexc(mortar))
            rect(px, 0, yy, 16, 1, hexc(light))
        if hard:
            rect(px, 0, 0, 16, 1, hexc(hard)); rect(px, 0, 15, 16, 1, hexc(hard))
            rect(px, 0, 0, 1, 16, hexc(hard)); rect(px, 15, 0, 1, 16, hexc(hard))
            for (x, y) in ((2, 2), (13, 2), (2, 13), (13, 13)):
                rect(px, x, y, 1, 1, hexc(hard))
        return px
    tex['brick_angel'] = stonebrick('#bfe3ff', '#7fa6c9', '#e8f4ff', 501)
    tex['brick_angel_hard'] = stonebrick('#8fb3d6', '#5c7fa3', '#cfe6ff', 502, hard='#ffd23f')
    tex['brick_demon'] = stonebrick('#4a1f3a', '#26101e', '#6b3354', 503)
    tex['brick_demon_hard'] = stonebrick('#2f1426', '#14080f', '#4a1f3a', 504, hard='#ff3b3b')

    tex['residue_angel'] = residue(4141, hexc('#8fd8ff'), hexc('#3d5a78'), hexc('#ffffff'))
    tex['residue_demon'] = residue(6666, hexc('#ff3b3b'), hexc('#6b2228'), hexc('#ffd0a0'))

    # minotaure : debout sur ses pattes arrière, torse humain musclé, tête de taureau, cornes claires, sabots
    mino = blank()
    fur, fur_d, skin, skin_d, horn = hexc('#6b4226'), hexc('#4a2c18'), hexc('#a8714a'), hexc('#7d4f31'), hexc('#efe3c4')
    rect(mino, 2, 0, 2, 1, horn); rect(mino, 1, 1, 2, 2, horn)      # corne gauche
    rect(mino, 12, 0, 2, 1, horn); rect(mino, 13, 1, 2, 2, horn)    # corne droite
    rect(mino, 4, 1, 8, 5, fur)                                     # tête de taureau
    rect(mino, 3, 2, 1, 2, fur_d); rect(mino, 12, 2, 1, 2, fur_d)   # oreilles
    rect(mino, 5, 3, 1, 1, hexc('#ff3b2f')); rect(mino, 10, 3, 1, 1, hexc('#ff3b2f'))   # yeux rouges
    rect(mino, 6, 4, 4, 2, hexc('#8a5a3a'))                         # museau
    rect(mino, 6, 5, 1, 1, fur_d); rect(mino, 9, 5, 1, 1, fur_d)    # naseaux
    rect(mino, 7, 6, 2, 1, hexc('#c9c9c9'))                         # anneau
    rect(mino, 3, 6, 10, 4, skin)                                   # torse large
    rect(mino, 4, 7, 3, 1, skin_d); rect(mino, 9, 7, 3, 1, skin_d)  # pectoraux
    rect(mino, 7, 8, 2, 2, skin_d)                                  # abdos
    rect(mino, 1, 6, 2, 5, skin); rect(mino, 13, 6, 2, 5, skin)     # bras
    rect(mino, 1, 10, 2, 1, skin_d); rect(mino, 13, 10, 2, 1, skin_d)   # poings
    rect(mino, 4, 10, 8, 2, hexc('#3b2b1e'))                        # pagne
    rect(mino, 4, 12, 3, 3, fur); rect(mino, 9, 12, 3, 3, fur)      # pattes arrière poilues
    rect(mino, 4, 15, 3, 1, hexc('#222222')); rect(mino, 9, 15, 3, 1, hexc('#222222'))   # sabots
    tex['minotaur'] = mino

    # cristal de pleine lune : cristal pâle bleu-blanc, croissant de lune argenté, halo
    cry = blank()
    halo, pale, mid, deep = hexc('#cfe6ff', 90), hexc('#f2f8ff'), hexc('#a9cfff'), hexc('#6f8fd6')
    for yy, (x0, w) in enumerate([(7, 2), (6, 4), (5, 6), (5, 6), (4, 8), (4, 8), (5, 6), (5, 6), (6, 4), (7, 2)], start=3):
        rect(cry, x0, yy, w, 1, mid)
        rect(cry, x0, yy, max(1, w // 2), 1, pale)                 # face éclairée
    rect(cry, 8, 4, 1, 8, deep)                                     # arête
    rect(cry, 2, 1, 3, 1, halo); rect(cry, 1, 2, 1, 3, halo)        # croissant de lune
    rect(cry, 2, 2, 2, 1, hexc('#e8eef8')); rect(cry, 2, 3, 1, 2, hexc('#e8eef8'))
    rect(cry, 12, 12, 1, 1, pale); rect(cry, 13, 2, 1, 1, pale)     # éclats
    tex['moon_crystal'] = cry

    # plume d'ange (objet, mine instantanée) : plume blanche incurvée, rachis lavande, barbes fendues, tige dorée
    fea = blank()
    vane, vane_l, vane_d, quill, spark = hexc('#f4f1ff'), hexc('#ffffff'), hexc('#c9c3e6'), hexc('#e8c25a'), hexc('#fff6c8')
    for yy, (x0, x1) in enumerate([(11, 12), (10, 13), (9, 13), (8, 13), (8, 12), (7, 12), (7, 11), (6, 11),
                                   (6, 10), (5, 9), (5, 8), (5, 7)], start=1):
        rect(fea, x0, yy, x1 - x0 + 1, 1, vane)
        rect(fea, x0, yy, 1, 1, vane_l)                             # bord éclairé
        rect(fea, x1, yy, 1, 1, vane_d)                             # bord ombré
    for x, y in [(13, 5), (12, 8), (7, 10)]:                        # barbes fendues
        rect(fea, x, y, 1, 1, (0, 0, 0, 0))
    for i in range(11):                                             # rachis
        rect(fea, 12 - i // 2 - (i + 1) // 4, 1 + i, 1, 1, vane_d)
    rect(fea, 5, 13, 1, 1, quill); rect(fea, 4, 14, 1, 1, quill); rect(fea, 3, 15, 1, 1, quill)   # tige dorée
    rect(fea, 14, 1, 1, 1, spark); rect(fea, 3, 6, 1, 1, spark)     # éclats
    tex['angel_feather'] = fea

    # tas de plumes d'ange (case vide de la mine instantanée, dessinée par-dessus le tunnel) : petit tas de plumes
    # blanches nacrées, deux plumes dressées, éclats dorés
    heap = blank()
    glow = hexc('#ffe9a8', 70)
    for yy, (x0, w) in enumerate([(4, 8), (3, 10), (2, 12), (1, 14), (1, 14)], start=10):
        rect(heap, x0 - 1, yy, w + 2, 1, glow)                      # lueur autour du tas
        rect(heap, x0, yy, w, 1, vane)
        rect(heap, x0 + w - 2, yy, 2, 1, vane_d)
    for x, y in [(3, 12), (6, 11), (9, 12), (12, 12), (5, 14), (10, 14)]:
        rect(heap, x, y, 2, 1, vane_d)                              # plumes couchées (traits d'ombre)
    rect(heap, 4, 10, 3, 1, vane_l); rect(heap, 3, 11, 2, 1, vane_l)
    for i, (x, y) in enumerate([(5, 9), (5, 8), (4, 7), (4, 6), (3, 5)]):     # plume dressée à gauche
        rect(heap, x, y, 2 if i < 4 else 1, 1, vane_l)
    for i, (x, y) in enumerate([(10, 9), (10, 8), (11, 7), (11, 6), (12, 5)]):    # plume dressée à droite
        rect(heap, x, y, 2 if i < 4 else 1, 1, vane)
        rect(heap, x + 1, y, 1, 1, vane_d)
    rect(heap, 7, 10, 2, 1, quill)                                  # tige dorée qui dépasse
    for x, y in [(8, 4), (2, 3), (14, 6), (13, 2)]:
        rect(heap, x, y, 1, 1, spark)                               # éclats dorés
    tex['angel_feathers'] = heap

    # parchemin de sort (objet, onglet Sorts) : feuille beige roulée aux deux bouts, lignes d'écriture, sceau rouge
    scr = blank()
    paper, paper_l, paper_d, ink, seal, seal_l = hexc('#e9d7a6'), hexc('#f7ecc9'), hexc('#b89a5c'), hexc('#6b4a2a'), hexc('#b8282e'), hexc('#e8565a')
    rect(scr, 3, 3, 10, 10, paper)                                  # feuille
    rect(scr, 3, 3, 10, 1, paper_l)                                 # bord éclairé
    rect(scr, 2, 2, 12, 2, paper_d); rect(scr, 2, 2, 12, 1, paper)  # rouleau du haut
    rect(scr, 2, 12, 12, 2, paper_d); rect(scr, 2, 13, 12, 1, paper)   # rouleau du bas
    rect(scr, 1, 2, 1, 2, paper_d); rect(scr, 14, 2, 1, 2, paper_d)
    rect(scr, 1, 12, 1, 2, paper_d); rect(scr, 14, 12, 1, 2, paper_d)
    for yy in (5, 7, 9):                                            # lignes d'écriture
        rect(scr, 5, yy, 6 if yy != 9 else 4, 1, ink)
    rect(scr, 10, 9, 3, 3, seal); rect(scr, 10, 9, 1, 1, seal_l)    # sceau
    tex['scroll'] = scr

    # glyphe (objet, onglet Skills, 25/10/2026) : parchemin bleu nuit roulé, une rune lumineuse cyan au milieu
    gly = blank()
    gp, gp_l, gp_d, rune, rune_l = hexc('#2e3a6b'), hexc('#4a5a9a'), hexc('#1a2244'), hexc('#3fd6e8'), hexc('#c8f7ff')
    rect(gly, 3, 3, 10, 10, gp)                                     # feuille
    rect(gly, 3, 3, 10, 1, gp_l)
    rect(gly, 2, 2, 12, 2, gp_d); rect(gly, 2, 2, 12, 1, gp)        # rouleau du haut
    rect(gly, 2, 12, 12, 2, gp_d); rect(gly, 2, 13, 12, 1, gp)      # rouleau du bas
    rect(gly, 1, 2, 1, 2, gp_d); rect(gly, 14, 2, 1, 2, gp_d)
    rect(gly, 1, 12, 1, 2, gp_d); rect(gly, 14, 12, 1, 2, gp_d)
    rect(gly, 7, 5, 2, 6, rune)                                     # rune : barre verticale…
    rect(gly, 5, 7, 6, 2, rune)                                     # … et horizontale (une croix)
    rect(gly, 6, 6, 1, 1, rune); rect(gly, 9, 6, 1, 1, rune); rect(gly, 6, 9, 1, 1, rune); rect(gly, 9, 9, 1, 1, rune)
    rect(gly, 7, 7, 2, 2, rune_l)                                   # cœur lumineux
    tex['glyph'] = gly

    # lingots (four) : barre trapézoïdale, reflet clair en haut, ombre en bas
    for name, base, light, dark in [('ingot_iron', '#c9cdd4', '#eef0f3', '#8a8f98'),
                                    ('ingot_gold', '#f2c230', '#fff1a8', '#b8871a'),
                                    ('ingot_tainted', '#8b6f8f', '#c2a6c4', '#4f3a52'),    # alliage fer + chitine
                                    ('ingot_tainted_gold', '#b9924a', '#e6c98a', '#6e5226'),   # alliage or + chitine
                                    ('ingot_graphite', '#4a505a', '#8a93a0', '#2a2e35'),       # graphite fondu
                                    ('ingot_steel', '#7f8fa3', '#d6e2ef', '#3f4a58')]:         # alliage tainted iron + graphite
        ing = blank()
        for i, yy in enumerate(range(6, 12)):
            rect(ing, 4 - i // 2, yy, 8 + (i // 2) * 2, 1, hexc(base))
        rect(ing, 4, 6, 8, 1, hexc(light))
        rect(ing, 5, 7, 3, 1, hexc(light))
        rect(ing, 2, 11, 12, 1, hexc(dark))
        tex[name] = ing

    # four en fer (objet) : bloc de fer riveté, bouche de feu orange en bas
    fur = blank()
    rect(fur, 2, 2, 12, 13, hexc('#9aa0aa'))
    rect(fur, 2, 2, 12, 1, hexc('#d4d8de')); rect(fur, 2, 14, 12, 1, hexc('#5c6068'))
    rect(fur, 2, 2, 1, 13, hexc('#c0c5cc')); rect(fur, 13, 2, 1, 13, hexc('#6c7078'))
    for x, y in [(3, 3), (12, 3), (3, 13), (12, 13)]:
        rect(fur, x, y, 1, 1, hexc('#4a4e55'))                       # rivets
    rect(fur, 5, 5, 6, 2, hexc('#4a4e55'))                           # grille
    rect(fur, 4, 9, 8, 5, hexc('#2a1a12'))                           # bouche
    rect(fur, 5, 11, 6, 3, hexc('#ff7a1a')); rect(fur, 6, 10, 4, 2, hexc('#ffb02e')); rect(fur, 7, 12, 2, 1, hexc('#fff1a8'))
    tex['furnace_iron'] = fur

    # boussole en or : boîtier doré rond, cadran clair, aiguille rouge et blanche
    cmp = blank()
    for y in range(S):
        for x in range(S):
            d = (x - 7.5) ** 2 + (y - 8.5) ** 2
            if d <= 42: cmp[y * S + x] = hexc('#c9961f')
            if d <= 33: cmp[y * S + x] = hexc('#ffd447')
            if d <= 22: cmp[y * S + x] = hexc('#f6f0dc')
    rect(cmp, 7, 1, 2, 2, hexc('#ffd447'))                            # anneau
    for i in range(4):
        rect(cmp, 10 - i, 5 + i, 1, 1, hexc('#d63b2f'))               # aiguille nord-est (rouge)
        rect(cmp, 7 - i, 9 + i, 1, 1, hexc('#8a8f98'))                # aiguille sud-ouest
    rect(cmp, 7, 8, 2, 2, hexc('#4a3a1a'))                            # pivot
    rect(cmp, 5, 4, 2, 1, hexc('#ffffff'))                            # reflet
    tex['compass_gold'] = cmp

    # lampe à incandescence (25/10/2026) : ampoule de verre, filament orange qui brille, halo, culot en laiton
    lamp = blank()
    for y in range(S):
        for x in range(S):
            d = (x - 7.5) ** 2 + (y - 6) ** 2
            if d <= 30: lamp[y * S + x] = hexc('#ffe9a8', 110)                # halo
            if d <= 18: lamp[y * S + x] = hexc('#fff6d6')                     # verre
    rect(lamp, 6, 10, 4, 1, hexc('#fff6d6'))                          # col de l'ampoule
    rect(lamp, 6, 5, 1, 4, hexc('#ff8a1a')); rect(lamp, 9, 5, 1, 4, hexc('#ff8a1a'))   # filament
    rect(lamp, 7, 4, 2, 1, hexc('#ffd447')); rect(lamp, 7, 5, 2, 1, hexc('#fff1a8'))
    rect(lamp, 5, 4, 1, 2, hexc('#ffffff'))                           # reflet
    rect(lamp, 6, 11, 4, 3, hexc('#b8862b')); rect(lamp, 6, 12, 4, 1, hexc('#7a5a1c'))   # culot en laiton
    rect(lamp, 7, 14, 2, 1, hexc('#4a3a1a'))                          # plot
    tex['lamp_incandescent'] = lamp

    # shiny (lingot déjà cuit tombé à la mine) : le lingot plus clair, une étincelle à 4 branches et deux éclats
    for name, base, light, dark in [('shiny_iron', '#dfe3ea', '#ffffff', '#9aa0aa'),
                                    ('shiny_gold', '#ffd447', '#fffbe0', '#c9961f')]:
        sh = blank()
        for i, yy in enumerate(range(7, 13)):
            rect(sh, 4 - i // 2, yy, 8 + (i // 2) * 2, 1, hexc(base))
        rect(sh, 4, 7, 8, 1, hexc(light))
        rect(sh, 5, 8, 3, 1, hexc(light))
        rect(sh, 2, 12, 12, 1, hexc(dark))
        rect(sh, 9, 9, 1, 1, hexc('#ffffff'))                       # éclat sur le lingot
        spark, glow = hexc('#ffffff'), hexc('#fff3a8')
        rect(sh, 12, 1, 1, 7, glow); rect(sh, 9, 4, 7, 1, glow)     # étincelle : branches
        rect(sh, 12, 2, 1, 5, spark); rect(sh, 10, 4, 5, 1, spark)
        rect(sh, 11, 3, 3, 3, spark)                                # cœur
        rect(sh, 3, 3, 1, 1, glow); rect(sh, 2, 4, 3, 1, glow); rect(sh, 3, 5, 1, 1, glow)   # petit éclat à gauche
        rect(sh, 3, 4, 1, 1, spark)
        tex[name] = sh

    # pioche en pierre (stuff) : manche en bois en diagonale, tête de pierre grise en arc
    pick = blank()
    for i in range(10):
        rect(pick, 3 + i, 13 - i, 2, 2, hexc('#8a5a2b'))
    for x, y in [(4, 3), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (12, 6), (13, 7), (13, 8)]:
        rect(pick, x, y, 2, 2, hexc('#8d939c'))
    rect(pick, 5, 2, 4, 1, hexc('#c3c8cf'))
    rect(pick, 3, 4, 2, 2, hexc('#5f646c'))
    rect(pick, 13, 9, 2, 2, hexc('#5f646c'))
    tex['pickaxe_stone'] = pick

    # pièces d'armure (stuff), mêmes formes par matériau : chitine = plaques rouge sombre de carapace, fer = gris acier
    for mat, base, hi, lo in [('chitin', '#a8343a', '#d65a5a', '#5e1a1e'),
                              ('iron', '#9aa1ab', '#d9dde3', '#5a6069'),
                              ('steel', '#5f6f84', '#a9bbd0', '#2f3a48')]:          # acier : gris bleuté sombre
        chit, chit_hi, chit_lo = hexc(base), hexc(hi), hexc(lo)
        helmet = blank()
        rect(helmet, 3, 3, 10, 7, chit)
        rect(helmet, 4, 2, 8, 1, chit)
        rect(helmet, 3, 10, 3, 3, chit)
        rect(helmet, 10, 10, 3, 3, chit)
        rect(helmet, 5, 4, 4, 1, chit_hi)
        rect(helmet, 3, 7, 10, 1, chit_lo)
        tex['helmet_' + mat] = helmet

        chest = blank()
        rect(chest, 2, 2, 12, 4, chit)
        rect(chest, 4, 6, 8, 8, chit)
        rect(chest, 6, 2, 4, 2, (0, 0, 0, 0))
        for y in (7, 10):
            rect(chest, 4, y, 8, 1, chit_lo)
        rect(chest, 3, 3, 2, 1, chit_hi)
        rect(chest, 5, 8, 2, 1, chit_hi)
        tex['chest_' + mat] = chest

        legs = blank()
        rect(legs, 4, 2, 8, 3, chit)
        rect(legs, 4, 5, 3, 9, chit)
        rect(legs, 9, 5, 3, 9, chit)
        rect(legs, 4, 4, 8, 1, chit_lo)
        rect(legs, 4, 9, 3, 1, chit_lo)
        rect(legs, 9, 9, 3, 1, chit_lo)
        rect(legs, 5, 6, 1, 2, chit_hi)
        rect(legs, 10, 6, 1, 2, chit_hi)
        tex['legs_' + mat] = legs

        boots = blank()
        for x0 in (2, 9):
            rect(boots, x0, 5, 4, 6, chit)
            rect(boots, x0, 11, 6 if x0 == 2 else 5, 3, chit)
            rect(boots, x0, 13, 6 if x0 == 2 else 5, 1, chit_lo)
            rect(boots, x0 + 1, 6, 1, 2, chit_hi)
        tex['boots_' + mat] = boots

    # pioche en fer (stuff) : la forme de la pioche en pierre, tête en acier clair
    pick = blank()
    for i in range(10):
        rect(pick, 3 + i, 13 - i, 2, 2, hexc('#8a5a2b'))
    for x, y in [(4, 3), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (12, 6), (13, 7), (13, 8)]:
        rect(pick, x, y, 2, 2, hexc('#b8bec7'))
    rect(pick, 5, 2, 4, 1, hexc('#eef0f3'))
    rect(pick, 3, 4, 2, 2, hexc('#6f7680'))
    rect(pick, 13, 9, 2, 2, hexc('#6f7680'))
    tex['pickaxe_iron'] = pick

    # épée en fer (stuff) : lame en diagonale, garde et poignée
    sword = blank()
    for i in range(9):
        rect(sword, 5 + i, 9 - i, 2, 2, hexc('#c9cdd4'))
    for i in range(8):
        rect(sword, 6 + i, 9 - i, 1, 1, hexc('#eef0f3'))
    rect(sword, 3, 9, 5, 2, hexc('#6b4f3a'))       # garde
    rect(sword, 4, 8, 2, 4, hexc('#6b4f3a'))
    rect(sword, 2, 12, 2, 2, hexc('#8a5a2b'))      # poignée
    rect(sword, 1, 14, 2, 1, hexc('#ffd23f'))      # pommeau
    tex['sword_iron'] = sword

    # lance en fer (stuff, 25/10/2026) : longue hampe de bois en diagonale, pointe de fer en losange
    spear = blank()
    for i in range(11):
        rect(spear, 1 + i, 14 - i, 2, 1, hexc('#8a5a2b'))
    for x, y in [(11, 4), (12, 3), (13, 2), (14, 1), (12, 4), (13, 3), (11, 3), (12, 2)]:
        rect(spear, x, y, 1, 1, hexc('#c9cdd4'))
    for x, y in [(12, 3), (13, 2)]:
        rect(spear, x, y, 1, 1, hexc('#eef0f3'))
    rect(spear, 10, 5, 2, 1, hexc('#6b4f3a'))      # ligature
    tex['spear_iron'] = spear

    # pioche et épée en acier (stuff) : mêmes formes que le fer, métal gris bleuté, pommeau diamant
    pick = blank()
    for i in range(10):
        rect(pick, 3 + i, 13 - i, 2, 2, hexc('#5c3a1a'))
    for x, y in [(4, 3), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (12, 6), (13, 7), (13, 8)]:
        rect(pick, x, y, 2, 2, hexc('#6f8197'))
    rect(pick, 5, 2, 4, 1, hexc('#c3d3e4'))
    rect(pick, 3, 4, 2, 2, hexc('#3a4656'))
    rect(pick, 13, 9, 2, 2, hexc('#3a4656'))
    tex['pickaxe_steel'] = pick
    sword = blank()
    for i in range(9):
        rect(sword, 5 + i, 9 - i, 2, 2, hexc('#7f8fa3'))
    for i in range(8):
        rect(sword, 6 + i, 9 - i, 1, 1, hexc('#d6e2ef'))
    rect(sword, 3, 9, 5, 2, hexc('#2f3a48'))
    rect(sword, 4, 8, 2, 4, hexc('#2f3a48'))
    rect(sword, 2, 12, 2, 2, hexc('#5c3a1a'))
    rect(sword, 1, 14, 2, 1, hexc('#4de8f0'))
    tex['sword_steel'] = sword

    # plastron de l'équilibre : forme du plastron, moitié gauche blanc-or (ange), moitié droite rouge sombre (démon)
    chest = blank()
    for x0, base, hi, lo in [(0, '#e8f4ff', '#ffffff', '#ffd23f'), (8, '#7a1f2a', '#ff3b3b', '#3a0f16')]:
        rect(chest, max(2, x0), 2, 6, 4, hexc(base))
        rect(chest, max(4, x0), 6, 4, 8, hexc(base))
        for y in (7, 10):
            rect(chest, max(4, x0), y, 4, 1, hexc(lo))
        rect(chest, x0 + 3 if x0 else 3, 3, 2, 1, hexc(hi))
    rect(chest, 6, 2, 4, 2, (0, 0, 0, 0))
    rect(chest, 7, 8, 2, 2, hexc('#b06bff'))        # gemme centrale
    tex['chest_balance'] = chest
    # épée en pierre (stuff) : même forme, lame en pierre grise, garde en bois, sans pommeau doré
    sword_st = blank()
    for i in range(9):
        rect(sword_st, 5 + i, 9 - i, 2, 2, hexc('#8d939c'))
    for i in range(8):
        rect(sword_st, 6 + i, 9 - i, 1, 1, hexc('#b3b8bf'))
    rect(sword_st, 3, 9, 5, 2, hexc('#6b4f3a'))
    rect(sword_st, 4, 8, 2, 4, hexc('#6b4f3a'))
    rect(sword_st, 2, 12, 2, 2, hexc('#8a5a2b'))
    rect(sword_st, 1, 14, 2, 1, hexc('#5f646c'))
    tex['sword_stone'] = sword_st

    # ceinture en peau de gobelin (stuff) : bande de cuir vert, boucle dorée
    belt = blank()
    rect(belt, 1, 6, 14, 4, hexc('#4f7d32'))
    rect(belt, 1, 6, 14, 1, hexc('#6fa64a'))
    rect(belt, 1, 9, 14, 1, hexc('#2f5420'))
    rect(belt, 6, 5, 4, 6, hexc('#ffd23f'))
    rect(belt, 7, 6, 2, 4, hexc('#4f7d32'))
    tex['belt_goblin'] = belt

    # gants tactique (stuff) : gris acier, doigts tendus, manchette rouge
    def glove(base, light, dark, cuff):
        g = blank()
        rect(g, 4, 6, 8, 7, hexc(base))                   # paume
        for x, y, h in [(4, 3, 4), (6, 2, 5), (8, 2, 5), (10, 3, 4)]:
            rect(g, x, y, 2, h, hexc(base))               # doigts
        rect(g, 2, 7, 3, 4, hexc(base))                   # pouce
        rect(g, 6, 2, 2, 1, hexc(light)); rect(g, 8, 2, 2, 1, hexc(light)); rect(g, 5, 7, 6, 1, hexc(light))
        rect(g, 4, 12, 8, 1, hexc(dark))
        rect(g, 3, 13, 10, 2, hexc(cuff))                 # manchette
        return g
    tex['gloves_tactical'] = glove('#3b3f46', '#6a707a', '#22252a', '#e63946')
    # gants d'ouvrier (stuff) : cuir brun, manchette dorée
    tex['gloves_worker'] = glove('#a9773a', '#d7a45a', '#6b4a22', '#ffd23f')

    # cape de Naingui (stuff) : tissu sombre qui s'évase, fermoir doré
    cape = blank()
    for i in range(12):
        rect(cape, 5 - i // 3, 3 + i, 6 + 2 * (i // 3), 1, hexc('#4a2a6b'))
    for i in range(12):
        rect(cape, 5 - i // 3, 3 + i, 1, 1, hexc('#6a3d92'))
    rect(cape, 5, 14, 6, 1, hexc('#2b1b3d'))
    rect(cape, 6, 2, 4, 2, hexc('#6a3d92'))
    rect(cape, 7, 3, 2, 2, hexc('#ffd23f'))                # fermoir
    tex['cape_naingui'] = cape

    # tissu sombre (matériau) : étoffe pliée, violet très sombre
    cloth = blank()
    rect(cloth, 2, 4, 12, 9, hexc('#2b1b3d'))
    rect(cloth, 2, 4, 12, 2, hexc('#4a2a6b'))
    rect(cloth, 2, 8, 12, 1, hexc('#3a2455'))
    rect(cloth, 2, 11, 12, 2, hexc('#1c1228'))
    rect(cloth, 4, 6, 3, 1, hexc('#6a3d92'))
    tex['dark_cloth'] = cloth

    # vésicule de gaz (butin du méphite) : petite poche translucide verte, nouée en haut, gaz plus clair dedans
    ves = blank()
    skin, skin_d = hexc('#9cc865'), hexc('#5d8a32')
    rect(ves, 7, 2, 2, 2, skin_d)          # noeud
    rect(ves, 5, 4, 6, 1, skin)
    rect(ves, 4, 5, 8, 7, skin)            # poche
    rect(ves, 5, 12, 6, 1, skin)
    rect(ves, 3, 7, 1, 3, skin_d)          # bords
    rect(ves, 12, 7, 1, 3, skin_d)
    rect(ves, 5, 6, 2, 2, hexc('#d9f0b0'))  # reflet
    rect(ves, 7, 9, 3, 2, hexc('#c4e38f'))  # gaz
    tex['gas_vesicle'] = ves



    torch = blank()
    rect(torch, 7, 6, 2, 8, hexc('#7a5230'))
    rect(torch, 6, 3, 4, 4, hexc('#ff9f1c'))
    rect(torch, 7, 2, 2, 3, hexc('#ffd23f'))
    tex['torch'] = torch

    # treuil (skill Logisticien) : corde au milieu du puits, poulie en bois en surface, seau en bois
    rope = blank()
    rect(rope, 7, 0, 2, 16, hexc('#b08850'))
    for y in range(0, 16, 4):
        rect(rope, 7, y, 1, 2, hexc('#7a5a30'))
    tex['winch_rope'] = rope
    top = blank()
    rect(top, 1, 2, 2, 14, hexc('#7a5230'))       # montants
    rect(top, 13, 2, 2, 14, hexc('#7a5230'))
    rect(top, 1, 2, 14, 2, hexc('#9a6b36'))       # traverse
    rect(top, 5, 4, 6, 6, hexc('#5c3a1a'))        # poulie
    rect(top, 6, 5, 4, 4, hexc('#8d939c'))
    rect(top, 7, 10, 2, 6, hexc('#b08850'))       # corde
    tex['winch_top'] = top
    bucket = blank()
    rect(bucket, 7, 0, 2, 5, hexc('#b08850'))     # corde
    rect(bucket, 3, 5, 10, 1, hexc('#5c3a1a'))    # anse
    rect(bucket, 2, 6, 12, 9, hexc('#9a6b36'))    # seau
    rect(bucket, 2, 8, 12, 1, hexc('#5a6069'))    # cerclages
    rect(bucket, 2, 12, 12, 1, hexc('#5a6069'))
    rect(bucket, 3, 6, 2, 9, hexc('#b8854a'))
    tex['bucket'] = bucket
    # ascenseur (Glyphe Treuil, 25/10/2026) : deux rails d'acier riveté, machinerie en fer avec roue dentée, cabine grillagée
    steel, steel_l, steel_d, rivet = hexc('#7d8794'), hexc('#b4bec9'), hexc('#4a525c'), hexc('#d8dee5')
    rail = blank()
    rect(rail, 3, 0, 2, 16, steel); rect(rail, 11, 0, 2, 16, steel)        # rails
    rect(rail, 3, 0, 1, 16, steel_l); rect(rail, 11, 0, 1, 16, steel_l)
    for y in range(1, 16, 5):
        rect(rail, 4, y, 8, 1, steel_d)                                     # traverses
        rect(rail, 4, y, 1, 1, rivet); rect(rail, 11, y, 1, 1, rivet)
    tex['lift_rail'] = rail
    ltop = blank()
    rect(ltop, 1, 3, 2, 13, steel_d); rect(ltop, 13, 3, 2, 13, steel_d)    # montants
    rect(ltop, 1, 2, 14, 2, steel)                                          # poutre
    rect(ltop, 1, 2, 14, 1, steel_l)
    rect(ltop, 5, 5, 6, 6, hexc('#3a3f47'))                                 # roue dentée
    rect(ltop, 6, 6, 4, 4, hexc('#c9a227')); rect(ltop, 7, 7, 2, 2, hexc('#3a3f47'))
    for x, y in [(7, 4), (11, 7), (7, 11), (4, 7)]:
        rect(ltop, x, y, 2, 1 if y in (4, 11) else 2, hexc('#3a3f47'))     # dents
    rect(ltop, 7, 12, 2, 4, steel_d)                                        # câble
    tex['lift_top'] = ltop
    cab = blank()
    rect(cab, 2, 1, 1, 14, steel_d); rect(cab, 13, 1, 1, 14, steel_d)      # cadre (intérieur vide : on voit le mineur)
    for x in range(4, 13, 3):
        rect(cab, x, 2, 1, 12, steel)                                       # grille
    rect(cab, 2, 1, 12, 1, steel_l); rect(cab, 2, 14, 12, 1, steel_l)
    rect(cab, 7, 0, 2, 1, steel_d)                                          # attache du câble
    tex['lift_cabin'] = cab
    # sac de la Mule (skill Logisticien) : sac à dos en cuir, rabat, sangles et boucle en fer
    backpack = blank()
    rect(backpack, 5, 1, 6, 2, hexc('#5c3a1a'))   # poignée
    rect(backpack, 6, 2, 4, 1, (0, 0, 0, 0))
    rect(backpack, 3, 3, 10, 12, hexc('#8a5a2b'))  # corps
    rect(backpack, 3, 3, 10, 5, hexc('#a06a35'))   # rabat
    rect(backpack, 3, 8, 10, 1, hexc('#5c3a1a'))   # bord du rabat
    rect(backpack, 7, 7, 2, 3, hexc('#9aa3ad'))    # boucle
    rect(backpack, 4, 10, 1, 4, hexc('#6e4520'))   # coutures
    rect(backpack, 11, 10, 1, 4, hexc('#6e4520'))
    rect(backpack, 3, 15, 10, 1, hexc('#4a2e14'))  # fond
    tex['backpack'] = backpack

    # étourdi (chute imprévue) : étoiles jaunes qui tournent au-dessus de la tête du mineur (haut de la case)
    stun = blank()
    for x, y in [(2, 3), (7, 1), (12, 3)]:
        rect(stun, x, y, 3, 1, hexc('#ffd23f'))
        rect(stun, x + 1, y - 1, 1, 3, hexc('#ffd23f'))
        rect(stun, x + 1, y, 1, 1, hexc('#fff3b0'))
    tex['stun'] = stun

    # ---- skins des mineurs (src/skins.js) : un corps commun + calques d'équipement, regard vers la droite ----
    sk_body = blank()
    rect(sk_body, 5, 2, 6, 2, hexc('#5a3a22'))       # cheveux
    rect(sk_body, 5, 4, 6, 3, hexc('#e0ac7d'))       # visage
    rect(sk_body, 9, 4, 1, 1, hexc('#2b1d14'))       # œil
    rect(sk_body, 5, 7, 6, 4, hexc('#3f5f8a'))       # tenue de base (bleu)
    rect(sk_body, 4, 7, 1, 3, hexc('#3f5f8a'))       # bras
    rect(sk_body, 11, 7, 1, 3, hexc('#3f5f8a'))
    rect(sk_body, 4, 10, 1, 1, hexc('#e0ac7d'))      # mains
    rect(sk_body, 11, 10, 1, 1, hexc('#e0ac7d'))
    rect(sk_body, 5, 10, 6, 1, hexc('#2b2b2b'))      # ceinture
    rect(sk_body, 5, 11, 6, 3, hexc('#6b4f3a'))      # pantalon
    rect(sk_body, 7, 12, 2, 2, hexc('#4e3829'))      # entrejambe
    rect(sk_body, 5, 14, 2, 2, hexc('#3a2a1e'))      # chaussures
    rect(sk_body, 9, 14, 2, 2, hexc('#3a2a1e'))
    tex['skins/body'] = sk_body

    # calques d'armure par matériau : chitine = rouge, fer = gris acier
    for mat, r0, r1, r2 in [('chitin', '#b3261e', '#e0503f', '#6e1410'), ('iron', '#9aa1ab', '#d9dde3', '#5a6069'),
                            ('steel', '#5f6f84', '#a9bbd0', '#2f3a48')]:
        red, red_hi, red_lo = hexc(r0), hexc(r1), hexc(r2)
        sk_helmet = blank()
        rect(sk_helmet, 4, 1, 8, 3, red)
        rect(sk_helmet, 5, 1, 4, 1, red_hi)
        rect(sk_helmet, 7, 0, 2, 1, red_lo)             # crête
        rect(sk_helmet, 4, 4, 2, 1, red_lo)             # protège-joues
        rect(sk_helmet, 10, 4, 2, 1, red_lo)
        tex['skins/' + mat + '_helmet'] = sk_helmet
        sk_chest = blank()
        rect(sk_chest, 4, 7, 8, 3, red)
        rect(sk_chest, 5, 8, 6, 1, red_lo)              # jointure des plaques
        rect(sk_chest, 5, 7, 2, 1, red_hi)
        rect(sk_chest, 4, 7, 1, 3, red_lo)              # épaulières
        rect(sk_chest, 11, 7, 1, 3, red_lo)
        tex['skins/' + mat + '_chest'] = sk_chest
        sk_legs = blank()
        rect(sk_legs, 5, 11, 6, 3, red)
        rect(sk_legs, 5, 12, 6, 1, red_lo)
        rect(sk_legs, 7, 11, 2, 3, red_lo)
        rect(sk_legs, 5, 11, 1, 1, red_hi)
        tex['skins/' + mat + '_legs'] = sk_legs
        sk_boots = blank()
        for x0 in (5, 9):
            rect(sk_boots, x0, 14, 2, 2, red)
            rect(sk_boots, x0, 15, 2, 1, red_lo)
            rect(sk_boots, x0 + 1, 14, 1, 1, red_hi)
        tex['skins/' + mat + '_boots'] = sk_boots
    sk_bal = blank()                               # plastron de l'équilibre : ange à gauche, démon à droite
    rect(sk_bal, 4, 7, 4, 3, hexc('#e8f4ff'))
    rect(sk_bal, 8, 7, 4, 3, hexc('#7a1f2a'))
    rect(sk_bal, 4, 7, 1, 3, hexc('#ffd23f'))
    rect(sk_bal, 11, 7, 1, 3, hexc('#3a0f16'))
    rect(sk_bal, 7, 8, 2, 1, hexc('#b06bff'))
    tex['skins/balance_chest'] = sk_bal
    sk_belt = blank()                              # ceinture en peau de gobelin : bande verte, boucle dorée
    rect(sk_belt, 5, 10, 6, 1, hexc('#4f7d32'))
    rect(sk_belt, 7, 10, 2, 1, hexc('#ffd23f'))
    tex['skins/goblin_belt'] = sk_belt
    # épée tenue en main (combat) : même repère que les pioches (poignée en bas à gauche)
    sk_sword = blank()
    for i in range(9):
        rect(sk_sword, 5 + i, 10 - i, 2, 2, hexc('#c9cdd4'))
    rect(sk_sword, 3, 10, 5, 2, hexc('#6b4f3a'))
    rect(sk_sword, 2, 12, 2, 3, hexc('#8a5a2b'))
    tex['skins/sword_iron'] = sk_sword
    # lance tenue en main : même repère (hampe en bas à gauche, pointe en haut à droite)
    sk_spear = blank()
    for i in range(11):
        rect(sk_spear, 2 + i, 14 - i, 1, 1, hexc('#8a5a2b'))
    for x, y in [(12, 4), (13, 3), (14, 2), (13, 4), (12, 3)]:
        rect(sk_spear, x, y, 1, 1, hexc('#c9cdd4'))
    rect(sk_spear, 13, 3, 1, 1, hexc('#eef0f3'))
    tex['skins/spear_iron'] = sk_spear
    sk_sword_st = blank()
    for i in range(9):
        rect(sk_sword_st, 5 + i, 10 - i, 2, 2, hexc('#8d939c'))
    rect(sk_sword_st, 3, 10, 5, 2, hexc('#6b4f3a'))
    rect(sk_sword_st, 2, 12, 2, 3, hexc('#8a5a2b'))
    tex['skins/sword_stone'] = sk_sword_st
    sk_sword_sl = blank()
    for i in range(9):
        rect(sk_sword_sl, 5 + i, 10 - i, 2, 2, hexc('#7f8fa3'))
    rect(sk_sword_sl, 3, 10, 5, 2, hexc('#2f3a48'))
    rect(sk_sword_sl, 2, 12, 2, 3, hexc('#5c3a1a'))
    tex['skins/sword_steel'] = sk_sword_sl

    # pioches tenues en main (manche en bas à gauche, tête en haut à droite) : bois = marron, pierre = grise
    for name, head, light, dark in [('skins/pick_wood', '#7a4f2a', '#a0703f', '#4f321a'),
                                    ('skins/pick_stone', '#8d939c', '#c3c8cf', '#5f646c'),
                                    ('skins/pick_iron', '#b8bec7', '#eef0f3', '#6f7680'),
                                    ('skins/pick_steel', '#6f8197', '#c3d3e4', '#3a4656')]:
        pk = blank()
        for i in range(9):
            rect(pk, 2 + i, 13 - i, 2, 2, hexc('#8a5a2b'))
        for x, y in [(5, 3), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (12, 6), (13, 7)]:
            rect(pk, x, y, 2, 2, hexc(head))
        rect(pk, 6, 2, 3, 1, hexc(light))
        rect(pk, 4, 4, 2, 1, hexc(dark))
        rect(pk, 13, 8, 2, 1, hexc(dark))
        tex[name] = pk

    # anneaux (23/10) : anneau vu de face (métal) et une pierre sur le dessus, couleur propre à chaque anneau
    def ring(metal, gem):
        px = blank()
        m, ml, md = hexc(metal), shade(hexc(metal), 1.3), shade(hexc(metal), 0.6)
        for y in range(S):
            for x in range(S):
                d = ((x - 7.5) ** 2 + (y - 9.5) ** 2) ** 0.5
                if 2.6 <= d <= 5.2:
                    px[y * S + x] = ml if (x < 7 and y < 10) else (md if (x > 8 and y > 10) else m)
        g, gl, gd = hexc(gem), shade(hexc(gem), 1.4), shade(hexc(gem), 0.6)
        rect(px, 6, 1, 4, 4, g)                                             # pierre
        rect(px, 6, 1, 4, 1, gd); rect(px, 6, 4, 4, 1, gd)
        rect(px, 7, 2, 1, 1, gl)                                            # reflet
        rect(px, 6, 5, 4, 1, m)                                             # chaton
        return px
    for name, metal, gem in [('ring_tiger', '#c9a23a', '#ff9a1f'), ('ring_lion', '#c9a23a', '#e03b2a'),
                             ('ring_rat', '#9aa1ab', '#a0623a'), ('ring_whale', '#9aa1ab', '#3aa7ff'),
                             ('ring_cuck', '#9aa1ab', '#7bd25a'), ('ring_nerd', '#9aa1ab', '#b77bff'),
                             ('ring_midas', '#ffd23f', '#fff2a8'), ('ring_jester', '#b06bff', '#ff4fb8')]:
        tex[name] = ring(metal, gem)

    for name, px in tex.items():
        os.makedirs(os.path.dirname(os.path.join(OUT, name + '.png')), exist_ok=True)
        png(os.path.join(OUT, name + '.png'), px)
    # boss des tours : 24 × 40 pixels (3 × 5 cases)
    for name, px in bosses().items():
        png_wh(os.path.join(OUT, name + '.png'), 24, 40, px)
    for name, px in tower_mobs().items():
        png_wh(os.path.join(OUT, name + '.png'), 16, 32, px)
    print('%d textures écrites dans %s' % (len(tex), os.path.normpath(OUT)))


def bosses():
    BW, BH = 24, 40

    def blankb():
        return [(0, 0, 0, 0)] * (BW * BH)

    def r(px, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < BW and 0 <= yy < BH:
                    px[yy * BW + xx] = c

    def figure(skin, robe, robe_d, trim, wing, wing_d, eye, crown, horns):
        px = blankb()
        # ailes déployées derrière le corps
        for i in range(12):
            r(px, 0 + i // 3, 8 + i, 6 - i // 3, 1, wing if i % 3 else wing_d)
            r(px, 18 + i // 3 - (i // 3), 8 + i, 6 - i // 3, 1, wing if i % 3 else wing_d)
        r(px, 1, 7, 4, 1, wing_d); r(px, 19, 7, 4, 1, wing_d)
        # tête
        r(px, 9, 3, 6, 6, skin)
        r(px, 10, 5, 1, 1, eye); r(px, 13, 5, 1, 1, eye)
        r(px, 11, 7, 2, 1, shade(skin, 0.75))
        if crown:  # auréole
            r(px, 8, 0, 8, 1, crown); r(px, 7, 1, 1, 1, crown); r(px, 16, 1, 1, 1, crown); r(px, 8, 2, 8, 1, shade(crown, 0.8))
        if horns:  # cornes
            r(px, 8, 1, 1, 3, horns); r(px, 7, 0, 1, 2, horns); r(px, 15, 1, 1, 3, horns); r(px, 16, 0, 1, 2, horns)
        r(px, 9, 3, 6, 1, shade(skin, 0.85))
        # robe
        r(px, 7, 9, 10, 4, robe)                       # épaules
        for i in range(24):
            w = 8 + i // 4
            r(px, 12 - w // 2, 13 + i, w, 1, robe if (i % 6) else robe_d)
        r(px, 11, 9, 2, 28, robe_d)                     # pli central
        r(px, 7, 9, 10, 1, trim); r(px, 6, 36, 12, 1, trim)
        # bras et arme (lance de lumière / trident)
        r(px, 5, 11, 2, 9, robe); r(px, 17, 11, 2, 9, robe)
        r(px, 5, 20, 2, 2, skin); r(px, 17, 20, 2, 2, skin)
        r(px, 20, 4, 1, 34, trim); r(px, 19, 3, 3, 1, eye); r(px, 20, 2, 1, 1, eye)
        return px

    return {
        'boss_angel': figure(hexc('#f3dcc4'), hexc('#f4f7ff'), hexc('#c9d6ee'), hexc('#ffd23f'),
                             hexc('#ffffff'), hexc('#bfe3ff'), hexc('#3d8bff'), hexc('#ffe27a'), None),
        'boss_demon': figure(hexc('#b0303a'), hexc('#3a1530'), hexc('#220a1c'), hexc('#ff3b3b'),
                             hexc('#5a1f4a'), hexc('#2a0f22'), hexc('#ffd23f'), None, hexc('#e0d0c0')),
    }


def tower_mobs():
    """mobs des étages des tours (23/10) : 1 case de large × 2 de haut (16 × 32 pixels).
    Séraphin : petit gardien ailé en robe blanche, auréole, lance de lumière.
    Diablotin : petit démon rouge sombre, cornes, ailes de chauve-souris, queue fourchue, fourche."""
    MW, MH = 16, 32

    def blankm():
        return [(0, 0, 0, 0)] * (MW * MH)

    def r(px, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < MW and 0 <= yy < MH:
                    px[yy * MW + xx] = c

    # Séraphin
    sp = blankm()
    wing, wing_d = hexc('#ffffff'), hexc('#bfe3ff')
    for i in range(9):                                   # ailes repliées dans le dos
        r(sp, 0 + i // 4, 9 + i, 3, 1, wing if i % 3 else wing_d)
        r(sp, 13 - i // 4, 9 + i, 3, 1, wing if i % 3 else wing_d)
    gold = hexc('#ffd23f')
    r(sp, 5, 1, 6, 1, gold); r(sp, 4, 2, 1, 1, gold); r(sp, 11, 2, 1, 1, gold); r(sp, 5, 3, 6, 1, shade(gold, 0.8))   # auréole
    skin = hexc('#f3dcc4')
    r(sp, 5, 4, 6, 6, skin); r(sp, 5, 4, 6, 1, hexc('#ffe9a8'))          # tête, cheveux dorés
    r(sp, 6, 6, 1, 1, hexc('#3d8bff')); r(sp, 9, 6, 1, 1, hexc('#3d8bff'))
    robe, robe_d = hexc('#f4f7ff'), hexc('#c9d6ee')
    r(sp, 4, 10, 8, 3, robe)
    for i in range(17):
        w = 8 + i // 5
        r(sp, 8 - w // 2, 13 + i, w, 1, robe if i % 5 else robe_d)
    r(sp, 7, 10, 2, 20, robe_d)
    r(sp, 4, 10, 8, 1, gold); r(sp, 3, 29, 10, 1, gold)
    r(sp, 13, 5, 1, 25, hexc('#e8d9a0')); r(sp, 12, 3, 3, 2, hexc('#8fd8ff')); r(sp, 13, 2, 1, 1, hexc('#ffffff'))   # lance
    r(sp, 12, 15, 2, 2, skin)

    # Diablotin
    im = blankm()
    bat, bat_d = hexc('#5a1f4a'), hexc('#2a0f22')
    for i in range(8):                                   # ailes de chauve-souris
        r(im, 0, 8 + i, 3 - i // 3, 1, bat if i % 2 else bat_d)
        r(im, 13 + i // 3, 8 + i, 3 - i // 3, 1, bat if i % 2 else bat_d)
    horn = hexc('#e0d0c0')
    r(im, 4, 2, 1, 3, horn); r(im, 3, 1, 1, 2, horn); r(im, 11, 2, 1, 3, horn); r(im, 12, 1, 1, 2, horn)
    red, red_d = hexc('#b0303a'), hexc('#7a1a24')
    r(im, 5, 4, 6, 6, red); r(im, 5, 9, 6, 1, red_d)
    r(im, 6, 6, 1, 1, hexc('#ffd23f')); r(im, 9, 6, 1, 1, hexc('#ffd23f'))
    r(im, 7, 8, 2, 1, hexc('#220a1c'))
    r(im, 5, 10, 6, 9, red); r(im, 7, 11, 2, 7, red_d)    # corps
    r(im, 5, 18, 6, 2, hexc('#3a1530'))                   # pagne
    r(im, 5, 20, 2, 9, red); r(im, 9, 20, 2, 9, red)      # jambes
    r(im, 4, 29, 3, 2, hexc('#220a1c')); r(im, 9, 29, 3, 2, hexc('#220a1c'))
    r(im, 11, 19, 1, 6, red_d); r(im, 12, 24, 2, 1, red_d); r(im, 13, 23, 1, 1, red_d)   # queue fourchue
    r(im, 2, 6, 1, 22, hexc('#6b6b73')); r(im, 1, 4, 3, 1, hexc('#9a9aa5')); r(im, 1, 3, 1, 1, hexc('#9a9aa5')); r(im, 3, 3, 1, 1, hexc('#9a9aa5'))   # fourche
    r(im, 3, 13, 2, 2, red)
    return {'seraph': sp, 'imp': im}


if __name__ == '__main__':
    main()
