import { useMemo, useState } from 'react';
import { estimate, model, strategies, type Strategy } from '../lib/sampling';
const names = {
  uniform: '均匀',
  cosine: '余弦',
  bsdf: 'BSDF',
  light: '光源',
  mis: 'MIS',
};
const colors = {
  uniform: '#9299a5',
  cosine: '#b6a0d7',
  bsdf: '#9abdaa',
  light: '#e0b76e',
  mis: '#85b6d1',
};
export default function SamplingLab() {
  const [rough, setRough] = useState(0.16),
    [size, setSize] = useState(0.25),
    [count, setCount] = useState(256),
    [strategy, setStrategy] = useState<Strategy>('mis'),
    [seed, setSeed] = useState(7);
  const data = useMemo(
    () => estimate(rough, size, strategy, count, seed),
    [rough, size, strategy, count, seed],
  );
  const paths = useMemo(() => {
    const m = model(rough, size);
    return strategies.map((s) => ({
      s,
      pts: Array.from({ length: 401 }, (_, i) => {
        const x = i / 400;
        return [48 + x * 646, 216 - Math.min(12, m.pdf(s, x)) * 15];
      }),
    }));
  }, [rough, size]);
  return (
    <figure className="interactive" aria-label="Interactive sampling experiment">
      <div className="figure-head">
        <span className="eyebrow">实验 01</span>
        <span>应该在哪里采样？</span>
        <span className="live-dot">可交互</span>
      </div>
      <div className="segmented">
        {strategies.map((s) => (
          <button
            key={s}
            aria-pressed={s === strategy}
            onClick={() => {
              setStrategy(s);
              if (s === 'bsdf' || s === 'light' || s === 'mis') {
                localStorage.setItem('rl-strategy', s);
                dispatchEvent(new CustomEvent('rl-strategy', { detail: s }));
              }
            }}
          >
            {names[s]}
          </button>
        ))}
      </div>
      <svg
        className="pdf-chart"
        viewBox="0 0 740 260"
        role="img"
        aria-label="Normalized sampling probability densities"
      >
        {[0, 3, 6, 9, 12].map((v) => (
          <g key={v}>
            <line
              x1="48"
              x2="694"
              y1={216 - v * 15}
              y2={216 - v * 15}
              stroke="#30343a"
              strokeDasharray="3 6"
            />
            <text x="34" y={220 - v * 15} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <rect
          x={48 + data.lo * 646}
          y="30"
          width={(data.hi - data.lo) * 646}
          height="186"
          fill="#e0b76e"
          opacity=".045"
        />
        {paths
          .filter((p) => p.s !== 'mis')
          .map(({ s, pts }) => (
            <path
              key={s}
              d={pts.map((p, i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ')}
              fill="none"
              stroke={colors[s]}
              strokeWidth={strategy === s ? 2.8 : 1.5}
              opacity={strategy === s || strategy === 'mis' ? 1 : 0.35}
            />
          ))}
        {data.samples.slice(0, 96).map((p, i) => (
          <line
            key={i}
            x1={48 + p.x * 646}
            x2={48 + p.x * 646}
            y1="225"
            y2="232"
            stroke={colors[strategy]}
            opacity=".55"
          />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={48 + v * 646} y="250" textAnchor="middle">
            {v === 0 ? '0' : v === 1 ? 'π/2' : `${v} × π/2`}
          </text>
        ))}
        <text x="48" y="20">
          p(x)
        </text>
        <text x="695" y="20" textAnchor="end">
          x = θ / (π/2)
        </text>
      </svg>
      <div className="legend">
        {strategies
          .filter((s) => s !== 'mis')
          .map((s) => (
            <span key={s}>
              <i style={{ background: colors[s] }} />
              {names[s]}
            </span>
          ))}
        <span>PDF 纵轴截断于 12</span>
      </div>
      <div className="sliders">
        <label>
          BSDF 波瓣宽度 <output>{rough.toFixed(2)}</output>
          <input
            aria-label="BSDF lobe width"
            type="range"
            min=".03"
            max=".5"
            step=".01"
            value={rough}
            onChange={(e) => setRough(+e.target.value)}
          />
        </label>
        <label>
          光源角宽 <output>{size.toFixed(2)}</output>
          <input
            aria-label="Light angular width"
            type="range"
            min=".03"
            max=".6"
            step=".01"
            value={size}
            onChange={(e) => setSize(+e.target.value)}
          />
        </label>
        <label>
          总采样次数 <output>{count}</output>
          <input
            aria-label="Sample count"
            type="range"
            min="32"
            max="2048"
            step="32"
            value={count}
            onChange={(e) => setCount(+e.target.value)}
          />
        </label>
      </div>
      <div className="estimate">
        <span>
          积分估计 <b data-testid="estimate">{data.value.toFixed(5)}</b>
        </span>
        <span>
          数值积分参考 <b>{data.reference.toFixed(5)}</b>
        </span>
        <span>
          绝对误差 <b>{Math.abs(data.value - data.reference).toFixed(5)}</b>
        </span>
        <button onClick={() => setSeed(seed + 1)}>重新采样 ↻</button>
      </div>
      <details>
        <summary>收敛曲线与样本贡献</summary>
        <svg
          viewBox="0 0 740 150"
          role="img"
          aria-label="Running estimate versus numerical reference"
        >
          <line x1="40" x2="700" y1="80" y2="80" stroke="#e0b76e" strokeDasharray="5 4" />
          <path
            d={data.samples
              .map(
                (v, i) =>
                  `${i ? 'L' : 'M'}${40 + (i / (count - 1)) * 660},${Math.max(10, Math.min(140, 80 - (v.mean - data.reference) * 90))}`,
              )
              .join(' ')}
            fill="none"
            stroke="#9abdaa"
            strokeWidth="1.5"
          />
          <text x="45" y="145">
            1 → {count} 次采样 · 虚线：数值积分 · 纵轴：参考值 ± 0.78（截断）
          </text>
        </svg>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>样本序号</th>
                <th>x</th>
                <th>加权 f/p</th>
                <th>累积均值</th>
              </tr>
            </thead>
            <tbody>
              {data.samples.slice(0, 8).map((v, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{v.x.toFixed(5)}</td>
                  <td>{v.value.toFixed(5)}</td>
                  <td>{v.mean.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <figcaption>
        01 — CPU 上计算的一维概率模型：Cauchy 波瓣 × 余弦 × 矩形光源，并非 Cornell
        场景的截面。MIS 每次随机选择一种策略，并使用幂启发式权重。选择 BSDF／光源／MIS
        也会同步切换渲染实验的采样策略。
      </figcaption>
    </figure>
  );
}
