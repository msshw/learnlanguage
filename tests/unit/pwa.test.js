import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

// PNG header: 8 signature bytes, then IHDR with width and height as big-endian 32-bit numbers.
const pngSize = (file) => {
  const buf = readFileSync(`public${file}`);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
};

describe('manifest', () => {
  it('has the fields Chrome needs to install the app', () => {
    expect(manifest).toMatchObject({ name: 'Vocab', short_name: 'Vocab', start_url: '/', display: 'standalone' });
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('lists 192, 512 and a maskable icon', () => {
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('points at icon files that exist with the declared size', () => {
    for (const icon of manifest.icons) expect(pngSize(icon.src)).toBe(icon.sizes);
  });
});
