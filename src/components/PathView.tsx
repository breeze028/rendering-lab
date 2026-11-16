import { useEffect, useRef, useState } from 'react';
import type { DebugScene } from '../../external/pbrt/web/src/renderer/debug-scene';
import type { PathSceneView } from '../lib/path-scene-view';
export type Capture = {
  pixel: number[];
  sample: number;
  radiance: number[];
  vertices: number[][];
  camera: number[];
  truncated: boolean;
  fov?: number;
};
const fmt = (v: number[]) =>
  v.map((x) => (Number.isFinite(x) ? x.toFixed(4) : String(x))).join(', ');
export default function PathView({
  capture,
  scene,
}: {
  capture: Capture;
  scene: DebugScene;
}) {
  const [selected, setSelected] = useState(0);
  const [cutaway, setCutaway] = useState(true);
  const [nee, setNee] = useState(true);
  const [xray, setXray] = useState(true);
  const [viewReady, setViewReady] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<PathSceneView | null>(null);
  const vertices = capture.vertices;
  const v = vertices[Math.min(selected, vertices.length - 1)];
  useEffect(() => {
    let alive = true;
    setViewReady(false);
    setViewerError('');
    void import('../lib/path-scene-view')
      .then(({ PathSceneView }) => {
        if (!alive || !host.current) return;
        viewer.current = new PathSceneView(host.current, scene, capture, setSelected);
        setViewReady(true);
      })
      .catch((error) => {
        if (alive) setViewerError(String(error));
      });
    return () => {
      alive = false;
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [scene, capture]);
  useEffect(() => {
    viewer.current?.select(selected);
  }, [selected, viewReady]);
  useEffect(() => {
    viewer.current?.options(cutaway, nee, xray);
  }, [cutaway, nee, xray, viewReady]);
  return (
    <div className="path-inspector">
      <div className="path-scene-column">
        <div className="eyebrow">原场景 · 世界空间路径 · 独立调试相机</div>
        <div ref={host} className="path-scene-viewport" data-ready={viewReady}>
          {!viewReady && (
            <span className="path-scene-message">
              {viewerError || '正在创建三维场景视图…'}
            </span>
          )}
        </div>
        <div className="path-scene-tools">
          <button disabled={!viewReady} onClick={() => viewer.current?.reset()}>
            回到捕获视角
          </button>
          <button disabled={!viewReady} onClick={() => viewer.current?.fit()}>
            查看全场景
          </button>
          <button
            disabled={!viewReady || !vertices.length}
            onClick={() => viewer.current?.focus(selected)}
          >
            聚焦选中顶点
          </button>
        </div>
        <div className="path-scene-options">
          <label>
            <input
              type="checkbox"
              checked={cutaway}
              onChange={(e) => setCutaway(e.target.checked)}
            />
            剖视（隐藏背面）
          </label>
          <label>
            <input
              type="checkbox"
              checked={nee}
              onChange={(e) => setNee(e.target.checked)}
            />
            NEE 连接
          </label>
          <label>
            <input
              type="checkbox"
              checked={xray}
              onChange={(e) => setXray(e.target.checked)}
            />
            遮挡路径虚线
          </label>
        </div>
        <small>
          左键拖动旋转 · 右键／Shift 拖动平移 ·
          滚轮缩放。可点击顶点选中。绿色实线为路径，暗绿虚线穿透遮挡；金色／红色虚线为可见／被遮挡的
          NEE 连接，蓝点为成像相机。
        </small>
        <small>
          场景几何和颜色来自同一份已加载的 GPU
          场景数据；此处为诊断用光栅视图，不是另一份路径追踪结果。调试视角不会改变成像相机、样本或累积。
        </small>
      </div>
      <div>
        <p className="mono">
          Pixel ({capture.pixel.join(', ')}) · sample #{capture.sample} ·{' '}
          {vertices.length} vertices
        </p>
        <label>
          Vertex{' '}
          <select value={selected} onChange={(e) => setSelected(+e.target.value)}>
            {vertices.map((_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        {v ? (
          <dl className="vertex-data">
            {[
              ['Position / world', fmt(v.slice(0, 3))],
              ['Material / placement', `${v[3]} / ${v[46]}`],
              ['Incoming / world', fmt(v.slice(12, 15))],
              ['Outgoing / world', fmt(v.slice(20, 23))],
              ['Geometric normal', fmt(v.slice(4, 7))],
              ['Shading normal', fmt(v.slice(8, 11))],
              ['Throughput at entry', fmt(v.slice(16, 19))],
              ['BSDF value / local', fmt(v.slice(24, 27))],
              ['Forward PDF / sr⁻¹', fmt([v[23]])],
              ['NEE PDF / sr⁻¹', fmt([v[31]])],
              ['NEE MIS weight', fmt([v[35]])],
              ['NEE contribution / RGB', fmt(v.slice(32, 35))],
              ['RR survival / terminated', `${v[39].toFixed(4)} / ${v[47] === 1}`],
            ].map(([k, value]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Ray escaped without a surface vertex.</p>
        )}
        <p className="mono">Sample RGB: {fmt(capture.radiance)}</p>
        {capture.truncated && <p>Capture capped at 64 vertices; tracing continues.</p>}
        <small>
          Zero fields can mean an event was not evaluated (emitter, termination, no valid
          NEE). Delta BSDF values are not continuous densities. See capture schema in
          docs.
        </small>
      </div>
    </div>
  );
}
