"""Cerbère, le boss du Raid 1 : 128 × 96 pixels = 8 × 6 cases (04/11/2026, Jules : « Molosse des Enfers », choisi parmi
trois pistes ; ancien : chien de lave en boules, Geoffrey). Regard vers la gauche (on entre dans l'arène par la gauche).

Un énorme molosse noir de trois quarts : poitrail lourd, épaules voûtées, pattes de derrière digitigrades. Trois têtes
aux oreilles taillées : l'avant basse qui gronde vers les joueurs, celle du milieu qui rugit vers le haut, celle de
derrière qui se retourne. Gueules béantes, feu au fond de la gorge, grands crocs d'ivoire, babines retroussées, yeux
de braise en amande. Collier de fer à pointes sur chaque cou, chaîne brisée qui pend du collier avant. Crinière de
flammes des nuques au garrot, queue terminée par une touffe de feu. Pelage noir aux reflets violets froids, mèches,
touffes qui dépassent, cicatrices ; deux lumières : clé froide d'en haut, lave qui remonte du sol.

Animé (RAID.cerbere.anim en config : FRAMES images, en boucle) : la crinière et la queue ondulent et lâchent des
flammèches, des braises montent, la bave de lave s'allonge puis tombe en goutte, des filets de lave s'étirent entre
les crocs et cassent, les gorges et les yeux pulsent. Enragé : pelage rouge braise, feu plus haut et plus blanc,
yeux blancs.
Textures : 'cerbere' / 'cerbere_rage' (image fixe : lobby de guilde, et si la planche manque) ; 'cerbere_anim' /
'cerbere_rage_anim' (planche : FRAMES images de 128 × 96 côte à côte). Moteur : scripts/gen_sculpt.py ; stdlib uniquement.
"""
import copy
import math
import random

from gen_sculpt import Sculpt, ellipse, poly, tube, union, hx

W, H = 128, 96
FRAMES = 12          # = RAID.cerbere.anim.frames (src/config.js)
TAU = 2 * math.pi

FUR = ['#050408', '#100c14', '#19131e', '#241b2a', '#322537', '#433148', '#58405c', '#735573', '#93708c']
FAR = ['#050408', '#0b0910', '#120e17', '#1a1520', '#241c2a', '#2f2536']                # tête, cou, pattes de derrière
LAVA = ['#5a120a', '#9e240e', '#d84012', '#ff6a1e', '#ffa040']
FIRE_BACK = ['#2a0604', '#5a0e06', '#8e1a08', '#c42c0a', '#e8461a']
FIRE = ['#6e1408', '#b8260a', '#ee4a10', '#ff7e22', '#ffb43a', '#ffe08a', '#fffbe0']
IRON = ['#050408', '#2c2830', '#4a444f', '#7d7584', '#bdb4c0']
BONE, BONE2 = '#ece0c8', '#a8977c'
EAR_IN = ['#3a1018', '#5e1c26', '#7e2c34']
INK = '#040306'
# enragé : pelage qui rougeoie, feu plus blanc
RAGE_FUR = ['#070306', '#1a0a0e', '#2a0f14', '#3c141a', '#521c20', '#6c2626', '#88342c', '#a64834', '#c46440']
RAGE_FIRE_BACK = ['#4a0a04', '#8e1a08', '#d4380e', '#ff6a1e', '#ffa040']
RAGE_FIRE = ['#c42c0a', '#ff6a1e', '#ffa040', '#ffd27a', '#fff0b8', '#ffffff', '#ffffff']


# ---------- anatomie ----------
def head(cx, cy, s=1.0, flip=False, gape=1.0):
    """tête de molosse, museau vers la gauche (flip : vers la droite) : 'head' (crâne + museau + bajoues d'un bloc),
    'jaw' (mâchoire du bas, derrière), 'ear' (oreille taillée en pointe) ; et ses repères (q : repère de la tête ->
    pixels, gape : ouverture de la gueule)"""
    f = (lambda x: 2 * cx - x) if flip else (lambda x: x)
    Q = lambda pts: [(f(cx + dx * s), cy + dy * s) for dx, dy in pts]
    P = lambda pts: poly(Q(pts))
    g = gape
    shapes = {
        'ear': P([(0, -7), (5, -15), (7.5, -21), (9, -14), (11, -6)]),
        'head': union(ellipse(f(cx + 1 * s), cy - 1.5 * s, 10 * s, 9 * s),
                      P([(-3, -6), (-11, -5), (-16, -3.5), (-17.5, -1), (-16.5, 2.5), (-3, 4)]),
                      P([(-8, -6.5), (0, -10.5), (7, -8), (-2, -3)]),
                      ellipse(f(cx + 1 * s), cy + 3 * s, 8 * s, 6 * s)),
        'jaw': P([(-1, 4), (-15, 2.5 + 4 * g), (-15.5, 5 + 4 * g), (-12, 7.5 + 4 * g), (-2, 10), (5, 8)]),
    }
    pts = {
        'eye': (f(cx - 4.5 * s), cy - 4.5 * s),
        'nose': (f(cx - 17 * s), cy - 2 * s),
        'mouth': P([(-4, 3.5), (-16.5, 2.5), (-15, 3 + 4 * g), (-3, 7.5)]),
        'q': Q, 'cx': cx, 'cy': cy, 's': s, 'flip': flip, 'g': g,
    }
    return shapes, pts


HF = head(24, 56, 1.15, gape=2.0)               # avant : basse, gronde vers les joueurs
HM = head(34, 22, 1.12, gape=2.4)               # milieu : haute, rugit
HB = head(82, 17, 1.0, flip=True, gape=1.6)     # arrière : se retourne
HEADS = [HB, HM, HF]

BODY = {
    'tail': tube([(110, 48), (119, 40), (124, 29), (121, 19), (114, 15)], 8, 3),
    'leg_bf': union(tube([(88, 58), (84, 71), (96, 81), (95, 90)], 13, 7), ellipse(93, 92, 6.5, 3.5)),
    'leg_ff': union(tube([(66, 58), (64, 74), (61, 88)], 14, 9), ellipse(57, 92, 8, 4)),
    'neck_b': tube([(62, 42), (72, 30), (80, 22)], 18, 14),
    'torso': poly([(36, 42), (52, 32), (70, 34), (88, 40), (102, 42), (113, 47), (115, 57), (110, 66), (96, 64),
                   (82, 60), (66, 70), (52, 76), (40, 70), (34, 56)]),
    'thigh': ellipse(101, 56, 14, 14),
    'leg_bn': union(tube([(103, 62), (99, 73), (113, 82), (111, 90)], 13, 7), ellipse(107, 92, 7.5, 3.8)),
    'shoulder': ellipse(52, 52, 15, 17),
    'leg_fn': union(tube([(50, 60), (46, 75), (43, 87)], 17, 10), ellipse(36, 91, 10, 4.8)),
    'neck_m': tube([(52, 42), (46, 32), (40, 24)], 20, 16),
    'neck_f': tube([(48, 48), (38, 53), (30, 57)], 20, 16),
}


def parts():
    """(nom, forme, matière) de l'arrière vers l'avant"""
    hb, hm, hf = HB[0], HM[0], HF[0]
    return [
        ('tail', BODY['tail'], 'hide'),
        ('b_ear', hb['ear'], 'far'), ('neck_b', BODY['neck_b'], 'far'),
        ('b_jaw', hb['jaw'], 'far'), ('b_head', hb['head'], 'far'),
        ('leg_bf', BODY['leg_bf'], 'far'), ('leg_ff', BODY['leg_ff'], 'far'),
        ('torso', BODY['torso'], 'hide'), ('thigh', BODY['thigh'], 'hide'), ('leg_bn', BODY['leg_bn'], 'hide'),
        ('m_ear', hm['ear'], 'hide'), ('neck_m', BODY['neck_m'], 'hide'),
        ('m_jaw', hm['jaw'], 'hide'), ('m_head', hm['head'], 'hide'),
        ('shoulder', BODY['shoulder'], 'hide'), ('leg_fn', BODY['leg_fn'], 'hide'),
        ('f_ear', hf['ear'], 'hide'), ('neck_f', BODY['neck_f'], 'hide'),
        ('f_jaw', hf['jaw'], 'hide'), ('f_head', hf['head'], 'hide'),
    ]


# points d'où partent les flammes : crinière (x, y, hauteur), nuques, queue ; bave : (x, y, longueur max, phase)
MANE = [(53 + i * 2.2, 33 + i * .5, 12 - i * .6) for i in range(17)]
NAPE = [(49 - i * 1.0, 37 + i * 1.6, 9) for i in range(5)] + [(44 + i * .8, 31 - i * 1.3, 7) for i in range(5)]
TAIL = [(115, 16, 11), (117, 18, 9), (113, 18, 9)]
DROOL = [(10, 67, 9, 0), (15, 66, 5, .45), (21, 34, 8, .2), (26, 36, 4, .7), (96, 28, 6, .55)]


# ---------- détails ----------
def strokes(s, parts_ok, rng, n, color_fn, length, angle):
    """poils : petits traits orientés sur les parties `parts_ok` (préfixes)"""
    for _ in range(n):
        x, y = rng.randrange(s.W), rng.randrange(s.H)
        p = s.part[y][x]
        if p is None or p == '_fx' or not p.startswith(parts_ok):
            continue
        L = rng.randint(*length)
        a = rng.uniform(*angle)
        for k in range(L):
            xx, yy = int(round(x + math.cos(a) * k)), int(round(y + math.sin(a) * k))
            if 0 <= xx < s.W and 0 <= yy < s.H and s.part[yy][xx] == p:
                c = color_fn(s.out[yy][xx])
                if c:
                    s.out[yy][xx] = hx(c)


def tufts(s, parts_ok, rng, side, pal, step=3, length=(2, 4), lean=(1, 0), chance=.8):
    """touffes de poil qui dépassent de la silhouette, sur les bords des parties `parts_ok` dont le voisin côté `side`
    est vide ; couchées vers `lean` (le poil part vers l'arrière)"""
    sx, sy = side
    cand = [(x, y) for y in range(s.H) for x in range(s.W)
            if s.part[y][x] is not None and s.part[y][x].startswith(parts_ok)
            and 0 <= x + sx < s.W and 0 <= y + sy < s.H and s.part[y + sy][x + sx] is None]
    for (x, y) in cand:
        if (x * 7 + y * 13) % step or rng.random() > chance:
            continue
        L = rng.randint(*length)
        for k in range(1, L + 1):
            s.fx(x + sx * k + lean[0] * k * .6, y + sy * k + lean[1] * k * .6, pal[min(len(pal) - 1, int(k / L * len(pal)))])


def collar(s, c, d, half, spike, tip, thick, only, curve, tag, spikes=(-1, 0, 1)):
    """collier de fer centré en c, en travers d'un cou de direction d (vers la tête), courbé (on voit l'anneau) ; il
    devient une partie (tag) pour que l'encre l'entoure ; pointes coniques aux deux bords du cou et au milieu"""
    band = IRON
    dx, dy = d; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    px, py = -dy, dx
    for i in range(-half * 2, half * 2 + 1):
        u = i / 2
        for k in range(thick):
            v = k - thick / 2 + .5 - curve * (u / half) ** 2
            x, y = c[0] + px * u + dx * v, c[1] + py * u + dy * v
            xi, yi = int(round(x)), int(round(y))
            if not (0 <= xi < s.W and 0 <= yi < s.H and s.part[yi][xi] and s.part[yi][xi].startswith(only)):
                continue
            col = band[3] if k == thick - 1 else band[0] if k == 0 else band[2] if k == thick - 2 else band[1]
            if k == thick - 2 and i % 6 == 0:
                col = '#d8d0dc'                                                  # rivets
            s.put(x, y, col)
            s.part[yi][xi] = tag
            s.z[tag] = 10 ** 5
    for side in spikes:
        if side == 0:
            bx, by, ox, oy, n = c[0] + dx * thick / 2, c[1] + dy * thick / 2, dx, dy, 3
        else:
            bx, by, ox, oy, n = c[0] + px * half * side, c[1] + py * half * side, px * side, py * side, 5
        for k in range(n):
            w = (n - k) / n * 1.6
            for j in range(-2, 3):
                if abs(j) <= w:
                    s.fx(bx + ox * k - oy * j * .6, by + oy * k + ox * j * .6, tip if k == n - 1 else spike if j <= 0 else band[2])


def chain(s, pts):
    """chaîne pendante : maillons alternés de face et de profil"""
    for i, (x, y) in enumerate(pts):
        if i % 2 == 0:
            for (a, b) in [(-1, 0), (0, -1), (1, 0), (0, 1)]:
                s.fx(x + a, y + b, IRON[4] if b <= 0 else IRON[2])
            s.fx(x, y, IRON[0])
        else:
            s.fx(x, y - 1, IRON[4]); s.fx(x, y, IRON[2]); s.fx(x, y + 1, IRON[2])


def claws(s, paws, n=3, gap=4):
    """griffes recourbées qui dépassent de la patte : (x de la griffe avant, y du sol)"""
    for (x, y) in paws:
        for i in range(n):
            for (dx, dy, c) in [(1, -2, BONE2), (0, -1, BONE), (-1, -1, BONE), (-2, 0, BONE), (-3, 0, BONE2), (0, 0, BONE2),
                                (-1, 0, BONE)]:
                s.fx(x + i * gap + dx, y + dy, c)


def mouths(s, fire, canine=6):
    """gueules béantes : fond de gorge en feu, langue, gencives, quelques dents et de grands crocs"""
    throat, inner, gum, tooth_dark, tongue = '#3a0806', '#1a0405', '#8a1e28', '#bfae92', ('#8a2630', '#c2444c')
    for _, p in HEADS:
        Q, g, sc, m = p['q'], p['g'], p['s'], p['mouth']
        (fx, _), (bx, _) = Q([(-16.5, 0), (-3, 0)])
        cy = p['cy']
        for y in range(int(cy - 3), int(cy + 20 * sc)):
            for x in range(int(min(fx, bx)) - 2, int(max(fx, bx)) + 3):
                if m(x, y):
                    t = abs(x - bx) / (abs(fx - bx) or 1)          # 0 au fond de la gorge, 1 devant
                    if t < .6:
                        k = (1 - t / .6) * (len(fire) - 1) + ((x + y) % 2) * .5
                        s.fx(x, y, fire[min(len(fire) - 1, int(k))], '_fl')
                    else:
                        s.fx(x, y, throat if t < .7 else inner, '_fl')
        lo_line = lambda u: 3 + 4 * g - (u + 15) / 12 * (4 * g - 3)       # bord de la mâchoire du bas (u de -15 à -3)
        for u10 in range(-125, -35):                                     # langue, posée sur la mâchoire du bas
            u = u10 / 10
            for v, c in [(-.6, tongue[1]), (.4, tongue[0])]:
                (x, y), = Q([(u, lo_line(u) + v - 1.2)])
                if m(int(round(x)), int(round(y))):
                    s.put(x, y, c)
        for u10 in range(-160, -30, 5):                                  # gencives
            u = u10 / 10
            (x, y), = Q([(u, 3.6 + (u + 16) * .07)]); s.put(x, y, gum)
            (x, y), = Q([(u + 1, lo_line(u + 1) - .6)]); s.put(x, y, gum)
        for u, L in [(-15.5, 1.5), (-13.5, canine), (-10, 1.5), (-7, 1)]:  # dents du haut (u, longueur)
            for k in range(int(round(L * sc))):
                (x, y), = Q([(u, 3.5 + (u + 16) * .07 + 1 + k)])
                s.put(x, y, BONE if k < L * sc - 1.5 else tooth_dark)
        for u, L in [(-14, 1.5), (-11.5, canine - 1), (-7.5, 1)]:        # dents du bas
            for k in range(int(round(L * sc))):
                (x, y), = Q([(u, lo_line(u) - 1 - k)])
                s.put(x, y, BONE if k < L * sc - 1.5 else tooth_dark)


def snarl(s, color):
    """rides du museau retroussé et pli du front"""
    for _, p in HEADS:
        for pts in [[(-12, -3), (-10.5, -1), (-11.5, 1)], [(-9, -4), (-7.5, -2), (-8.5, 0)], [(-6, -5.5), (-4.5, -3.5)],
                    [(-1, -9), (1, -7)]]:
            s.path(p['q'](pts), color)


def noses(s):
    for _, p in HEADS:
        x, y = p['nose']
        d = -1 if p['flip'] else 1
        for px, py in [(x, y), (x + d, y), (x, y + 1), (x + d, y + 1), (x + 2 * d, y), (x + 2 * d, y - 1)]:
            s.put(px, py, '#030205')
        s.put(x + d, y, '#8a7a90')


def eyes(s, core, mid, halo):
    """oeil en amande de braise, en biais (regard mauvais), arcade d'encre au-dessus, lueur autour"""
    for _, p in HEADS:
        x, y = (int(round(v)) for v in p['eye'])
        d = -1 if p['flip'] else 1
        for px, py in [(x - 3 * d, y + 2), (x + 3 * d, y), (x - 2 * d, y + 2), (x - d, y + 2), (x, y + 2), (x + d, y + 1),
                       (x + 2 * d, y + 1)]:
            s.put(px, py, halo)
        for px, py in [(x - 2 * d, y + 1), (x - d, y + 1), (x, y + 1), (x - d, y), (x, y), (x + d, y), (x + 2 * d, y)]:
            s.put(px, py, mid)
        s.put(x, y, core); s.put(x - d, y + 1, core); s.put(x - d, y, core)
        for px, py in [(x - 3 * d, y), (x - 3 * d, y + 1), (x - 2 * d, y - 1), (x - d, y - 1), (x, y - 1), (x + d, y - 1),
                       (x + 2 * d, y - 1), (x + 3 * d, y - 1), (x + 4 * d, y - 2)]:
            s.put(px, py, '#050307')


# ---------- le corps (fixe) ----------
def base(rage=False):
    """le corps et ses détails fixes, encré ; les lumières qui bougent sont posées par frame()"""
    fur = RAGE_FUR if rage else FUR
    rng = random.Random(3)
    mats = {'hide': {'pal': fur, 'facets': False}, 'far': {'pal': FAR, 'facets': False}}
    s = Sculpt(W, H, parts(), mats, R=7, dark=(66, 30, .45), lava_up=(44, 50, LAVA), hi=(3, 1), key=(-.5, -.8, .6))
    level = {hx(c): i for i, c in enumerate(fur)}
    darker = lambda c: fur[max(1, level[c] - 1)] if level.get(c) else None
    lighter = lambda c: fur[min(len(fur) - 1, level[c] + 1)] if level.get(c, 0) >= 3 else None
    body = ('torso', 'thigh', 'shoulder', 'neck', 'leg_fn', 'leg_bn', 'tail')
    # pelage : mèches sombres partout, reflets sur les zones éclairées ; poil couché vers l'arrière et le bas
    strokes(s, body + ('f_head', 'm_head'), rng, 1400, darker, (2, 4), (.6, 1.3))
    strokes(s, body, rng, 550, lighter, (2, 3), (.6, 1.3))
    # musculature : omoplate, triceps, côtes, flanc, cuisse, jarret
    for pts in [[(40, 43), (44, 50), (45, 58)], [(45, 58), (50, 64), (56, 64)], [(60, 45), (63, 53), (62, 61)],
                [(67, 44), (70, 52), (69, 59)], [(74, 45), (76, 52)], [(90, 49), (94, 57), (100, 62)],
                [(103, 64), (106, 72)], [(46, 70), (45, 78)], [(98, 74), (104, 79)]]:
        s.path(pts, fur[1])
    # cicatrices : balafres claires sur l'épaule et le flanc
    for pts in [[(48, 47), (53, 52)], [(50, 46), (55, 51)], [(80, 47), (84, 54)]]:
        s.path(pts, fur[7])
        s.path([(x + 1, y) for x, y in pts], fur[2])
    # intérieur des oreilles
    for _, p in HEADS:
        inner = poly(p['q']([(3, -8), (6, -14), (7.5, -18), (8.2, -14), (9, -8)]))
        for y in range(H):
            for x in range(W):
                if inner(x, y) and s.part[y][x] and s.part[y][x].endswith('_ear'):
                    s.put(x, y, EAR_IN[0] if s.part[y][x].startswith('b_') else EAR_IN[1 if (x + y) % 3 else 2])
    # reflets froids sur le dessus des museaux et des crânes
    for hd, far in ((HF, False), (HM, False), (HB, True)):
        Q, c = hd[1]['q'], FAR[5] if far else fur[7]
        s.path(Q([(-16, -3.2), (-11, -4.6), (-6, -5.6)]), c)
        s.path(Q([(-2, -9.6), (3, -10), (7, -8.5)]), c)
    # touffes : sous les cous et le poitrail, derrière les cuisses et les avant-bras, derrière les crânes
    tufts(s, ('neck_f', 'neck_m', 'shoulder', 'torso'), rng, (0, 1), [fur[3], fur[2], fur[1]], step=2, length=(2, 4), lean=(1, .2))
    tufts(s, ('thigh', 'leg_bn', 'leg_fn', 'tail'), rng, (1, 0), [fur[3], fur[2], fur[1]], step=3, length=(2, 3), lean=(.3, .8))
    tufts(s, ('f_head', 'm_head'), rng, (1, 0), [fur[4], fur[3], fur[2]], step=2, length=(2, 3), lean=(.2, .6), chance=.6)
    # colliers à pointes ; chaîne brisée qui pend du collier avant (dernier maillon ouvert)
    collar(s, (38, 53), (-1, .3), 9, IRON[3], '#f0e8f2', 5, ('neck_f',), 2, 'col_f')
    collar(s, (46, 32), (-.55, -1), 9, IRON[3], '#f0e8f2', 5, ('neck_m',), 2, 'col_m')
    collar(s, (73, 29), (.65, -1), 8, IRON[2], IRON[4], 4, ('neck_b',), 1.5, 'col_b')
    chain(s, [(39, 61 + i * 2) for i in range(9)])
    s.fx(38, 80, IRON[3]); s.fx(40, 81, IRON[3])
    # pattes : doigts séparés, griffes
    for px, py in [(31, 92), (35, 92), (39, 92), (53, 93), (57, 93), (89, 93), (93, 93), (102, 93), (106, 93)]:
        s.put(px + 2, py, fur[1]); s.put(px + 2, py + 1, fur[1])
    claws(s, [(31, 95), (53, 95), (89, 95), (102, 95)])
    s.finish(INK, merge=[('torso', 'thigh', 'shoulder', 'neck_m', 'neck_f', 'tail')])
    s.rage, s.fur = rage, fur
    return s


# ---------- ce qui bouge ----------
def flame(s, bx, by, h, w, lean, pal, avoid, t, seed):
    """une langue de feu qui ondule (t de 0 à 1, en boucle) : sa hauteur respire, sa pointe se balance, une
    flammèche s'en détache une fois par boucle ; ne passe pas devant les parties `avoid`"""
    r = random.Random(seed)
    ph = r.random()
    hh = max(2, h * (.78 + .22 * math.sin(TAU * (t + ph))) + .8 * math.sin(TAU * (2 * t + ph * 3)))
    for k in range(int(hh) + 1):
        f = k / hh
        wid = w * (1 - f) ** .8
        cx = bx + lean * k + 1.3 * f * f * math.sin(TAU * (t + ph) + k * .5)
        for dx in range(-int(wid + 1), int(wid + 1) + 1):
            x, y = int(round(cx + dx)), int(round(by - k))
            if not (0 <= x < s.W and 0 <= y < s.H) or abs(dx) > wid:
                continue
            p = s.part[y][x]
            if p is not None and p not in ('_fx', '_fl') and avoid and p.startswith(avoid):
                continue
            v = (1 - f) * .85 + (1 - abs(dx) / (wid + .01)) * .35 - .25
            s.fx(x, y, pal[max(0, min(len(pal) - 1, int(v * (len(pal) - 1) + .5)))], '_fl')
    u = (t + ph) % 1
    if u < .5 and r.random() < .6:
        x, y = bx + lean * hh + 1, by - hh - 1 - u * 8
        s.fx(x, y, pal[3], '_fl')
        if u < .25:
            s.fx(x, y + 1, pal[2], '_fl')


def frame(b, i, n=FRAMES):
    """image i sur n de la boucle : le corps (b = base()) et tout ce qui bouge"""
    t = i / n
    s = copy.copy(b)
    s.out = [row[:] for row in b.out]
    s.part = [row[:] for row in b.part]
    fb, fi = (RAGE_FIRE_BACK, RAGE_FIRE) if b.rage else (FIRE_BACK, FIRE)
    avoid, grow = ('f_', 'm_', 'b_', 'col_'), 1.25 if b.rage else 1
    # crinière : couche de fond (rouge, haute) puis couche avant (vive) ; queue
    for j, (x, y, h) in enumerate(MANE + NAPE):
        flame(s, x + 1, y, h * 1.4 * grow, 3.0, 1.1, fb[2:] + fi[3:4], avoid, t, 100 + j)
    for j, (x, y, h) in enumerate(MANE + NAPE):
        flame(s, x, y + 1, h * .9 * grow, 2.2, .9, fi[1:], avoid, t, 200 + j)
    for j, (x, y, h) in enumerate(TAIL):
        flame(s, x, y, h * grow, 3, .3, fb, (), t, 300 + j)
        flame(s, x, y + 1, h * .6 * grow, 2, .2, fi, (), t, 400 + j)
    # braises qui montent en ondulant (chacune boucle exactement)
    r = random.Random(7)
    for _ in range(40):
        x0, y0, rise, ph = r.uniform(44, 124), r.uniform(20, 46), r.uniform(14, 30), r.random()
        u = (t + ph) % 1
        x, y = x0 + 1.5 * math.sin(TAU * (u * 2 + ph)), y0 - u * rise
        if y >= 0 and u < .9:
            s.fx(x, y, fi[6 if u < .3 else 5 if u < .6 else 3], '_fl')
    # gueules : le feu de la gorge pulse
    pulse = .5 + .5 * math.sin(TAU * t)
    mouths(s, fi[2:] if b.rage else fi[1 + (pulse > .5):])
    # filets de lave tendus entre les crocs : ils s'étirent, cassent au milieu, se reforment
    for hd in (HF, HM):
        Q, g = hd[1]['q'], hd[1]['g']
        for u_, ph in ((-9, 0), (-6.5, .5)):
            v = (t + ph) % 1
            (tx, ty), = Q([(u_, 4.5)])
            (bx, by), = Q([(u_ + .5, 3 + 4 * g - (u_ + 15) / 12 * (4 * g - 3) - 1.5)])
            if v < .7:
                n_ = int(abs(by - ty))
                for k in range(n_ + 1):
                    if v > .5 and abs(ty + k - (ty + by) / 2) < 1:
                        continue
                    s.fx(tx + (bx - tx) * k / max(1, n_), ty + k, fi[4], '_fl')
    snarl(s, b.fur[1])
    noses(s)
    # bave de lave : s'allonge, se détache, tombe en goutte
    for (x, y, L, ph) in DROOL:
        u = (t + ph) % 1
        if u < .6:
            ln = 2 + (L - 2) * u / .6
            for k in range(int(ln)):
                s.fx(x, y + k, fi[4] if k < ln - 2 else fi[6], '_fl')
            s.fx(x, y + int(ln), fi[2], '_fl')
        else:
            s.fx(x, y, fi[4], '_fl'); s.fx(x, y + 1, fi[4], '_fl')
            fy = y + L + (u - .6) / .4 * 14
            s.fx(x, fy, fi[5], '_fl'); s.fx(x, fy - 1, fi[3], '_fl')
    # yeux qui pulsent (enragé : blancs)
    if b.rage:
        eyes(s, '#ffffff', '#fff6d0', '#ff8a2a')
    else:
        eyes(s, '#fffbe0', '#ffc23f' if pulse > .3 else '#ffb02a', '#e0400e' if pulse > .5 else '#b8300a')
    return s


def sheet(frames):
    """planche : les images côte à côte, de gauche à droite"""
    return [c for y in range(H) for f in frames for c in f.out[y]]


def cerbere_textures():
    """{ nom : (largeur, hauteur, pixels) }"""
    out = {}
    for rage, name in ((False, 'cerbere'), (True, 'cerbere_rage')):
        b = base(rage)
        frames = [frame(b, i) for i in range(FRAMES)]
        out[name] = (W, H, frames[0].pixels())
        out[name + '_anim'] = (W * FRAMES, H, sheet(frames))
    return out


if __name__ == '__main__':
    import os, sys
    sys.path.insert(0, os.path.dirname(__file__))
    from gen_textures import png_wh
    out = os.path.join(os.path.dirname(__file__), '..', 'textures')
    for name, (w, h, px) in cerbere_textures().items():
        png_wh(os.path.join(out, name + '.png'), w, h, px)
