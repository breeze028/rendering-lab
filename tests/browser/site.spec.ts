import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
test('course math, real GPU rendering, AOVs, deterministic path and film preservation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('?verify=1');
  await page.waitForFunction(
    () => document.querySelectorAll('astro-island[ssr]').length === 0,
  );
  await expect(page.locator('h1')).toHaveText('多重重要性采样');
  await expect(page.locator('.katex-display').first()).toBeVisible();
  await expect(page.locator('pre.astro-code').first()).toContainText('fn power');
  const before = await page.getByTestId('estimate').textContent();
  await page.getByRole('slider', { name: 'BSDF lobe width' }).fill('.3');
  await expect(page.getByTestId('estimate')).not.toHaveText(before!);
  await page.getByRole('button', { name: 'Start WebGPU experiment' }).click();
  await expect(page.getByTestId('spp')).not.toHaveText('0 spp', { timeout: 90000 });
  await page.waitForFunction(() => Boolean((window as any).__rl?.sample >= 16));
  const first = await page.evaluate(async () => {
    const r = (window as any).__rl;
    r.paused = true;
    const hdr = await r.readHdr();
    const c = await r.capturePath(192, 240, 0),
      d = await r.capturePath(192, 240, 0);
    return {
      spp: r.sample,
      pixels: Array.from(hdr.rgb as Float32Array),
      capture: c,
      repeat: d,
      gpu: r.gpuName,
    };
  });
  expect(first.pixels.every(Number.isFinite)).toBe(true);
  expect(Math.max(...first.pixels.slice(0, 10000))).toBeGreaterThan(0);
  expect(first.capture.vertices.length).toBeGreaterThan(0);
  expect(first.capture).toEqual(first.repeat);
  await page.getByRole('button', { name: 'Open full Lab' }).click();
  expect(await page.evaluate(() => (window as any).__rl.sample)).toBe(first.spp);
  await page.getByRole('button', { name: 'Return to reading' }).click();
  expect(await page.evaluate(() => (window as any).__rl.sample)).toBe(first.spp);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  const gpu = await page.evaluate(async () => {
    const r = (window as any).__rl;
    r.previewSize = 128;
    r.resize(128);
    r.depth = 6;
    r.clamp = false;
    r.aov = 0;
    r.maxSpp = 128;
    const wait = () =>
      new Promise<void>((resolve) => {
        const f = () => (r.sample >= r.maxSpp ? resolve() : setTimeout(f, 20));
        f();
      });
    const values: any = {};
    for (const mode of ['bsdf', 'light', 'mis']) {
      r.samplingMode = mode;
      r.reset();
      await wait();
      const hdr = await r.readHdr();
      values[mode] = {
        mean:
          Array.from(hdr.rgb as Float32Array).reduce((a, b) => a + b, 0) / hdr.rgb.length,
        spp: r.sample,
      };
    }
    return { values, checks: await r.validate() };
  });
  for (const v of Object.values(gpu.values) as any[]) expect(v.mean).toBeGreaterThan(0);
  await page.evaluate(() => {
    const r = (window as any).__rl;
    r.resize(384);
    r.maxSpp = 128;
  });
  expect(gpu.checks.diagnostics).toEqual([0, 0, 0, 0]);
  for (let view = 1; view <= 7; view++) {
    await page.getByLabel('Debug view', { exact: true }).selectOption(String(view));
    await page.waitForFunction(() => (window as any).__rl.sample >= 1);
    await page.evaluate(() => ((window as any).__rl.paused = true));
    const hdr = await page.evaluate(async () =>
      Array.from((await (window as any).__rl.readHdr()).rgb as Float32Array),
    );
    expect(hdr.every((x) => Number.isFinite(x) && x >= 0 && x <= 1)).toBe(true);
  }
  await page.getByLabel('Debug view', { exact: true }).selectOption('0');
  await page.waitForFunction(() => (window as any).__rl.sample >= 1);
  await page.locator('.capture-panel summary').click();
  await page.getByRole('button', { name: 'Capture GPU path' }).click();
  await expect(page.locator('.path-inspector')).toBeVisible();
  await expect(page.locator('.path-scene-viewport')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.screenshot({ path: 'test-results/path-inspector.png', fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify({
      adapter: first.gpu,
      strategies: gpu.values,
      gpuChecks: gpu.checks,
      capturedVertices: first.capture.vertices.length,
    }),
  );
});

test('mouse camera, world-space scene path and independent debug camera', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('?verify=1');
  await page.waitForFunction(
    () => document.querySelectorAll('astro-island[ssr]').length === 0,
  );
  await page.getByRole('button', { name: 'Start WebGPU experiment' }).click();
  await page.waitForFunction(() => Boolean((window as any).__rl?.sample));
  await page.getByRole('button', { name: 'Open full Lab' }).click();
  const film = page.locator('.viewport canvas');
  await film.scrollIntoViewIfNeeded();
  const rect = (await film.boundingBox())!;
  const original = await page.evaluate(() => {
    const r = (window as any).__rl;
    r.paused = true;
    return { camera: [...r.camera], serial: r.serial };
  });
  await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.5 + 45, rect.y + rect.height * 0.5 + 18, {
    steps: 8,
  });
  await page.mouse.up();
  const moved = await page.evaluate(() => {
    const r = (window as any).__rl;
    return { camera: [...r.camera], serial: r.serial };
  });
  expect(moved.camera).not.toEqual(original.camera);
  expect(moved.serial).toBeGreaterThan(original.serial);
  await page.mouse.wheel(0, -100);
  await expect
    .poll(() => page.evaluate(() => (window as any).__rl.camera))
    .not.toEqual(moved.camera);
  await page.getByRole('button', { name: '重置相机', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__rl.camera)).toEqual(original.camera);
  await page.waitForFunction(() => (window as any).__rl.sample >= 8);
  await page.evaluate(() => {
    (window as any).__rl.paused = true;
  });
  await film.click({ position: { x: rect.width * 0.6, y: rect.height * 0.6 } });
  expect(await page.evaluate(() => (window as any).__rl.camera)).toEqual(original.camera);
  await page.locator('.capture-panel summary').click();
  await page.getByLabel('Pixel x', { exact: true }).fill('312');
  await page.getByLabel('Pixel y', { exact: true }).fill('276');
  await page.getByRole('button', { name: 'Capture GPU path' }).click();
  await expect(page.locator('.path-scene-viewport')).toHaveAttribute(
    'data-ready',
    'true',
  );
  const stable = await page.evaluate(async () => {
    const r = (window as any).__rl,
      hdr = await r.readHdr(),
      scene = r.getDebugScene();
    return {
      camera: [...r.camera],
      spp: r.sample,
      serial: r.serial,
      film: [...hdr.rgb],
      meshes: scene.meshes.length,
      triangles: scene.meshes.reduce(
        (n: number, m: any) => n + m.positions.length / 9,
        0,
      ),
    };
  });
  expect(stable.meshes).toBe(8);
  expect(stable.triangles).toBe(36);
  await page.getByRole('button', { name: '查看全场景' }).click();
  const debug = page.getByLabel('场景中的三维采样路径');
  await debug.scrollIntoViewIfNeeded();
  const before = await debug.screenshot();
  const d = (await debug.boundingBox())!;
  await page.mouse.move(d.x + d.width * 0.5, d.y + d.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(d.x + d.width * 0.5 + 95, d.y + d.height * 0.5 + 40, {
    steps: 12,
  });
  await page.mouse.up();
  const after = await debug.screenshot();
  expect(after.equals(before)).toBe(false);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(d.x + d.width * 0.5 + 120, d.y + d.height * 0.5 + 25, {
    steps: 5,
  });
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel(0, -120);
  await page.getByRole('button', { name: '聚焦选中顶点' }).click();
  const final = await page.evaluate(async () => {
    const r = (window as any).__rl;
    return {
      camera: [...r.camera],
      spp: r.sample,
      serial: r.serial,
      film: [...(await r.readHdr()).rgb],
    };
  });
  expect(final).toEqual({
    camera: stable.camera,
    spp: stable.spp,
    serial: stable.serial,
    film: stable.film,
  });
  await page.getByRole('button', { name: '查看全场景' }).click();
  await debug.screenshot({ path: 'test-results/scene-path.png' });
  await page.getByRole('button', { name: '回到捕获视角' }).click();
  await debug.screenshot({ path: 'test-results/scene-path-camera.png' });
  await page.getByRole('checkbox', { name: 'NEE 连接' }).uncheck();
  await page.getByRole('checkbox', { name: '遮挡路径虚线' }).uncheck();
  await page.getByRole('checkbox', { name: '剖视（隐藏背面）' }).uncheck();
  // Moving the rendering camera invalidates the old capture and releases the viewer.
  await film.scrollIntoViewIfNeeded();
  await film.hover();
  await page.mouse.wheel(0, 80);
  await expect(page.locator('.path-inspector')).toHaveCount(0);
  await page.getByRole('button', { name: '重置相机', exact: true }).click();
  expect(errors).toEqual([]);
  console.log(
    'Scene-path: 8 placements / 36 triangles; debug mouse gestures preserve exact linear film.',
  );
});
test('runtime baseline parity and capture equals the actual single film sample', async ({
  page,
}) => {
  const baseline = ['pathtrace', 'bsdf', 'textures', 'integrator']
    .map((name) =>
      execFileSync(
        'git',
        ['show', `551334a7bae833db733c542879288b89bf7b6085:web/src/shaders/${name}.wgsl`],
        { cwd: 'external/pbrt', encoding: 'utf8' },
      ),
    )
    .join('\n');
  await page.goto('?verify=1');
  await page.waitForFunction(
    () => document.querySelectorAll('astro-island[ssr]').length === 0,
  );
  await page.getByRole('button', { name: 'Start WebGPU experiment' }).click();
  await page.waitForFunction(() => Boolean((window as any).__rl?.sample));
  const result = await page.evaluate(async (source) => {
    const r = (window as any).__rl;
    r.teachingDepth = false;
    r.samplingMode = 'mis';
    r.clamp = true;
    r.maxSpp = 1;
    r.depth = 8;
    r.resize(128);
    await new Promise<void>((resolve) => {
      const f = () => (r.sample >= 1 ? resolve() : setTimeout(f, 10));
      f();
    });
    r.paused = true;
    const hdr = await r.readHdr(),
      capture = await r.capturePath(64, 80, 0),
      d = r.device,
      size = 128 * 128 * 16;
    const output = d.createBuffer({
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
      readback = d.createBuffer({
        size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
    const uniform = d.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      bytes = r.frameBytes();
    new Uint32Array(bytes)[18] = 0;
    d.queue.writeBuffer(uniform, 0, bytes);
    const module = d.createShaderModule({ code: source });
    const layout = d.createPipelineLayout({
      bindGroupLayouts: [r.compute.getBindGroupLayout(0), r.textureLayout],
    });
    const pipeline = await d.createComputePipelineAsync({
      layout,
      compute: { module, entryPoint: 'main' },
    });
    const group = d.createBindGroup({
      layout: r.compute.getBindGroupLayout(0),
      entries: [
        uniform,
        r.sceneGPU[2],
        r.sceneGPU[0],
        r.sceneGPU[1],
        r.sceneGPU[3],
        output,
        r.diagnostics,
        r.captureBuffer,
      ].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
    const encoder = d.createCommandEncoder(),
      pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, group);
    pass.setBindGroup(1, r.textureGroup);
    pass.dispatchWorkgroups(16, 16);
    pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, size);
    d.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const old = new Float32Array(readback.getMappedRange());
    let maxError = 0;
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++)
        for (let c = 0; c < 3; c++)
          maxError = Math.max(
            maxError,
            Math.abs(old[(y * 128 + x) * 4 + c] - hdr.rgb[((127 - y) * 128 + x) * 3 + c]),
          );
    const index = ((127 - 80) * 128 + 64) * 3,
      film = Array.from(hdr.rgb.slice(index, index + 3)) as number[];
    output.destroy();
    readback.destroy();
    uniform.destroy();
    return { maxError, film, replayed: capture.radiance, spp: r.sample };
  }, baseline);
  expect(result.maxError).toBeLessThan(1e-5);
  expect(result.spp).toBe(1);
  for (let c = 0; c < 3; c++)
    expect(Math.abs(result.film[c] - result.replayed[c])).toBeLessThan(1e-6);
  console.log('Baseline/capture verification', JSON.stringify(result));
});
test('mobile reading, chapter navigation and no-WebGPU fallback', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await context.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'gpu', { value: undefined }),
  );
  await page.goto('');
  await page.waitForFunction(
    () => document.querySelectorAll('astro-island[ssr]').length === 0,
  );
  await page.locator('.course-sidebar summary').click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Start WebGPU experiment' }).click();
  await expect(page.locator('.viewport-message')).toContainText('WebGPU is unavailable');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.goto('learn/monte-carlo/');
  await expect(page.locator('h1')).toHaveText('用随机样本估计积分');
  await page.getByRole('link', { name: '下一事件估计', exact: true }).first().click();
  await expect(page.locator('h1')).toHaveText('下一事件估计');
  await context.close();
});
