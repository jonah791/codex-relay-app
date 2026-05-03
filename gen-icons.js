const fs = require('fs');
const W = 256, H = 256;

function buildIcon(color) {
  const r = { green: 0, blue: 0, gray: 128 };
  const g = { green: 204, blue: 128, gray: 128 };
  const b = { green: 68, blue: 255, gray: 128 };
  const rowSize = W * 4, bmpSize = 40 + H * rowSize;
  const ico = Buffer.alloc(6);
  ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
  const ent = Buffer.alloc(16);
  ent.writeUInt8(0, 0); ent.writeUInt8(0, 1); ent.writeUInt8(0, 2); ent.writeUInt8(0, 3);
  ent.writeUInt16LE(1, 4); ent.writeUInt16LE(32, 6);
  ent.writeUInt32LE(bmpSize, 8); ent.writeUInt32LE(22, 12);

  const bmp = Buffer.alloc(bmpSize);
  bmp.writeUInt32LE(40, 0); bmp.writeInt32LE(W, 4); bmp.writeInt32LE(H * 2, 8);
  bmp.writeUInt16LE(1, 12); bmp.writeUInt16LE(32, 14); bmp.writeUInt32LE(0, 16);
  bmp.writeUInt32LE(H * rowSize, 20); bmp.writeInt32LE(2835, 24); bmp.writeInt32LE(2835, 28);
  bmp.writeUInt32LE(0, 32); bmp.writeUInt32LE(0, 36);

  const cx = W / 2, cy = H / 2, radius = 110;
  let off = 40;
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
      const inside = dist <= radius - 3;
      const edge = !inside && Math.abs(dist - radius) <= 3;
      if (inside || edge) {
        bmp.writeUInt8(b[color] || 128, off++);
        bmp.writeUInt8(g[color] || 128, off++);
        bmp.writeUInt8(r[color] || 0, off++);
        bmp.writeUInt8(255, off++);
      } else {
        bmp.writeUInt32LE(0, off); off += 4;
      }
    }
  }
  fs.writeFileSync(`build/icon-${color}.ico`, Buffer.concat([ico, ent, bmp]));
}

// Also copy existing icon as icon.ico (blue default)
buildIcon('green');
buildIcon('blue');
buildIcon('gray');
console.log('Icons generated: blue, green, gray');
