"""Génère le favicon du site (icône de l'onglet) dans textures/ (PNG, stdlib uniquement).

Usage : python scripts/gen_favicon.py
Un seul dessin 16x16 (pioche d'acier et éclat de diamant sur une case « Forge noire »), agrandi
sans lissage en 32x32 (écrans haute densité) et 192x192 (raccourci sur l'écran d'accueil du téléphone).
"""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'textures')

# couleurs : bord et fond = palette de l'interface (src/ui/style.css), pioche = textures/pickaxe_steel.png
PAL = {
    '.': (0, 0, 0, 0),
    'B': (0x8f, 0x2f, 0x0c, 255),   # --acc-dk
    'D': (0x19, 0x13, 0x10, 255),   # --panel
    'h': (0xc8, 0xd8, 0xe8, 255),   # acier, reflet
    'H': (0x84, 0x96, 0xae, 255),   # acier
    'S': (0x3e, 0x4a, 0x5c, 255),   # acier, ombre
    'w': (0x9a, 0x5c, 0x2c, 255),   # manche
    'W': (0x5e, 0x34, 0x16, 255),   # manche, ombre
    'c': (0x4c, 0xe0, 0xec, 255),   # diamant
    'C': (0xe6, 0xfe, 0xff, 255),   # diamant, éclat
}

ICON = [
    '.BBBBBBBBBBBBBB.',
    'BDDDDDDDDDDDDDDB',
    'BDDDDhhhhhDDDDDB',
    'BDDhhHHHHHHhDDDB',
    'BDhHHSSSSSHHHDDB',
    'BDSSDDDDDWwHHDDB',
    'BDDDDDDDWwDSHHDB',
    'BDDDDDDWwDDDSHDB',
    'BDDDDDWwDDDDSHDB',
    'BDDDDWwDDDDDDSDB',
    'BDDDWwDDDDDcDDDB',
    'BDDWwDDDDDcCcDDB',
    'BDWwDDDDDDDcDDDB',
    'BDWDDDDDDDDDDDDB',
    'BDDDDDDDDDDDDDDB',
    '.BBBBBBBBBBBBBB.',
]


def png(path, rows, scale):
    """rows : lignes de caractères (clés de PAL), agrandies de `scale` pixels sans lissage."""
    px = [[PAL[ch] for ch in row for _ in range(scale)] for row in rows]
    lines = [line for line in px for _ in range(scale)]
    w, h = len(lines[0]), len(lines)
    raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *p) for p in line) for line in lines)

    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)

    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)


if __name__ == '__main__':
    assert len(ICON) == 16 and all(len(r) == 16 for r in ICON)
    for size in (16, 32, 192):
        png(os.path.join(OUT, f'favicon-{size}.png'), ICON, size // 16)
    print('favicon : textures/favicon-16.png, favicon-32.png, favicon-192.png')
