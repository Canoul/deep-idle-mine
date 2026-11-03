"""Le ver de terre : tête, anneau du corps et queue, 16 × 16 chacun (03/11/2026, Jules : « ver cuirassé » choisi parmi
3 prototypes, plus détaillé, inspiration Dune ; ancien : anneaux roses en rectangles, gen_textures.py du 31/10).

Un ver des profondeurs blindé : plaques de chitine couleur de sable, usées et fendues, qui se chevauchent comme des
écailles (chaque plaque s'évase vers l'avant, arête claire, membrane de chair rose dans le sillon). La tête est plus
grosse que le corps : la gueule s'ouvre en pétales retroussés (dehors en chitine, dedans en chair) sur des anneaux de
dents fines comme des aiguilles et une gorge où rougeoie une braise. Queue : plaques de plus en plus fines, pointe
recourbée, qui sort d'une fente de la roche.
Dessins tournés vers la droite : le jeu les fait pivoter dans le sens de la marche (src/render/worm.js) ; la queue,
elle, sort toujours vers le haut. Icône (lobby, wiki) : la tête.
Utilisé par scripts/gen_textures.py ; stdlib uniquement.
"""
import math

T = 16
LIGHT = (-0.55, -0.7, 0.75)
_n = math.sqrt(sum(c * c for c in LIGHT))
LIGHT = tuple(c / _n for c in LIGHT)
BAYER = (0.125, 0.625, 0.875, 0.375)


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


INK = hx('#140a06')
CHITIN = [hx(c) for c in ['#140a06', '#33210f', '#54391c', '#7a5730', '#a07a46', '#c9a265', '#ecd29a']]
FLESH = [hx(c) for c in ['#3e0e1c', '#7a2436', '#b2485a', '#e07a80']]
TEETH = [hx(c) for c in ['#6e6250', '#b8ac90', '#efe6cc', '#ffffff']]
GULLET = [hx(c) for c in ['#0a0303', '#2a0a06', '#5e1a0a', '#b8461a', '#ff9a3a']]
ROCK = [hx(c) for c in ['#5a5f68', '#7d828c', '#a4a9b2']]


class _Cv:
    def __init__(self):
        self.px = [[None] * T for _ in range(T)]

    def put(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < T and 0 <= y < T:
            self.px[y][x] = c

    def outline(self, sides=(True, True, True, True)):
        """encre posée autour de la forme, dans les pixels vides (côtés : haut, bas, gauche, droite de la forme)"""
        add = []
        for y in range(T):
            for x in range(T):
                if self.px[y][x] is not None:
                    continue
                for (dx, dy), on in zip(((0, 1), (0, -1), (1, 0), (-1, 0)), sides):
                    xx, yy = x + dx, y + dy
                    if on and 0 <= xx < T and 0 <= yy < T and self.px[yy][xx] not in (None, INK):
                        add.append((x, y))
                        break
        for x, y in add:
            self.px[y][x] = INK

    def rgba(self):
        return [(*c, 255) if c else (0, 0, 0, 0) for row in self.px for c in row]


def _tone(rmp, d, x, y, lo=1):
    hi = len(rmp) - 2
    k = max(lo, min(hi, int(lo + max(0, d) * (hi - lo + .6) + BAYER[(x % 2) + (y % 2) * 2])))
    return rmp[k + 1 if d > .94 else k]


# Tête dessinée pixel par pixel, tournée vers la droite (à 16 pixels, une gueule calculée fait des taches).
# k encre · 1 à 6 chitine (ombre → lumière) · f g h i chair (ombre → lumière) · t u v w dents · a b c d e gorge (noir → braise)
# Colonnes 0-1 : sillon de chair ; 2-4 : plaque du cou ; 5 : son arête ; 6 : jointure ; 7-15 : la gueule grande
# ouverte (deux couronnes de dents en aiguilles, braise au fond), pétales retroussés à pointes en haut et en bas.
HEAD = [
    'kkkkkkk.k6k.k5k.',
    'ii5666kk6665565k',
    'ii5666kkiiihhiik',
    'hh4556kihwvwvwhi',
    'hh4556khwvbbbvwh',
    'hh4556khvbuvubvh',
    'gg3415kgwbcdcbwg',
    'gg3145kgvudeduvg',
    'gg3445kgwudeduwg',
    'gg3445kgvbcdcbvg',
    'gg2334kfwbuvubwf',
    'ff2334kfvwbbbwvf',
    'ff2334kfgututugf',
    'ff1223kkggffggfk',
    'ff1223kk3332232k',
    'kkkkkkk.k2k.k2k.',
]
PAL = {'k': INK, **{str(i): CHITIN[i] for i in range(1, 7)}, 'f': FLESH[0], 'g': FLESH[1], 'h': FLESH[2], 'i': FLESH[3],
       't': TEETH[0], 'u': TEETH[1], 'v': TEETH[2], 'w': TEETH[3], 'a': GULLET[0], 'b': GULLET[1], 'c': GULLET[2],
       'd': GULLET[3], 'e': GULLET[4]}
# ton de base de la plaque à chaque ligne (cylindre éclairé d'en haut), et chair du sillon
PLATE_ROW = [None, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, None]
GROOVE_ROW = [None, 'i', 'i', 'h', 'h', 'h', 'g', 'g', 'g', 'g', 'g', 'f', 'f', 'f', 'f', None]


def _sheet(rows):
    assert len(rows) == T and all(len(r) == T for r in rows), [len(r) for r in rows]
    return [(*PAL[c], 255) if c != '.' else (0, 0, 0, 0) for r in rows for c in r]


def worm_body():
    """anneau du corps : deux plaques qui se chevauchent comme des écailles (la tête à droite) : sillon de chair, ombre
    sous l'arête de la plaque d'avant, plaque, arête claire relevée ; fissures, piqûres et poussière"""
    rows = []
    for y in range(T):
        if PLATE_ROW[y] is None:
            rows.append('k' * T)
            continue
        b = PLATE_ROW[y]
        plate = GROOVE_ROW[y] + str(max(1, b - 1)) + str(b) * 5 + str(min(6, b + 1))
        rows.append(plate * 2)
    g = [list(r) for r in rows]
    for x, y, c in ((4, 6, '1'), (3, 7, '1'), (4, 5, '6'), (13, 9, '1'), (12, 10, '1'), (13, 8, '5'),   # fissures
                    (5, 11, '1'), (11, 4, '3'), (3, 2, '5'), (12, 1, '5'), (10, 12, '1')):               # piqûres, poussière
        g[y][x] = c
    return _sheet([''.join(r) for r in g])


def worm_head():
    """tête de profil, gueule ouverte vers la droite (HEAD)"""
    return _sheet(HEAD)


def worm_tail():
    """queue coincée : plaques de plus en plus fines, pointe recourbée, qui sort d'une fente de la roche (vers le haut)"""
    cv = _Cv()
    for y in range(1, T - 2):
        w = .7 + (y - 1) * .31
        xc = 8.5 - 4.0 * ((13 - y) / 12) ** 2.2
        ring = (y - 1) % 3
        for x in range(T):
            u = (x + .5 - xc) / w
            if abs(u) > 1:
                continue
            d = u * LIGHT[0] + math.sqrt(1 - u * u) * LIGHT[2] + (.2 if ring == 0 else 0)
            c = _tone(CHITIN, d, x, y)
            if ring == 2 and y > 3:
                c = FLESH[2] if u < 0 else FLESH[1]                     # sillon de chair entre deux plaques
            cv.put(x, y, c)
    cv.outline()
    for x in range(2, 14):                                              # la fente : bord noir, éclats de roche
        cv.put(x, 14, INK)
        if 4 < x < 12:
            cv.put(x, 15, INK)
    for x, y, c in ((2, 13, 1), (3, 13, 2), (12, 13, 2), (13, 13, 0), (1, 14, 0), (14, 14, 1)):
        cv.put(x, y, ROCK[c])
    return cv.rgba()


def worm_textures():
    """{ nom : pixels 16 × 16 }"""
    return {'worm_head': worm_head(), 'worm_body': worm_body(), 'worm_tail': worm_tail()}
