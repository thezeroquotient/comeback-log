# Draws the app icon (a red competition plate on rubber-mat grey) as PNGs, no libraries needed.
import struct, zlib

BG, RED, HUB = (18, 20, 24), (200, 16, 46), (236, 238, 241)

def png(path, size):
    c = size / 2
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            # 4× supersampling for smooth edges
            total = [0, 0, 0]
            for sx in (.125, .375, .625, .875):
                for sy in (.125, .375, .625, .875):
                    r = (((x + sx - c) ** 2 + (y + sy - c) ** 2) ** .5) / size
                    col = BG
                    if r < .36: col = RED
                    if .30 < r < .31: col = BG
                    if r < .10: col = HUB
                    if r < .045: col = BG
                    for i in range(3): total[i] += col[i]
            row += bytes(t // 16 for t in total)
        rows.append(bytes(row))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

png('icon-192.png', 192)
png('icon-512.png', 512)
png('apple-touch-icon.png', 180)
