import { useEffect, useRef, useState } from 'react';
import { Renderer } from '../../external/pbrt/web/src/renderer/renderer';
import type { Loaded } from '../../external/pbrt/web/src/model';
import PathView, { type Capture } from './PathView';
import { debugViews } from '../lib/session';
import { renderCameraControls } from '../lib/render-camera-controls';
import type { DebugScene } from '../../external/pbrt/web/src/renderer/debug-scene';
export default function RendererLab() {
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<Renderer | null>(null);
  const [status, setStatus] = useState('Ready to initialize WebGPU'),
    [error, setError] = useState(false),
    [spp, setSpp] = useState(0),
    [started, setStarted] = useState(false),
    [ready, setReady] = useState(false);
  const [full, setFull] = useState(false),
    [mode, setMode] = useState<'mis' | 'bsdf' | 'light'>('mis'),
    [depth, setDepth] = useState(8),
    [target, setTarget] = useState(128),
    [aov, setAov] = useState(0),
    [paused, setPaused] = useState(false),
    [exposure, setExposure] = useState(1),
    [pixel, setPixel] = useState([192, 240]),
    [sample, setSample] = useState(0),
    [capture, setCapture] = useState<Capture | null>(null),
    [busy, setBusy] = useState(false);
  const captureRequest = useRef(0);
  const [scene, setScene] = useState<DebugScene | null>(null);
  const [gpu, setGpu] = useState(''),
    [checks, setChecks] = useState(''),
    [sceneInfo, setSceneInfo] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('rl-strategy');
    if (saved === 'mis' || saved === 'bsdf' || saved === 'light') setMode(saved);
    setFull(new URLSearchParams(location.search).get('lab') === '1');
    const listener = (e: Event) => setMode((e as CustomEvent).detail);
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false);
    };
    addEventListener('rl-strategy', listener);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('rl-strategy', listener);
      removeEventListener('keydown', esc);
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('lab-open', full);
    return () => document.body.classList.remove('lab-open');
  }, [full]);
  useEffect(() => {
    if (!started || !canvas.current) return;
    setReady(false);
    setScene(null);
    setCapture(null);
    setBusy(false);
    captureRequest.current++;
    let alive = true;
    let worker: Worker | undefined;
    const r = new Renderer(
      canvas.current,
      (s, e) => {
        if (alive) {
          setStatus(s);
          setError(!!e);
        }
      },
      (s) => {
        if (alive) setSpp(s);
      },
    );
    renderer.current = r;
    if (new URLSearchParams(location.search).has('verify'))
      Object.assign(window, { __rl: r });
    void (async () => {
      try {
        await r.init();
        if (!alive) {
          r.destroy();
          return;
        }
        r.previewSize = 384;
        r.clamp = false;
        r.teachingDepth = true;
        r.maxSpp = target;
        worker = new Worker(
          new URL('../../external/pbrt/web/src/worker/load.ts', import.meta.url),
          { type: 'module' },
        );
        worker.onmessage = ({
          data,
        }: {
          data: Loaded | { type: string; message: string };
        }) => {
          void (async () => {
            if (!alive) return;
            if (data.type === 'loaded') {
              const loaded = data as Loaded;
              await r.load(loaded.metadata, loaded.buffers);
              if (!loaded.metadata.renderable)
                throw Error(loaded.metadata.diagnostics.map((d) => d.message).join('\n'));
              r.depth = depth;
              r.samplingMode = mode;
              setSceneInfo(
                `${loaded.metadata.counts.triangles ?? '—'} triangles · C++ parser / WASM`,
              );
              setScene(r.getDebugScene());
              setGpu(r.gpuName);
              setReady(true);
              setError(false);
              setStatus('Rendering Cornell Box');
            } else if (data.type === 'error')
              throw Error((data as { message: string }).message);
            else setStatus((data as { message: string }).message);
          })().catch((e) => {
            setError(true);
            setStatus(String(e));
          });
        };
        worker.onerror = (e) => {
          setError(true);
          setStatus(e.message);
        };
        worker.postMessage({
          generation: 1,
          base: new URL(import.meta.env.BASE_URL + 'runtime/', location.origin).href,
          scene: 'cornell-box',
        });
      } catch (e) {
        if (alive) {
          setError(true);
          setStatus(String(e));
        }
      }
    })();
    return () => {
      alive = false;
      captureRequest.current++;
      worker?.terminate();
      r.destroy();
      renderer.current = null;
    };
  }, [started]);
  useEffect(() => {
    const r = renderer.current;
    if (!r || !ready) return;
    captureRequest.current++;
    r.samplingMode = mode;
    r.depth = depth;
    r.aov = aov;
    r.maxSpp = target;
    r.reset();
    setPaused(false);
    setCapture(null);
    localStorage.setItem('rl-strategy', mode);
  }, [mode, depth, aov, ready]);
  useEffect(() => {
    const r = renderer.current;
    if (r) {
      r.maxSpp = target;
      if (target > spp) r.paused = false;
    }
  }, [target]);
  useEffect(() => {
    if (renderer.current) renderer.current.exposure = exposure;
  }, [exposure]);
  useEffect(() => {
    if (!ready || !canvas.current || !renderer.current) return;
    return renderCameraControls(
      canvas.current,
      renderer.current,
      (pixel) => {
        setPixel(pixel);
        setCapture(null);
      },
      () => {
        captureRequest.current++;
        setBusy(false);
        setCapture(null);
        setPaused(false);
        setError(false);
        setStatus('成像相机已移动，正在重新累积');
      },
    );
  }, [ready]);
  const captureNow = async () => {
    const r = renderer.current;
    if (!r) return;
    const request = ++captureRequest.current;
    setBusy(true);
    try {
      const result = await r.capturePath(pixel[0], pixel[1], sample);
      if (request !== captureRequest.current) return;
      setCapture(result);
      setStatus(`Captured actual GPU sample #${sample}`);
    } catch (e) {
      if (request === captureRequest.current) {
        setError(true);
        setStatus(String(e));
      }
    } finally {
      if (request === captureRequest.current) setBusy(false);
    }
  };
  return (
    <section
      id="renderer"
      className={`renderer-lab ${full ? 'lab-full' : ''}`}
      aria-label="Cornell Box WebGPU experiment"
    >
      <div className="figure-head">
        <span className="eyebrow">EXPERIMENT 02</span>
        <strong>Cornell Box</strong>
        <span className="lab-toolbar">
          <button onClick={() => setFull(!full)}>
            {full ? '↙ Return to reading' : '↗ Open full Lab'}
          </button>
        </span>
      </div>
      <div className="lab-body">
        <div className="viewport-column">
          <div className="viewport">
            <canvas
              ref={canvas}
              aria-label="Live WebGPU Cornell Box; click to select a pixel"
              tabIndex={0}
            />
            {!ready && (
              <div className="viewport-message">
                <span className="wire-cube">◇</span>
                <h3>Follow the light.</h3>
                <p>{error ? status : 'A real path tracer, running on your GPU.'}</p>
                <button
                  className="primary"
                  disabled={started && !error}
                  onClick={() => {
                    if (started) {
                      setStarted(false);
                      setTimeout(() => setStarted(true), 0);
                    } else setStarted(true);
                  }}
                >
                  {started
                    ? error
                      ? 'Retry WebGPU'
                      : 'Loading scene…'
                    : 'Start WebGPU experiment'}
                </button>
                <small>384 × 384 · original PBRT scene · no image substitute</small>
              </div>
            )}
            {ready && (
              <span
                className="pixel-marker"
                style={{
                  left: `${((pixel[0] + 0.5) / 384) * 100}%`,
                  top: `${((pixel[1] + 0.5) / 384) * 100}%`,
                }}
              />
            )}
          </div>
          <div className="render-status" role="status">
            <span className={error ? 'error' : 'live-dot'}>
              {error
                ? 'Error'
                : ready
                  ? paused || spp >= target
                    ? 'Paused'
                    : 'Accumulating'
                  : 'WebGPU'}
            </span>
            <span data-testid="spp">{spp} spp</span>
            <span>384 × 384</span>
            <button
              disabled={!ready}
              onClick={() => {
                const r = renderer.current;
                if (r) {
                  r.paused = !r.paused;
                  setPaused(r.paused);
                }
              }}
            >
              {paused || spp >= target ? 'Resume' : 'Pause'}
            </button>
            <button
              disabled={!ready}
              onClick={() => {
                renderer.current?.reset();
                setPaused(false);
                setCapture(null);
              }}
            >
              Reset
            </button>
          </div>
          <div className="camera-help">
            左键拖动旋转成像相机 · 右键／Shift 拖动平移 · 滚轮前后移动 · 单击选择像素
            <button
              disabled={!ready}
              onClick={() => {
                const r = renderer.current;
                if (!r?.metadata) return;
                r.camera = [...r.metadata.camera.transform];
                r.reset();
                captureRequest.current++;
                setBusy(false);
                setCapture(null);
                setPaused(false);
              }}
            >
              重置相机
            </button>
          </div>
        </div>
        <aside className="lab-controls">
          <div className="eyebrow">INTEGRATOR</div>
          <label>
            Scene
            <select aria-label="Scene">
              <option>Cornell Box · diffuse</option>
            </select>
          </label>
          <label>
            Sampling strategy
            <select
              aria-label="Renderer sampling strategy"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="mis">NEE + BSDF · MIS</option>
              <option value="bsdf">BSDF only · NEE off</option>
              <option value="light">Light / NEE · no MIS</option>
            </select>
          </label>
          <label>
            Maximum depth <output>{depth}</output>
            <input
              aria-label="Maximum depth"
              type="range"
              min="1"
              max="16"
              value={depth}
              onChange={(e) => setDepth(+e.target.value)}
            />
          </label>
          <label>
            Target SPP
            <select
              aria-label="Target SPP"
              value={target}
              onChange={(e) => setTarget(+e.target.value)}
            >
              {[1, 16, 64, 128, 512, 2048].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="eyebrow divider">OBSERVE</div>
          <label>
            Debug view
            <select
              aria-label="Debug view"
              value={aov}
              onChange={(e) => setAov(+e.target.value)}
            >
              {debugViews.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <p className="control-note">
            {debugViews[aov].quantity} · {debugViews[aov].space}
          </p>
          <label>
            Exposure <output>{exposure.toFixed(1)}</output>
            <input
              aria-label="Exposure"
              type="range"
              min=".1"
              max="4"
              step=".1"
              value={exposure}
              onChange={(e) => setExposure(+e.target.value)}
            />
          </label>
          <p className="control-note">
            Clamp off. RGB Lambertian benchmark. No glass or coat approximations.
          </p>
        </aside>
      </div>
      <details className="capture-panel" open={!!capture}>
        <summary>
          Path inspector <span>Click a pixel → choose a sample → replay</span>
        </summary>
        <div className="capture-actions">
          <label>
            Pixel x
            <input
              aria-label="Pixel x"
              type="number"
              min="0"
              max="383"
              value={pixel[0]}
              onChange={(e) =>
                setPixel([Math.max(0, Math.min(383, +e.target.value)), pixel[1]])
              }
            />
          </label>
          <label>
            Pixel y
            <input
              aria-label="Pixel y"
              type="number"
              min="0"
              max="383"
              value={pixel[1]}
              onChange={(e) =>
                setPixel([pixel[0], Math.max(0, Math.min(383, +e.target.value))])
              }
            />
          </label>
          <label>
            Sample index (0 based)
            <input
              aria-label="Sample index"
              type="number"
              min="0"
              max="16777215"
              value={sample}
              onChange={(e) =>
                setSample(Math.max(0, Math.min(16777215, +e.target.value)))
              }
            />
          </label>
          <button className="primary" disabled={!ready || busy} onClick={captureNow}>
            {busy ? 'Capturing…' : 'Capture GPU path'}
          </button>
        </div>
        {capture && scene && (
          <PathView
            key={`${capture.pixel}-${capture.sample}`}
            capture={capture}
            scene={scene}
          />
        )}
        <p className="control-note">
          Replay uses the current camera, seed 1 and estimator. It neither advances nor
          resets the film. Changing camera/estimator/depth invalidates the capture.
          Samples beyond current SPP are deterministic previews.
        </p>
      </details>
      <details className="diagnostics">
        <summary>Runtime & diagnostics</summary>
        <p className="mono">{status}</p>
        <p>
          {gpu} · {sceneInfo}
        </p>
        <button
          disabled={!ready}
          onClick={async () => {
            try {
              setChecks('Running GPU/CPU checks…');
              setChecks(JSON.stringify(await renderer.current!.validate()));
            } catch (e) {
              setChecks(String(e));
            }
          }}
        >
          Run GPU self-test
        </button>
        <pre>{checks}</pre>
      </details>
      <p className="lab-caption">
        02 — Original PBRT → C++ Scene IR → single-thread WASM Worker → BLAS/TLAS → WGSL
        megakernel. Same scene and physical model for every strategy. SPP is not equal
        compute time.
      </p>
    </section>
  );
}
