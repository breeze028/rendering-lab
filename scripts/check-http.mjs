import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = new URL(process.argv[2] || 'http://127.0.0.1:4321/rendering-lab/');
const checked = new Set();
async function get(path, type) {
  const url = new URL(path, base);
  assert.ok(url.pathname.startsWith(base.pathname), `Escaped base: ${url}`);
  const r = await fetch(url);
  assert.equal(r.status, 200, url.href);
  if (type) assert.match(r.headers.get('content-type') || '', type, url.href);
  checked.add(url.href);
  return r;
}
for (const page of [
  '',
  'learn/monte-carlo/',
  'learn/next-event-estimation/',
  'roadmap/',
  'lab/',
]) {
  const html = await (await get(page, /text\/html/)).text();
  for (const match of html.matchAll(
    /(?:src|href|component-url|renderer-url)="([^"]+)"/g,
  )) {
    const value = match[1];
    if (value.startsWith('#') || /^(https:|data:)/.test(value)) continue;
    const resolved = new URL(value, new URL(page, base));
    if (!checked.has(resolved.href)) await get(resolved.href);
  }
}
const wasm = await (
  await get('runtime/wasm/pbrt4_wasm.wasm', /application\/wasm/)
).arrayBuffer();
assert.deepEqual([...new Uint8Array(wasm, 0, 4)], [0, 97, 115, 109]);
await WebAssembly.compile(wasm);
await get('runtime/wasm/pbrt4_wasm.mjs', /(javascript|ecmascript)/);
const manifest = await (
    await get('runtime/scenes/cornell-box/manifest.json', /json/)
  ).json(),
  bytes = Buffer.from(
    await (await get('runtime/scenes/cornell-box/resources.bin')).arrayBuffer(),
  );
assert.equal(bytes.length, manifest.bytes);
for (const f of manifest.files)
  assert.equal(
    createHash('sha256')
      .update(bytes.subarray(f.offset, f.offset + f.size))
      .digest('hex'),
    f.sha256,
    f.path,
  );
assert.ok(manifest.files.some((f) => /license/i.test(f.path)));
console.log(
  `PASS ${checked.size} URLs; WASM MIME/magic/compile; ${manifest.files.length} original resources + licenses SHA256.`,
);
