import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debugScene } from '../external/pbrt/web/src/renderer/debug-scene.ts';

test('debug mesh applies the same placement transforms, IDs and orientation as GPU layout v2', () => {
  const vertices = new Float32Array(36);
  vertices.set([1, 0, 0], 12);
  vertices.set([0, 1, 0], 24);
  const primitives = new Uint32Array([0, 1, 2, 7]);
  const records = new Uint32Array(112),
    floats = new Float32Array(records.buffer);
  records[0] = 2;
  records[2] = 16;
  records[3] = 1;
  records[4] = 32;
  records[5] = 2;
  floats.set([0.2, 0.3, 0.4], 16);
  for (const b of [32, 72]) {
    floats.set([1, 0, 0, 2, 0, 1, 0, 3, 0, 0, 1, 4], b);
    records[b + 37] = 0;
    records[b + 38] = 7;
  }
  records[72 + 39] = 1; // ReverseOrientation: swap b and c just like geometric().
  const scene = debugScene([
    vertices.buffer,
    primitives.buffer,
    new ArrayBuffer(0),
    records.buffer,
  ]);
  assert.equal(scene.meshes.length, 2);
  assert.deepEqual([...scene.meshes[0].positions], [2, 3, 4, 3, 3, 4, 2, 4, 4]);
  assert.deepEqual([...scene.meshes[1].positions], [2, 3, 4, 2, 4, 4, 3, 3, 4]);
  assert.equal(scene.meshes[1].placement, 1);
  assert.equal(scene.meshes[0].material, 0);
  assert.ok(Math.abs(scene.meshes[0].color[0] - 0.2) < 1e-7);
  assert.deepEqual(scene.bounds, { min: [2, 3, 4], max: [3, 4, 4] });
  assert.deepEqual([...vertices.slice(12, 15)], [1, 0, 0]);
});
