"""Le roi gobelin, boss de l'Instance I : 48 × 48 pixels = 3 × 3 cases, de face (03/11/2026, Jules : « roi guerrier
balafré » choisi parmi 3 prototypes, plus détaillé, couronne plus grosse et col d'hermine bien visible ; ancien :
rectangles, cape violette, gen_textures.py instance() du 27/10).

DA du Golbute et de Lucifer : gros trait d'encre, volumes bombés (distance au bord), lumière d'en haut à gauche et lueur
chaude des huttes d'en bas à droite. Il porte son butin : Couronne du Roi Gobelin (or, rubis), cape royale rouge bordée
d'hermine, Masse du Roi Gobelin (tête de fer cloutée, manche de bois gainé de cuir, pommeau d'or). Trapu et voûté,
épaules massives, épaulière de fer, collier de crânes, balafre sur l'œil, défenses, brassards, pagne effiloché ; la
masse traîne au sol. Le visage est dessiné pixel par pixel, après l'encre.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math

S = 48
KEY = (-0.5, -0.75, 0.62)
_n = math.sqrt(sum(c * c for c in KEY))
KEY = tuple(c / _n for c in KEY)
BAYER = (0.125, 0.625, 0.875, 0.375)


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


INK = hx('#120a08')
MATS = {
    'skin': ['#16200c', '#2a3c14', '#3e5a1c', '#557a26', '#6e9a32', '#8cba48', '#b4d870'],
    'cape': ['#2a060a', '#5a0e16', '#8a1620', '#b4222a', '#d83432', '#f05a44', '#ff9a76'],
    'ermine': ['#2e2e38', '#6a6a78', '#a8a8b4', '#d4d4d8', '#f0f0ec', '#ffffff'],
    'gold': ['#3a2306', '#6a420a', '#a8741a', '#e0aa30', '#ffe07a', '#fff4c8'],
    'iron': ['#16161a', '#2e2f35', '#4a4c54', '#6e717a', '#a0a3ab', '#d4d6dc'],
    'wood': ['#24140a', '#3e2412', '#5e3a1c', '#7e5428', '#a07040', '#c8945a'],
    'cloth': ['#1e140c', '#36241a', '#4e3626', '#6a4a34', '#8a6446', '#ac8460'],
    'bone': ['#3a3024', '#6a5a44', '#a8946e', '#dccca2', '#fbf3d8', '#ffffff'],
    'inner': ['#0e0204', '#24060a', '#3a0a10', '#541018', '#6a1a20', '#7a2228'],
}
MATS = {k: [hx(c) for c in v] for k, v in MATS.items()}
WARM = hx('#ff9a3a')   # lueur des huttes, d'en bas à droite


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


def tube(a, b, r0, r1=None):
    r1 = r0 if r1 is None else r1
    (ax, ay), (bx, by) = a, b
    L2 = (bx - ax) ** 2 + (by - ay) ** 2 or 1

    def f(x, y):
        px, py = x + .5 - ax, y + .5 - ay
        t = max(0, min(1, (px * (bx - ax) + py * (by - ay)) / L2))
        dx, dy = px - t * (bx - ax), py - t * (by - ay)
        return dx * dx + dy * dy <= (r0 + (r1 - r0) * t) ** 2
    return f


def mx(pts):
    return [(S - x, y) for x, y in pts]


class Body:
    """parties de l'arrière vers l'avant ; volumes bombés (distance au bord), lumière d'en haut à gauche,
    lueur chaude d'en bas à droite ; puis détails, puis encre"""

    def __init__(s, parts, R=5.0):
        s.part = [[None] * S for _ in range(S)]
        s.z = {}
        s.mat = {}
        for i, (name, inside, m) in enumerate(parts):
            s.z[name], s.mat[name] = i, m
            for y in range(S):
                for x in range(S):
                    if inside(x, y):
                        s.part[y][x] = name
        d = s._dist()
        s.px = [[None] * S for _ in range(S)]
        for y in range(S):
            for x in range(S):
                p = s.part[y][x]
                if p is None:
                    continue
                h = lambda xx, yy: min(d[yy][xx], R) / R if 0 <= xx < S and 0 <= yy < S and s.part[yy][xx] == p else 0
                n = (h(x - 1, y) - h(x + 1, y), h(x, y - 1) - h(x, y + 1), .85)
                m = math.sqrt(sum(c * c for c in n))
                n = tuple(c / m for c in n)
                lum = max(0, sum(n[i] * KEY[i] for i in range(3)))
                ramp = MATS[s.mat[p]]
                kf = 1 + lum ** 1.2 * (len(ramp) - 2.3)
                k = max(1, min(len(ramp) - 2, int(kf + BAYER[(x % 2) + (y % 2) * 2] - .3)))
                if lum > .93:
                    k = len(ramp) - 1
                c = ramp[k]
                warm = max(0, n[0] * .7 + n[1] * .5) * max(0, (y - 26) / 22)   # rebord tourné vers le feu
                if warm > .32:
                    c = tuple(min(255, int(c[i] * .55 + WARM[i] * .45)) for i in range(3))
                s.px[y][x] = c

    def _dist(s):
        P = s.part
        d = [[0] * S for _ in range(S)]
        front = []
        for y in range(S):
            for x in range(S):
                if P[y][x] is None:
                    continue
                if any(not (0 <= x + dx < S and 0 <= y + dy < S) or P[y + dy][x + dx] != P[y][x] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    d[y][x] = 1
                    front.append((x, y))
        k = 1
        while front:
            nxt = []
            for x, y in front:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < S and 0 <= yy < S and P[yy][xx] == P[y][x] and d[yy][xx] == 0:
                        d[yy][xx] = k + 1
                        nxt.append((xx, yy))
            front, k = nxt, k + 1
        return d

    def put(s, x, y, c, part=None):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            s.px[y][x] = c
            if part:
                s.part[y][x] = part

    def ink(s, skip=()):
        out = []
        for y in range(S):
            for x in range(S):
                p = s.part[y][x]
                if p is None:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if not (0 <= xx < S and 0 <= yy < S):
                        continue
                    q = s.part[yy][xx]
                    if q is None or (q != p and s.z.get(q, -1) > s.z.get(p, -1) and (p, q) not in skip and (q, p) not in skip):
                        out.append((x, y))
                        break
        for x, y in out:
            s.px[y][x] = INK

    def stamp(s, x0, y0, rows, pal):
        for dy, row in enumerate(rows):
            for dx, c in enumerate(row):
                if c != '.':
                    s.put(x0 + dx, y0 + dy, pal[c] if c in pal else INK)

    def rgba(s):
        return [(*c, 255) if c else (0, 0, 0, 0) for row in s.px for c in row]


SK = MATS['skin']
IR = MATS['iron']
GD = MATS['gold']
BN = MATS['bone']
CL = MATS['cloth']
RUBY, EMERALD, SCAR = hx('#e0301a'), hx('#3ac04a'), hx('#7a2222')
FACE_PAL = {'k': INK, 'Y': hx('#ffd23f'), 'R': hx('#e0301a'), 'b': BN[3], 'B': BN[4], 'm': SK[2], 's': SK[4],
            'r': MATS['inner'][2]}
# visage (13 × 9), posé après l'encre : arcade lourde, yeux de braise, nez crochu, défenses qui sortent de la mâchoire
FACE = [
    '.kk.......kk.',
    '..kkk...kkk..',
    '.kRYk...kYRk.',
    '..kk..s..kk..',
    '.....ksk.....',
    '....kmmmk....',
    '..B.kkkkk.B..',
    '..bkbrrrbkb..',
    '...kkkkkkk...',
]


def _ermine(b, part, step=3):
    """hermine : fourrure blanche à petites queues noires"""
    for y in range(S):
        for x in range(S):
            if b.part[y][x] == part and (x * 3 + y * 5) % 11 == 0 and y % step == 1:
                b.put(x, y, INK)
                if b.part[min(S - 1, y + 1)][x] == part:
                    b.put(x, y + 1, INK)


def goblin_king():
    """pixels (RGBA) du roi gobelin, 48 × 48"""
    spikes = [((43, 36.5), 0), ((47.6, 41.5), 1), ((38.4, 41.5), 2), ((46.5, 37.5), 3), ((39.5, 37.5), 4)]
    parts = [
        ('cape', poly([(5, 15), (43, 15), (47, 44), (1, 44)]), 'cape'),
        ('hemL', poly([(1, 42), (10, 42), (9, 47), (0, 47)]), 'ermine'),
        ('hemR', poly([(38, 42), (47, 42), (48, 47), (39, 47)]), 'ermine'),
        ('capein', poly([(15, 28), (33, 28), (35, 46), (13, 46)]), 'inner'),
        ('legL', tube((18, 36), (15, 44), 4.0, 3.4), 'skin'),
        ('legR', tube((30, 36), (33, 44), 4.0, 3.4), 'skin'),
        ('kneeL', tube((16.5, 39.5), (16.3, 40.5), 3.9), 'cloth'),
        ('kneeR', tube((31.5, 39.5), (31.7, 40.5), 3.9), 'cloth'),
        ('footL', ellipse(14, 45.5, 5.4, 2.4), 'skin'),
        ('footR', ellipse(34, 45.5, 5.4, 2.4), 'skin'),
        ('loin', poly([(14, 32), (34, 32), (33, 40), (31, 42), (29, 40), (27, 43), (24, 40), (21, 43), (19, 40), (17, 42), (15, 40)]), 'cloth'),
        ('torso', poly([(13, 17), (35, 17), (33, 28), (30, 33), (18, 33), (15, 28)]), 'skin'),
        ('belt', poly([(14, 31), (34, 31), (34, 34), (14, 34)]), 'cloth'),
        ('buckle', poly([(22, 30), (26, 30), (26, 35), (22, 35)]), 'gold'),
        ('handle', tube((41, 31), (42.5, 39), 1.3), 'wood'),
        ('pommel', ellipse(40.8, 29.8, 1.8, 1.6), 'gold'),
        *[('spike%d' % i, ellipse(x, y, 1.3, 1.3), 'iron') for (x, y), i in spikes],
        ('macehead', ellipse(43, 42, 4.4, 4.2), 'iron'),
        ('shL', ellipse(11, 18, 7, 6), 'skin'),
        ('shR', ellipse(37, 18, 7, 6), 'skin'),
        ('armL', tube((9, 21), (6, 33), 4.0, 3.2), 'skin'),
        ('armR', tube((39, 21), (41, 31), 4.0, 3.4), 'skin'),
        ('braceL', tube((6.5, 29), (6.2, 31.5), 3.9), 'cloth'),
        ('braceR', tube((40.6, 28), (40.9, 30.5), 4.0), 'cloth'),
        ('handL', ellipse(6, 35, 3.8, 3.4), 'skin'),
        ('handR', ellipse(41, 33.5, 3.8, 3.4), 'skin'),
        ('pauldron', poly([(4, 15), (14, 12), (18, 16), (12, 20), (3, 20)]), 'iron'),
        ('collar', poly([(10, 12), (38, 12), (41, 17), (34, 20), (24, 21), (14, 20), (7, 17)]), 'ermine'),
        ('brooch', ellipse(12.5, 18.5, 2.4, 2.2), 'gold'),
        ('earL', poly([(18, 10), (2, 4), (5, 9), (11, 12), (18, 15)]), 'skin'),
        ('earR', poly(mx([(18, 10), (2, 5), (6, 10), (12, 12), (18, 15)])), 'skin'),
        ('head', ellipse(24, 15.5, 7.4, 6.8), 'skin'),
        ('jaw', poly([(18, 18), (30, 18), (29, 23), (24, 24), (19, 23)]), 'skin'),
        ('crown', poly([(16, 12), (16, 3), (19, 6), (21, 1), (24, 5), (27, 1), (29, 6), (32, 3), (32, 12)]), 'gold'),
    ]
    b = Body(parts)
    # couronne : rubis au milieu, pierres au bout des pointes, rivets du bandeau
    for x, y, c in ((24, 8, RUBY), (25, 8, RUBY), (24, 9, RUBY), (25, 9, hx('#8a1010')), (24, 7, GD[5]),
                    (17, 5, EMERALD), (21, 3, RUBY), (27, 3, RUBY), (31, 5, EMERALD)):
        b.put(x, y, c)
    for x in (18, 21, 28, 31):
        b.put(x, 10, GD[5]); b.put(x, 11, GD[1])
    b.put(13, 18, EMERALD); b.put(12, 18, hx('#a8f0a0')); b.put(13, 19, hx('#1a7a2a'))   # broche de la cape, sur l'épaule
    _ermine(b, 'collar'); _ermine(b, 'hemL'); _ermine(b, 'hemR')
    # torse : pectoraux, abdos, balafre
    for x in range(16, 33):
        if x != 24 and b.part[23][x] == 'torso':
            b.put(x, 23 + (1 if abs(x - 24) > 5 else 0), SK[2])
    for y in range(25, 31):
        b.put(24, y, SK[2])
    for y in (27, 29):
        for x in (21, 22, 26, 27):
            b.put(x, y, SK[2])
    for i in range(6):
        b.put(32 - i, 19 + i, SCAR)
        if i % 2:
            b.put(32 - i, 20 + i, SK[5])
    # collier de crânes sur une corde
    for x in range(15, 34):
        y = 26 - int(round(((x - 24) / 9) ** 2 * 3))
        if b.part[y][x] == 'torso':
            b.put(x, y, CL[4])
    for cx, cy in ((19, 25), (24, 26), (29, 25)):
        for dx, dy, c in ((0, 0, 4), (1, 0, 3), (-1, 0, 3), (0, 1, 3), (-1, 1, 0), (1, 1, 0), (0, 2, 2), (-1, 2, 2), (1, 2, 2)):
            b.put(cx + dx, cy + dy, BN[c] if c else INK, 'torso')
    # ceinture cloutée, boucle, pagne effiloché
    for x in range(15, 34, 3):
        if not 21 <= x <= 27:
            b.put(x, 32, IR[5])
    b.put(23, 32, MATS['inner'][1]); b.put(24, 32, MATS['inner'][1]); b.put(23, 31, GD[5])
    for x in (17, 20, 28, 31):
        for y in range(36, 40):
            b.put(x, y, CL[1])
    # brassards et genouillères : lacets ; manche de la masse gainé de cuir
    for xs, y0 in (((4, 6, 8), 29), ((39, 41, 43), 28), ((14, 16, 18), 40), ((30, 32, 34), 40)):
        for x in xs:
            b.put(x, y0, CL[5])
    for t in range(0, 8, 2):
        b.put(41 + t * .19, 31.5 + t, CL[3])
    # verrues, épaulière à pointes
    for x, y in ((28, 11), (20, 19)):
        b.put(x, y, SK[2]); b.put(x, y - 1, SK[5])
    for x, y in ((6, 13), (11, 11)):
        b.put(x, y, IR[4], 'pauldron'); b.put(x, y + 1, IR[3], 'pauldron')
    b.ink(skip=(('jaw', 'head'), ('braceL', 'armL'), ('braceR', 'armR'), ('kneeL', 'legL'), ('kneeR', 'legR'),
                *[('spike%d' % i, 'macehead') for _, i in spikes], ('pommel', 'handle')))
    # après l'encre : visage, griffes, ongles des pieds, reflets de la masse et de la couronne
    b.stamp(18, 12, FACE, FACE_PAL)
    for i in range(4):
        b.put(20 + (i % 2), 11 + i, SCAR)                                      # balafre sur l'œil
    for x, y in ((4, 38), (6, 38), (8, 37), (39, 36), (41, 36.5), (43, 36)):  # griffes
        b.put(x, y, BN[3])
    for x in (10, 12, 14, 34, 36, 38):
        b.put(x, 46, BN[3])
    for x, y in ((41, 39), (42, 39), (41, 40)):
        b.put(x, y, IR[5])
    b.put(18, 4, GD[5]); b.put(21, 3, GD[5])
    return b.rgba()


