const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeIcon(size, maskable = false) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  const scale = size / 512;
  const center = (x, y, cx, cy, radius) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    rows[row] = 0;
    for (let x = 0; x < size; x += 1) {
      let rgba = [16, 16, 15, 255];
      const px = x / scale;
      const py = y / scale;
      if (!maskable && center(px, py, 256, 256, 237)) rgba = [35, 31, 27, 255];
      if (px >= 92 && px <= 420 && py >= 112 && py <= 400) {
        const border = px < 111 || px > 401 || py < 131 || py > 381;
        if (border) rgba = [215, 168, 110, 255];
      }
      if (center(px, py, 192, 256, 48) || center(px, py, 320, 256, 48)) rgba = [232, 187, 130, 255];
      if (px >= 176 && px <= 336 && py >= 232 && py <= 280) rgba = [232, 187, 130, 255];
      const index = row + 1 + x * 4;
      rows[index] = rgba[0]; rows[index + 1] = rgba[1]; rows[index + 2] = rgba[2]; rows[index + 3] = rgba[3];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join('public', 'icons', `icon${maskable ? '-maskable' : ''}-${size}.png`), png);
}

makeIcon(192);
makeIcon(512);
makeIcon(512, true);
