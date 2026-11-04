"""Cerbère, le boss du Raid 1 : 128 × 96 pixels = 8 × 6 cases (04/11/2026, Geoffrey : « un chien à trois têtes de lave et
des enfers, inspiré de Cerbère »). Il regarde vers la gauche (on entre dans l'arène par la gauche).

DA du Golbute et de Lucifer (scripts/gen_golbute.py, gen_lucifer.py) : gros trait d'encre autour de la silhouette et entre
les parties, volumes bombés nets, deux lumières : une ambiance froide en haut à gauche, la lave d'en bas. Peau d'obsidienne
fendue de veines de lave, trois têtes à des hauteurs différentes (la gauche basse et en avant, celle du milieu haute,
celle de droite en retrait), gueules ouvertes rougeoyantes, yeux de braise, collier de pointes, crinière de flammes sur
la nuque, queue de serpent de lave. Enragé ('cerbere_rage') : les veines et les yeux passent au blanc-jaune.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math
import random

from gen_bosses import hx
from gen_golbute import _dist

W, H = 128, 96
EMPTY = (0, 0, 0, 0)
INK = '#0b0507'
HIDE = [INK, '#1a1014', '#2a1a1e', '#3c2426', '#55302c', '#6e3e32']      # obsidienne brun-rouge
DARK = [INK, '#140b0e', '#211317', '#311b1e', '#432422']
SPIKE = [INK, '#2a2228', '#433a40', '#665a5e', '#8e8286']
LAVA = ['#5a140e', '#a3260f', '#e0501a', '#ff8a2a', '#ffc95a', '#fff2b0']
FIRE = ['#fff0a0', '#ffc23f', '#ff7a1a', '#c8401a']
KEY = (-.55, -.7, .6)
UP = (0, .85, .5)


def _norm(v):
    n = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / n for c in v)


def _ellipse(cx, cy, rx, ry):
    return lambda x, y: ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1


def _poly(pts):
    def inside(x, y):
        xc, yc, c = x + .5, y + .5, False
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 > yc) != (y1 > yc) and xc < (x1 - x0) * (yc - y0) / (y1 - y0) + x0:
                c = not c
        return c
    return inside


def _tube(pts, w0, w1):
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


# anatomie : pattes au sol en bas (y = 95), têtes à gauche
TAIL = _tube([(112, 58), (122, 50), (125, 38), (119, 30), (114, 34)], 7, 3)
LEG_BACK_R = _poly([(96, 60), (110, 60), (112, 80), (114, 95), (102, 95), (100, 80)])
LEG_FRONT_R = _poly([(40, 62), (52, 62), (52, 82), (54, 95), (42, 95), (41, 80)])
BODY = _ellipse(78, 58, 38, 20)
HAUNCH = _ellipse(100, 60, 15, 17)
LEG_BACK = _poly([(88, 64), (104, 64), (106, 82), (110, 95), (94, 95), (92, 82)])
CHEST = _ellipse(52, 58, 18, 19)
LEG_FRONT = _poly([(30, 64), (46, 64), (46, 82), (48, 95), (32, 95), (33, 82)])
NECK_R = _tube([(66, 48), (66, 34), (60, 22)], 15, 11)
NECK_M = _tube([(54, 46), (48, 30), (42, 18)], 16, 12)
NECK_L = _tube([(44, 54), (32, 46), (22, 42)], 16, 12)
# têtes (crâne, museau, mâchoire du bas) : regard vers la gauche
def _head(cx, cy, s=1.0):
    skull = _ellipse(cx, cy, 10 * s, 8.5 * s)
    snout = _poly([(cx - 4 * s, cy - 3 * s), (cx - 19 * s, cy - 1 * s), (cx - 20 * s, cy + 3 * s), (cx - 6 * s, cy + 4 * s)])
    jaw = _poly([(cx - 4 * s, cy + 4 * s), (cx - 17 * s, cy + 6 * s), (cx - 15 * s, cy + 10 * s), (cx - 2 * s, cy + 8 * s)])
    mouth = _poly([(cx - 5 * s, cy + 3.5 * s), (cx - 18 * s, cy + 4 * s), (cx - 16 * s, cy + 7 * s), (cx - 4 * s, cy + 6.5 * s)])
    ear = _poly([(cx + 2 * s, cy - 6 * s), (cx + 9 * s, cy - 16 * s), (cx + 8 * s, cy - 5 * s)])
    return skull, snout, jaw, mouth, ear
HR = _head(62, 22, .9)
HM = _head(44, 16, 1.0)
HL = _head(24, 42, 1.0)
COLLAR = [(60, 40), (46, 40), (36, 50)]


def parts():
    p = [('queue', TAIL, 'hide'), ('patte_ar_d', LEG_BACK_R, 'dark'), ('patte_av_d', LEG_FRONT_R, 'dark'),
         ('cou_d', NECK_R, 'hide'), ('oreille_d', HR[4], 'dark'), ('crane_d', HR[0], 'hide'), ('machoire_d', HR[2], 'dark'),
         ('museau_d', HR[1], 'hide'), ('corps', BODY, 'hide'), ('cuisse', HAUNCH, 'hide'), ('patte_ar', LEG_BACK, 'hide'),
         ('poitrail', CHEST, 'hide'), ('patte_av', LEG_FRONT, 'hide'),
         ('cou_m', NECK_M, 'hide'), ('oreille_m', HM[4], 'dark'), ('crane_m', HM[0], 'hide'), ('machoire_m', HM[2], 'dark'),
         ('museau_m', HM[1], 'hide'),
         ('cou_g', NECK_L, 'hide'), ('oreille_g', HL[4], 'dark'), ('crane_g', HL[0], 'hide'), ('machoire_g', HL[2], 'dark'),
         ('museau_g', HL[1], 'hide')]
    for i, (x, y) in enumerate(COLLAR):
        p.append((f'collier{i}', _ellipse(x, y, 7, 4), 'spike'))
    return p


MATS = {'hide': HIDE, 'dark': DARK, 'spike': SPIKE}
RAGE = {'hide': [INK, '#2a0e0c', '#46160f', '#6a2412', '#933814', '#c25a1c'], 'dark': [INK, '#1e0a0a', '#33110d', '#4a1a10', '#66260f'], 'spike': SPIKE}


def cerbere(rage=False):
    S = max(W, H)
    part = [[None] * S for _ in range(S)]
    z, mat = {}, {}
    for i, (name, inside, m) in enumerate(parts()):
        z[name], mat[name] = i, m
        for y in range(H):
            for x in range(W):
                if inside(x, y):
                    part[y][x] = name
    d = _dist(part, S)
    key, up, R = _norm(KEY), _norm(UP), 6.0

    def pillow(x, y):
        p = part[y][x]
        h = lambda xx, yy: min(d[yy][xx], R) / R if 0 <= xx < W and 0 <= yy < H and part[yy][xx] == p else 0
        return _norm((h(x - 1, y) - h(x + 1, y), h(x, y - 1) - h(x, y + 1), .9))
    out = [[EMPTY] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            p = part[y][x]
            if p is None:
                continue
            ramp, n = (RAGE if rage else MATS)[mat[p]], pillow(x, y)
            lum = .1 + .9 * max(0, sum(n[i] * key[i] for i in range(3))) ** 1.3
            out[y][x] = hx(ramp[int(max(1, min(len(ramp) - 1, lum * (len(ramp) - 1.2) + 1)))])
            low = max(0, (y - 55) / 40) ** 1.2 * max(0, sum(n[i] * up[i] for i in range(3)))
            if low > .35:
                out[y][x] = hx(LAVA[min(3, int((low - .35) / .65 * 4))])
    put = lambda x, y, c: (0 <= int(x) < W and 0 <= int(y) < H) and out[int(y)].__setitem__(int(x), hx(c))
    hot = LAVA[5] if rage else LAVA[3]
    # veines de lave : fissures qui serpentent sur le corps, les cous et les pattes
    r = random.Random(7)
    body_parts = {'corps', 'cuisse', 'poitrail', 'cou_m', 'cou_g', 'cou_d', 'patte_av', 'patte_ar', 'queue'}
    for _ in range(34):
        x, y = r.randrange(W), r.randrange(H)
        if part[y][x] not in body_parts:
            continue
        for k in range(r.randint(5, 11)):
            if not (0 <= x < W and 0 <= y < H) or part[y][x] not in body_parts:
                break
            put(x, y, hot if k % 3 else LAVA[2])
            x += r.choice((-1, 0, 1)); y += r.choice((0, 1, 1))
    # gueules ouvertes, crocs, yeux de braise
    for skull, snout, jaw, mouth, ear in (HR, HM, HL):
        for y in range(H):
            for x in range(W):
                if mouth(x, y):
                    out[y][x] = hx(LAVA[1] if (x + y) % 3 else LAVA[2])
    for (cx, cy, s) in ((62, 22, .9), (44, 16, 1.0), (24, 42, 1.0)):
        for k in range(4):
            fx = cx - 7 * s - k * 3 * s
            put(fx, cy + 4 * s, '#f2e6d0'); put(fx, cy + 5 * s, '#f2e6d0')     # crocs du haut
            put(fx - 1, cy + 6.5 * s, '#d8ccb4')                                # crocs du bas
        ey, ex = cy - 2 * s, cx - 5 * s
        for dx in (0, 1):
            put(ex + dx, ey, '#fff6c0' if rage else LAVA[4]); put(ex + dx, ey + 1, LAVA[3])
        put(cx - 18 * s, cy - .5 * s, INK)                                       # truffe
    # pointes du collier
    for (x, y) in COLLAR:
        for k in range(-2, 3):
            put(x + k * 2.5, y - 4, SPIKE[4]); put(x + k * 2.5, y - 5, SPIKE[3])
    # encre : autour de la silhouette et entre les parties (sur celle de derrière)
    ink = []
    for y in range(H):
        for x in range(W):
            p = part[y][x]
            if p is None:
                if any(0 <= x + dx < W and 0 <= y + dy < H and part[y + dy][x + dx] is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    ink.append((x, y))
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H and part[yy][xx] is not None and z[part[yy][xx]] > z[p]:
                    ink.append((x, y)); break
    for x, y in ink:
        out[y][x] = hx(INK)
    # crinière de flammes sur la nuque (sans encre : elle éclaire)
    fr = random.Random(11)
    for x in range(44, 78):
        top = 30 + int(8 * math.sin(x * .35)) + (x - 44) // 3
        hgt = 6 + fr.randrange(6) + (3 if rage else 0)
        for i in range(hgt):
            y = top - i
            if 0 <= y < H and part[y][x] is None:
                t = i / hgt
                out[y][x] = hx(FIRE[0] if t < .25 else FIRE[1] if t < .5 else FIRE[2] if t < .8 else FIRE[3])
    return [c for row in out for c in row]


def cerbere_textures():
    """{ nom : (largeur, hauteur, pixels) }"""
    return {'cerbere': (W, H, cerbere()), 'cerbere_rage': (W, H, cerbere(rage=True))}


if __name__ == '__main__':
    import os, sys
    sys.path.insert(0, os.path.dirname(__file__))
    from gen_textures import png_wh
    out = os.path.join(os.path.dirname(__file__), '..', 'textures')
    for name, (w, h, px) in cerbere_textures().items():
        png_wh(os.path.join(out, name + '.png'), w, h, px)
