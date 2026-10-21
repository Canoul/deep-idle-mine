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
                                    ('ingot_tainted', '#8b6f8f', '#c2a6c4', '#4f3a52')]:   # alliage fer + chitine
        ing = blank()
        for i, yy in enumerate(range(6, 12)):
            rect(ing, 4 - i // 2, yy, 8 + (i // 2) * 2, 1, hexc(base))
        rect(ing, 4, 6, 8, 1, hexc(light))
        rect(ing, 5, 7, 3, 1, hexc(light))
        rect(ing, 2, 11, 12, 1, hexc(dark))
        tex[name] = ing

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
                              ('iron', '#9aa1ab', '#d9dde3', '#5a6069')]:
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
    for mat, r0, r1, r2 in [('chitin', '#b3261e', '#e0503f', '#6e1410'), ('iron', '#9aa1ab', '#d9dde3', '#5a6069')]:
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
    sk_sword_st = blank()
    for i in range(9):
        rect(sk_sword_st, 5 + i, 10 - i, 2, 2, hexc('#8d939c'))
    rect(sk_sword_st, 3, 10, 5, 2, hexc('#6b4f3a'))
    rect(sk_sword_st, 2, 12, 2, 3, hexc('#8a5a2b'))
    tex['skins/sword_stone'] = sk_sword_st

    # pioches tenues en main (manche en bas à gauche, tête en haut à droite) : bois = marron, pierre = grise
    for name, head, light, dark in [('skins/pick_wood', '#7a4f2a', '#a0703f', '#4f321a'),
                                    ('skins/pick_stone', '#8d939c', '#c3c8cf', '#5f646c'),
                                    ('skins/pick_iron', '#b8bec7', '#eef0f3', '#6f7680')]:
        pk = blank()
        for i in range(9):
            rect(pk, 2 + i, 13 - i, 2, 2, hexc('#8a5a2b'))
        for x, y in [(5, 3), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (12, 6), (13, 7)]:
            rect(pk, x, y, 2, 2, hexc(head))
        rect(pk, 6, 2, 3, 1, hexc(light))
        rect(pk, 4, 4, 2, 1, hexc(dark))
        rect(pk, 13, 8, 2, 1, hexc(dark))
        tex[name] = pk

    for name, px in tex.items():
        os.makedirs(os.path.dirname(os.path.join(OUT, name + '.png')), exist_ok=True)
        png(os.path.join(OUT, name + '.png'), px)
    print('%d textures écrites dans %s' % (len(tex), os.path.normpath(OUT)))


if __name__ == '__main__':
    main()
