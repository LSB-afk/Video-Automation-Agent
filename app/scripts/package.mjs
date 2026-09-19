import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import './build.mjs';

const root = new URL('../', import.meta.url);

// Standard stored ZIP records: no platform-specific archiver or runtime package.
// Fixed 1980-01-01 timestamps and ordered names make release builds reproducible.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, bytes] of files) {
    const filename = Buffer.from(name, 'utf8');
    const checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, bytes);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(0x21, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

await rm(new URL('.artifacts/release/', root), { recursive: true, force: true });
await mkdir(new URL('.artifacts/release/', root), { recursive: true });
for (const browser of ['chromium', 'firefox']) {
  const files = await Promise.all(['LICENSE', 'content.js', 'manifest.json'].map(async (name) => [
    name, await readFile(new URL(`.artifacts/dist/${browser}/${name}`, root)),
  ]));
  await writeFile(new URL(`.artifacts/release/video-automation-agent-${browser}.zip`, root), zip(files));
}
await copyFile(new URL('.artifacts/dist/video-automation-agent.user.js', root), new URL('.artifacts/release/video-automation-agent.user.js', root));
console.log('Packaged .artifacts/release/ with installable root manifests and deterministic ZIP files.');
