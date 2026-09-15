import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

// ─── Constants ───────────────────────────────────────────────────────────────
const G = 32.2; // ft/s² gravity
const COLOR_FAIL  = '#f43f5e';
const COLOR_WARN  = '#f59e0b';
const COLOR_SAFE  = '#10b981';
const COLOR_CRIT  = '#a78bfa';
const COLOR_SUPER = '#f97316';
const COLOR_SUB   = '#38bdf8';

const MANNING_PRESETS = [
  { label: 'Glass/PVC',  n: 0.010, icon: '🔬' },
  { label: 'Concrete',   n: 0.013, icon: '🏗️' },
  { label: 'Lined Earth', n: 0.020, icon: '🌿' },
  { label: 'Riprap',     n: 0.035, icon: '🪨' },
  { label: 'Natural',    n: 0.045, icon: '🌊' },
];

const CHANNEL_TYPES = [
  { key: 'rectangular', label: 'Rectangular', icon: '▬', z: 0 },
  { key: 'trapezoidal', label: 'Trapezoidal', icon: '⬡', z: 1.5 },
  { key: 'triangular',  label: 'Triangular',  icon: '△', z: 2.0 },
];

// ─── Hydraulic Geometry Helpers ───────────────────────────────────────────────
function channelGeometry(y, b, z) {
  if (y <= 0) return { A: 0, P: 0, R: 0, T: b, Dh: 0 };
  const A = (b + z * y) * y;
  const P = b + 2 * y * Math.sqrt(1 + z * z);
  const R = A / Math.max(P, 0.001);
  const T = b + 2 * z * y;
  const Dh = A / Math.max(T, 0.001);
  return { A, P, R, T, Dh };
}

function manningsQ(y, b, z, n, S0) {
  const { A, R } = channelGeometry(y, b, z);
  if (A <= 0 || R <= 0) return 0;
  return (1.49 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S0);
}

// Bisection solver for normal depth (Manning's)
function solveNormalDepth(Q, b, z, n, S0) {
  if (Q <= 0 || S0 <= 0 || n <= 0) return 0;
  let lo = 0.01, hi = 30.0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (manningsQ(mid, b, z, n, S0) < Q) lo = mid;
    else hi = mid;
    if (hi - lo < 0.0001) break;
  }
  return (lo + hi) / 2;
}

// Bisection solver for critical depth (Q²T = gA³)
function solveCriticalDepth(Q, b, z) {
  if (Q <= 0) return 0;
  const criterion = (y) => {
    const { A, T } = channelGeometry(y, b, z);
    return Q * Q * T - G * Math.pow(A, 3);
  };
  let lo = 0.01, hi = 30.0;
  if (criterion(lo) * criterion(hi) > 0) return 0.5; // fallback
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (criterion(mid) > 0) hi = mid; else lo = mid;
    if (hi - lo < 0.0001) break;
  }
  return (lo + hi) / 2;
}

// Hydraulic jump conjugate depth (momentum function, works for all shapes)
function conjugateDepth(y1, Q, b, z) {
  if (y1 <= 0 || Q <= 0) return { y2: y1, dE: 0 };
  const { A: A1, T: T1 } = channelGeometry(y1, b, z);
  const V1 = Q / Math.max(A1, 0.001);
  const Fr1 = V1 / Math.sqrt(G * Math.max(A1 / Math.max(T1, 0.001), 0.001));

  // For rectangular channels use closed-form
  if (z === 0) {
    const y2 = (y1 / 2) * (-1 + Math.sqrt(1 + 8 * Fr1 * Fr1));
    const E1 = y1 + V1 * V1 / (2 * G);
    const V2 = Q / (b * y2);
    const E2 = y2 + V2 * V2 / (2 * G);
    const dE = Math.max(0, E1 - E2);
    return { y2, dE, Fr1, E1, E2 };
  }

  // For non-rectangular: momentum function M = Q²/(gA) + A*ȳ where ȳ = centroid depth
  const centroidDepth = (y) => {
    const { A } = channelGeometry(y, b, z);
    // centroid of trapezoid from bottom: ȳ = (b*y/2 + z*y²/3*2) / A
    const ybar = (b * y * y / 2 + z * y * y * y / 3) / Math.max(A, 0.001);
    return { A, ybar };
  };
  const M = (y) => {
    const { A, ybar } = centroidDepth(y);
    return (Q * Q) / (G * Math.max(A, 0.001)) + A * ybar;
  };
  const M1 = M(y1);
  // Find y2 > yc where M(y2) = M1
  let lo = y1, hi = 20.0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (M(mid) > M1) hi = mid; else lo = mid;
    if (hi - lo < 0.0001) break;
  }
  const y2 = (lo + hi) / 2;
  const { A: A2 } = channelGeometry(y2, b, z);
  const V2 = Q / Math.max(A2, 0.001);
  const E1 = y1 + V1 * V1 / (2 * G);
  const E2 = y2 + V2 * V2 / (2 * G);
  return { y2, dE: Math.max(0, E1 - E2), Fr1, E1, E2 };
}

// Specific energy
function specificEnergy(y, Q, b, z) {
  if (y <= 0) return y;
  const { A } = channelGeometry(y, b, z);
  const V = Q / Math.max(A, 0.001);
  return y + V * V / (2 * G);
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ChannelHydraulicsVisualizer = ({ problem }) => {
  const [channelType, setChannelType] = useState(problem?.channelType || 'trapezoidal');
  const [Q, setQ] = useState(problem?.Q ?? 120);
  const [b, setB] = useState(problem?.bottomWidth ?? 8);
  const [z, setZ] = useState(problem?.sideSlope ?? 1.5);
  const [n, setN] = useState(problem?.manningN ?? 0.013);
  const [S0, setS0] = useState(problem?.slope ?? 0.0003);
  const [y1, setY1] = useState(problem?.upstreamDepth ?? 3.0);
  const [viewMode, setViewMode] = useState('profile');
  const [showDerivation, setShowDerivation] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const animRef = useRef(null);

  // Sync with problem changes
  const [prevProblem, setPrevProblem] = useState(problem);
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.channelType) setChannelType(problem.channelType);
    if (problem.Q !== undefined) setQ(problem.Q);
    if (problem.bottomWidth !== undefined) setB(problem.bottomWidth);
    if (problem.sideSlope !== undefined) setZ(problem.sideSlope);
    if (problem.manningN !== undefined) setN(problem.manningN);
    if (problem.slope !== undefined) setS0(problem.slope);
    if (problem.upstreamDepth !== undefined) setY1(problem.upstreamDepth);
  }

  // Animation loop for flow arrows
  useEffect(() => {
    animRef.current = setInterval(() => setAnimFrame(f => (f + 1) % 60), 80);
    return () => clearInterval(animRef.current);
  }, []);

  // Lock z to 0 for rectangular
  const zEff = channelType === 'rectangular' ? 0 : (channelType === 'triangular' ? Math.max(z, 0.5) : z);
  const bEff = channelType === 'triangular' ? 0 : b;

  // ── Core Hydraulic Calculations ─────────────────────────────────────────────
  const calcs = useMemo(() => {
    const yn = solveNormalDepth(Q, bEff, zEff, n, S0);
    const yc = solveCriticalDepth(Q, bEff, zEff);
    const Sc = solveNormalDepth(Q, bEff, zEff, n, 1e-6) > 0
      ? (() => { // Critical slope: S0 where yn=yc
          const { A, R, T } = channelGeometry(yc, bEff, zEff);
          return Math.pow((Q * n) / (1.49 * A * Math.pow(R, 2 / 3)), 2);
        })()
      : 0;

    const geoN = channelGeometry(yn, bEff, zEff);
    const Vn = Q / Math.max(geoN.A, 0.001);
    const Frn = Vn / Math.sqrt(G * Math.max(geoN.Dh, 0.001));
    const En = yn + Vn * Vn / (2 * G);

    const geo1 = channelGeometry(y1, bEff, zEff);
    const V1val = Q / Math.max(geo1.A, 0.001);
    const Fr1 = V1val / Math.sqrt(G * Math.max(geo1.Dh, 0.001));
    const E1 = y1 + V1val * V1val / (2 * G);
    const Emin = specificEnergy(yc, Q, bEff, zEff);

    const hasJump = Fr1 > 1.0 && y1 < yc * 0.99;
    const jumpData = hasJump ? conjugateDepth(y1, Q, bEff, zEff) : null;

    // ── Jump Length — 4 Empirical Formulas (rectangular-based; best-effort for trapezoid)
    const jumpLengths = hasJump ? (() => {
      const { y2, Fr1: Fr1j = Fr1 } = jumpData;
      // USBR / Peterka (1958): Lj ≈ 6.1·y₂  (Fr₁ > 4.5, most conservative for design)
      const Lpeterka = 6.1 * y2;
      // Chow (1959): Lj = 6.9·(y₂ - y₁)
      const Lchow = 6.9 * (y2 - y1);
      // Silvester (1964): Lj = 9.75·y₁·(Fr₁ - 1)^1.01
      const Lsilvester = 9.75 * y1 * Math.pow(Math.max(Fr1 - 1, 0.01), 1.01);
      // Hager, Bremen & Kawagoshi (1990): Lj/y₁ = 8·Fr₁ - 12  (valid Fr₁ = 1.7–18)
      const Lhager = y1 * (8 * Fr1 - 12);
      // Jump efficiency η = E₂/E₁ (closed-form for rectangular channel)
      const efficiency = (jumpData.E2 / Math.max(jumpData.E1, 0.001)) * 100;
      // Jump type classification (USBR Peterka)
      const jumpType = Fr1 < 1.7 ? 'Undular (Fr<1.7)'
        : Fr1 < 2.5 ? 'Weak (1.7–2.5)'
        : Fr1 < 4.5 ? 'Oscillating (2.5–4.5)'
        : Fr1 < 9.0 ? 'Steady (4.5–9.0)'
        : 'Strong (Fr>9)';
      return { Lpeterka, Lchow, Lsilvester, Lhager, efficiency, jumpType };
    })() : null;

    const slopeClass = S0 < Sc * 0.99 ? 'Mild' : S0 > Sc * 1.01 ? 'Steep' : 'Critical';
    const regimeN = Frn < 0.95 ? 'Subcritical' : Frn > 1.05 ? 'Supercritical' : 'Critical';
    const regime1 = Fr1 < 0.95 ? 'Subcritical' : Fr1 > 1.05 ? 'Supercritical' : 'Critical';

    // E-y curve stations
    const yCurve = [];
    const yCurveMax = Math.max(yn * 2.5, yc * 2.5, 12);
    for (let yi = 0.05; yi <= yCurveMax; yi += yCurveMax / 80) {
      yCurve.push({ y: yi, E: specificEnergy(yi, Q, bEff, zEff) });
    }

    return {
      yn, yc, Sc, slopeClass,
      geoN, Vn, Frn, En, regimeN,
      geo1, V1: V1val, Fr1, E1, Emin, regime1,
      hasJump, jumpData, jumpLengths,
      yCurve, yCurveMax
    };
  }, [Q, bEff, zEff, n, S0, y1]);

  const { yn, yc, Frn, En, regimeN, Fr1, E1, Emin, hasJump, jumpData, yCurve } = calcs;

  // Status colors
  const frColor = Frn < 0.95 ? COLOR_SUB : Frn > 1.05 ? COLOR_SUPER : COLOR_WARN;
  const frColor1 = Fr1 < 0.95 ? COLOR_SUB : Fr1 > 1.05 ? COLOR_SUPER : COLOR_WARN;
  const fr1Warn = Fr1 > 1.05;
  const isMild = calcs.slopeClass === 'Mild';

  // ── SVG Dimensions ────────────────────────────────────────────────────────
  const svgW = 680, svgH = 480;
  const padL = 55, padR = 20, padT = 35, padB = 55;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // ── Profile View Helpers ──────────────────────────────────────────────────
  const profileYMax = Math.max(yn * 1.5, yc * 1.5, y1 * 1.5, 6);
  const profileXSpan = 80; // ft of channel shown
  const pxPerFt = plotH / profileYMax;
  const pxPerFtX = plotW / profileXSpan;
  const bedY = padT + plotH; // SVG y of channel bed
  const waterSurfaceY = (depth) => bedY - depth * pxPerFt;
  const channelX = (xFt) => padL + xFt * pxPerFtX;

  // Jump geometry in profile (jump placed at x=20 ft)
  const jumpX = 20;
  const jumpLen = hasJump ? Math.min(6.1 * (jumpData?.y2 || 1), 20) : 0;

  // ── Cross-Section Helpers ─────────────────────────────────────────────────
  const csW = 300, csH = 220, csCX = 340 + 170;
  const csScale = Math.min(csW / (bEff + 2 * zEff * yn * 1.5 + 4), 30);
  const csBotPx = bEff * csScale;
  const csDepPx = Math.min(yn * csScale, csH * 0.7);
  const csSlopePx = zEff * csScale;
  const csGroundY = padT + plotH - 20;
  const csCenterX = padL + plotW * 0.5 + 20;
  const csBL = csCenterX - csBotPx / 2 - csSlopePx * csDepPx / csScale;
  const csBR = csCenterX + csBotPx / 2 + csSlopePx * csDepPx / csScale;
  const csYc = Math.min(yc * csScale, csH * 0.65);
  const waterLeft  = csCenterX - csBotPx / 2 - csSlopePx * csDepPx / csScale;
  const waterRight = csCenterX + csBotPx / 2 + csSlopePx * csDepPx / csScale;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel" style={{ width: '100%' }}>

        {/* ── KPI Cards Row ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { label: 'Normal Depth yₙ', val: `${yn.toFixed(2)} ft`, sub: yn > yc ? '(Mild Slope ✓)' : '(Steep Slope)', color: isMild ? COLOR_SAFE : COLOR_WARN },
            { label: 'Critical Depth yc', val: `${yc.toFixed(2)} ft`, sub: `Emin = ${Emin.toFixed(2)} ft`, color: COLOR_CRIT },
            { label: 'Froude No. (yn)', val: Frn.toFixed(3), sub: regimeN, color: frColor },
            { label: 'Velocity V', val: `${calcs.Vn.toFixed(2)} ft/s`, sub: `Q = ${Q} cfs`, color: 'var(--accent-cyan)' },
            { label: 'Slope Class', val: calcs.slopeClass, sub: `Sc = ${(calcs.Sc * 1000).toFixed(2)}‰`, color: isMild ? COLOR_SAFE : COLOR_WARN },
            { label: 'Jump ΔE', val: hasJump ? `${jumpData.dE.toFixed(2)} ft` : 'No Jump', sub: hasJump ? `${calcs.jumpLengths.efficiency.toFixed(0)}% η · ${((jumpData.dE / jumpData.E1) * 100).toFixed(0)}% dissip.` : `Fr₁ = ${Fr1.toFixed(2)}`, color: hasJump ? COLOR_FAIL : COLOR_SAFE },
            { label: 'Jump Length Lⱼ', val: hasJump ? `${calcs.jumpLengths.Lpeterka.toFixed(1)} ft` : '—', sub: hasJump ? `6.1·y₂ (USBR) · ${calcs.jumpLengths.jumpType}` : 'No supercritical flow', color: hasJump ? '#f97316' : '#475569' },
          ].map((k, i) => (
            <div key={i} style={{
              background: `rgba(15,23,42,0.7)`,
              border: `1px solid ${k.color}44`,
              borderRadius: '8px',
              padding: '0.6rem 0.5rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: k.color, fontFamily: 'var(--font-mono)' }}>{k.val}</div>
              <div style={{ fontSize: '0.6rem', color: k.color + 'aa', marginTop: '0.1rem' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>

          {/* ── Controls ───────────────────────────────────────────────── */}
          <div className="visualizer-controls" style={{ minWidth: '230px', maxWidth: '230px' }}>

            <div style={{ marginBottom: '0.8rem' }}>
              <h3 className="text-gradient" style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>🌊 Channel Hydraulics</h3>
              <p className="text-muted text-sm" style={{ fontSize: '0.7rem' }}>Manning · Critical · Jump · Froude</p>
            </div>

            {/* Channel Type */}
            <div className="control-group" style={{ marginBottom: '0.7rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Channel Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem' }}>
                {CHANNEL_TYPES.map(ct => (
                  <button key={ct.key}
                    onClick={() => { setChannelType(ct.key); if (ct.key === 'rectangular') setZ(0); else if (ct.key === 'triangular') setZ(Math.max(z, 0.5)); }}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.6rem',
                      fontWeight: '700',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '5px',
                      border: `1px solid ${channelType === ct.key ? 'var(--accent-blue)' : 'rgba(100,116,139,0.3)'}`,
                      background: channelType === ct.key ? 'rgba(59,130,246,0.2)' : 'rgba(15,23,42,0.5)',
                      color: channelType === ct.key ? 'var(--accent-blue)' : 'var(--text-muted)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>{ct.icon} {ct.label}</button>
                ))}
              </div>
            </div>

            {/* Manning n presets */}
            <div className="control-group" style={{ marginBottom: '0.7rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>Lining / Manning's n</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.35rem' }}>
                {MANNING_PRESETS.map(p => (
                  <button key={p.n}
                    onClick={() => setN(p.n)}
                    style={{
                      padding: '0.2rem 0.35rem',
                      fontSize: '0.58rem',
                      fontWeight: '700',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '4px',
                      border: `1px solid ${Math.abs(n - p.n) < 0.001 ? 'var(--accent-emerald)' : 'rgba(100,116,139,0.3)'}`,
                      background: Math.abs(n - p.n) < 0.001 ? 'rgba(16,185,129,0.18)' : 'rgba(15,23,42,0.5)',
                      color: Math.abs(n - p.n) < 0.001 ? COLOR_SAFE : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>{p.icon} {p.label}</button>
                ))}
              </div>
              <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
                <span>n = {n.toFixed(3)}</span>
              </div>
              <input type="range" min="0.008" max="0.050" step="0.001" value={n} onChange={e => setN(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Q */}
            <div className="control-group" style={{ marginBottom: '0.5rem' }}>
              <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
                <label>Discharge Q (cfs)</label>
                <span className="value-display">{Q}</span>
              </div>
              <input type="range" min="5" max="600" step="5" value={Q} onChange={e => setQ(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Bottom Width */}
            {channelType !== 'triangular' && (
              <div className="control-group" style={{ marginBottom: '0.5rem' }}>
                <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
                  <label>Bottom Width b (ft)</label>
                  <span className="value-display">{bEff.toFixed(1)}</span>
                </div>
                <input type="range" min="1" max="24" step="0.5" value={bEff} onChange={e => setB(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
            )}

            {/* Side Slope */}
            {channelType !== 'rectangular' && (
              <div className="control-group" style={{ marginBottom: '0.5rem' }}>
                <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
                  <label>Side Slope z (H:1V)</label>
                  <span className="value-display">{zEff.toFixed(1)}:1</span>
                </div>
                <input type="range" min="0.25" max="4" step="0.25" value={zEff} onChange={e => setZ(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
            )}

            {/* Slope */}
            <div className="control-group" style={{ marginBottom: '0.5rem' }}>
              <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
                <label>Channel Slope S₀</label>
                <span className="value-display">{S0.toFixed(4)}</span>
              </div>
              <input type="range" min="0.0001" max="0.05" step="0.0001" value={S0} onChange={e => setS0(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>

            {/* Upstream depth y1 for jump */}
            <div className="control-group" style={{ marginBottom: '0.5rem' }}>
              <div className="control-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '0.2rem' }}>
                <label style={{ color: fr1Warn ? COLOR_SUPER : 'inherit' }}>
                  {fr1Warn ? '⚡ Upstream Depth y₁ (SUPER)' : 'Upstream Depth y₁ (ft)'}
                </label>
                <span className="value-display" style={{ color: frColor1 }}>{y1.toFixed(2)}</span>
              </div>
              <input type="range" min="0.1" max={Math.max(yn * 1.5, 8)} step="0.05" value={y1} onChange={e => setY1(parseFloat(e.target.value))} style={{ width: '100%' }} />
              <div style={{ fontSize: '0.6rem', marginTop: '0.2rem', color: frColor1, fontFamily: 'var(--font-mono)' }}>
                Fr₁ = {Fr1.toFixed(3)} · {calcs.regime1}
                {hasJump && <span style={{ color: COLOR_FAIL }}> → Jump y₂={jumpData.y2.toFixed(2)}'</span>}
              </div>
            </div>

            {/* View mode */}
            <div className="control-group" style={{ marginBottom: '0.7rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>View</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.3rem' }}>
                {[['profile', '📐 Profile'], ['xsection', '🔵 Cross-Section'], ['energy', '📈 E-y Curve']].map(([v, lbl]) => (
                  <button key={v}
                    onClick={() => setViewMode(v)}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.58rem',
                      fontWeight: '700',
                      borderRadius: '5px',
                      border: `1px solid ${viewMode === v ? 'var(--accent-purple)' : 'rgba(100,116,139,0.3)'}`,
                      background: viewMode === v ? 'rgba(139,92,246,0.2)' : 'rgba(15,23,42,0.5)',
                      color: viewMode === v ? 'var(--accent-purple)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>{lbl}</button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowDerivation(true)}
              style={{
                width: '100%', padding: '0.5rem', fontSize: '0.7rem', fontWeight: '700',
                fontFamily: 'var(--font-mono)', borderRadius: '6px', cursor: 'pointer',
                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)',
                color: 'var(--accent-purple)', transition: 'all 0.2s',
              }}>📐 Step-by-Step Derivation</button>
          </div>

          {/* ── SVG Panel ─────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', borderRadius: '10px', background: 'rgba(2,6,23,0.8)', border: '1px solid rgba(51,65,85,0.5)' }}>
              <defs>
                {/* Water gradient */}
                <linearGradient id="ch-water-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="ch-supercrit-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#c2410c" stopOpacity="0.65" />
                </linearGradient>
                <linearGradient id="ch-jump-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="ch-earth-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#78350f" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#451a03" stopOpacity="1.0" />
                </linearGradient>
                <linearGradient id="ch-egl-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
                </linearGradient>
                <filter id="ch-glow-blue">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="ch-glow-orange">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="ch-arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8" />
                </marker>
                <marker id="ch-arrow-orange" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" />
                </marker>
                <marker id="ch-arrow-amber" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
                </marker>
                <marker id="ch-arrow-purple" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#a78bfa" />
                </marker>
                <pattern id="ch-turbulence" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={`translate(${(animFrame * 2) % 12}, 0)`}>
                  <circle cx="3" cy="6" r="2.5" fill="white" opacity="0.25" />
                  <circle cx="9" cy="3" r="1.5" fill="white" opacity="0.18" />
                  <circle cx="9" cy="9" r="2" fill="white" opacity="0.2" />
                </pattern>
                <pattern id="ch-ripple" width="20" height="6" patternUnits="userSpaceOnUse" patternTransform={`translate(${(animFrame * 1.5) % 20}, 0)`}>
                  <path d="M0,3 Q5,0 10,3 Q15,6 20,3" fill="none" stroke="white" strokeWidth="0.6" opacity="0.3" />
                </pattern>
              </defs>

              {/* ── PROFILE VIEW ──────────────────────────────────────────── */}
              {viewMode === 'profile' && (() => {
                const ynY  = waterSurfaceY(yn);
                const ycY  = waterSurfaceY(yc);
                const y1Y  = waterSurfaceY(y1);
                const y2Y  = hasJump ? waterSurfaceY(jumpData.y2) : ynY;
                const jumpXpx = channelX(jumpX);
                const jumpEndXpx = channelX(jumpX + jumpLen);
                const eglElev = (depth, xFt) => {
                  const { A } = channelGeometry(depth, bEff, zEff);
                  const V = Q / Math.max(A, 0.001);
                  const E = depth + V * V / (2 * G);
                  // EGL = z_bed + depth + V²/2g; slope the bed
                  return waterSurfaceY(E + xFt * S0 * 0);
                };

                return (
                  <g>
                    {/* Background sky/earth */}
                    <rect x={padL} y={padT} width={plotW} height={plotH} fill="rgba(2,8,18,0.6)" />

                    {/* Earth below channel */}
                    <rect x={padL} y={bedY} width={plotW} height={svgH - bedY} fill="url(#ch-earth-grad)" />

                    {/* Channel bed line */}
                    <line x1={padL} y1={bedY} x2={padL + plotW} y2={bedY} stroke="#92400e" strokeWidth="3" />

                    {/* Normal depth water fill */}
                    {!hasJump && (
                      <rect x={padL} y={ynY} width={plotW} height={bedY - ynY}
                        fill="url(#ch-water-grad)" opacity="0.85" />
                    )}

                    {/* If jump: upstream supercritical then jump then subcritical */}
                    {hasJump && (() => {
                      const y2 = jumpData.y2;
                      const y2Y2 = waterSurfaceY(y2);
                      return (
                        <g>
                          {/* Supercritical upstream section (y1, thin fast) */}
                          <rect x={padL} y={y1Y} width={jumpXpx - padL} height={bedY - y1Y}
                            fill="url(#ch-supercrit-grad)" opacity="0.85" />
                          {/* Hydraulic jump zone */}
                          <path
                            d={`M ${jumpXpx},${y1Y} Q ${(jumpXpx + jumpEndXpx) / 2},${y2Y2 - 25} ${jumpEndXpx},${y2Y2} L ${jumpEndXpx},${bedY} L ${jumpXpx},${bedY} Z`}
                            fill="url(#ch-jump-grad)" opacity="0.9" />
                          {/* Turbulence pattern on jump */}
                          <rect x={jumpXpx} y={y2Y2} width={jumpEndXpx - jumpXpx} height={bedY - y2Y2}
                            fill="url(#ch-turbulence)" opacity="0.7" />
                          {/* Subcritical downstream */}
                          <rect x={jumpEndXpx} y={y2Y2} width={padL + plotW - jumpEndXpx} height={bedY - y2Y2}
                            fill="url(#ch-water-grad)" opacity="0.85" />
                          {/* Ripple on surface downstream */}
                          <rect x={jumpEndXpx} y={y2Y2} width={padL + plotW - jumpEndXpx} height={8}
                            fill="url(#ch-ripple)" opacity="0.5" />
                        </g>
                      );
                    })()}

                    {/* Ripple on normal depth surface */}
                    {!hasJump && (
                      <rect x={padL} y={ynY} width={plotW} height={8} fill="url(#ch-ripple)" opacity="0.6" />
                    )}

                    {/* Flow arrows (animated) */}
                    {[0.15, 0.35, 0.55, 0.75].map((frac, i) => {
                      const ax = padL + frac * plotW;
                      const phase = (animFrame + i * 15) % 60;
                      const xOff = (phase / 60) * 20 - 10;
                      const isSuperZone = hasJump && ax < jumpXpx;
                      const color = isSuperZone ? '#f97316' : '#38bdf8';
                      const arrowMark = isSuperZone ? 'url(#ch-arrow-orange)' : 'url(#ch-arrow-blue)';
                      const depthForZone = isSuperZone ? y1 : yn;
                      const midY = bedY - depthForZone * pxPerFt * 0.5;
                      return (
                        <line key={i}
                          x1={ax + xOff - 10} y1={midY}
                          x2={ax + xOff + 10} y2={midY}
                          stroke={color} strokeWidth="1.8"
                          markerEnd={arrowMark} opacity="0.9" />
                      );
                    })}

                    {/* EGL line */}
                    {(() => {
                      const eglPoints = [];
                      for (let xi = 0; xi <= plotW; xi += 8) {
                        const xFt = xi / pxPerFtX;
                        const depth = hasJump && xi < jumpXpx - padL ? y1
                          : hasJump && xi < jumpEndXpx - padL ? (y1 + jumpData.y2) / 2
                          : hasJump ? jumpData.y2 : yn;
                        const { A } = channelGeometry(depth, bEff, zEff);
                        const V = Q / Math.max(A, 0.001);
                        const E = depth + V * V / (2 * G);
                        eglPoints.push(`${padL + xi},${bedY - E * pxPerFt}`);
                      }
                      return <polyline points={eglPoints.join(' ')} fill="none"
                        stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="6,3" opacity="0.8" />;
                    })()}

                    {/* Normal depth line */}
                    <line x1={padL} y1={ynY} x2={padL + plotW} y2={ynY}
                      stroke={COLOR_SAFE} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.7" />
                    {/* Critical depth line */}
                    <line x1={padL} y1={ycY} x2={padL + plotW} y2={ycY}
                      stroke={COLOR_CRIT} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8" />

                    {/* Dimension annotations */}
                    {/* yn label */}
                    <rect x={padL + 5} y={ynY - 10} width={95} height={14} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_SAFE} strokeWidth="0.7" />
                    <text x={padL + 52} y={ynY + 0} fill={COLOR_SAFE} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                      yₙ = {yn.toFixed(2)}' (Fr={Frn.toFixed(2)})
                    </text>
                    {/* yc label */}
                    <rect x={padL + 5} y={ycY + 2} width={80} height={14} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_CRIT} strokeWidth="0.7" />
                    <text x={padL + 45} y={ycY + 13} fill={COLOR_CRIT} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                      yc = {yc.toFixed(2)}' (Fr=1.0)
                    </text>

                    {/* Hydraulic jump annotations */}
                    {hasJump && (() => {
                      const y2 = jumpData.y2;
                      const y2Y2 = waterSurfaceY(y2);
                      return (
                        <g>
                          {/* y1 label */}
                          <rect x={jumpXpx - 100} y={y1Y - 14} width={95} height={14} rx="3" fill="rgba(15,23,42,0.92)" stroke={COLOR_SUPER} strokeWidth="0.8" />
                          <text x={jumpXpx - 52} y={y1Y - 3} fill={COLOR_SUPER} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                            y₁ = {y1.toFixed(2)}' Fr={Fr1.toFixed(2)}
                          </text>
                          {/* y2 label */}
                          <rect x={jumpEndXpx + 5} y={y2Y2 - 14} width={98} height={14} rx="3" fill="rgba(15,23,42,0.92)" stroke={COLOR_SUB} strokeWidth="0.8" />
                          <text x={jumpEndXpx + 54} y={y2Y2 - 3} fill={COLOR_SUB} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                            y₂ = {y2.toFixed(2)}' (Sequent)
                          </text>
                          {/* ΔE label */}
                          <rect x={(jumpXpx + jumpEndXpx) / 2 - 70} y={bedY + 8} width={140} height={14} rx="3" fill="rgba(244,63,94,0.2)" stroke={COLOR_FAIL} strokeWidth="0.8" />
                          <text x={(jumpXpx + jumpEndXpx) / 2} y={bedY + 19} fill={COLOR_FAIL} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                            ΔE = {jumpData.dE.toFixed(2)} ft ({((jumpData.dE / jumpData.E1) * 100).toFixed(0)}% dissipated)
                          </text>
                          {/* Jump length */}
                          <line x1={jumpXpx} y1={bedY + 30} x2={jumpEndXpx} y2={bedY + 30} stroke="#64748b" strokeWidth="1" />
                          <line x1={jumpXpx} y1={bedY + 25} x2={jumpXpx} y2={bedY + 35} stroke="#64748b" strokeWidth="1" />
                          <line x1={jumpEndXpx} y1={bedY + 25} x2={jumpEndXpx} y2={bedY + 35} stroke="#64748b" strokeWidth="1" />
                          <text x={(jumpXpx + jumpEndXpx) / 2} y={bedY + 42} fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">
                            Lⱼ ≈ {jumpLen.toFixed(1)} ft (≈6.1·y₂)
                          </text>
                          {/* JUMP badge */}
                          <rect x={(jumpXpx + jumpEndXpx) / 2 - 48} y={y2Y2 + 8} width={96} height={16} rx="4" fill="rgba(240,171,252,0.25)" stroke="#f0abfc" strokeWidth="0.8" />
                          <text x={(jumpXpx + jumpEndXpx) / 2} y={y2Y2 + 19} fill="#f0abfc" fontSize="9" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">⚡ HYDRAULIC JUMP</text>
                        </g>
                      );
                    })()}

                    {/* EGL legend */}
                    <line x1={padL + plotW - 90} y1={padT + 10} x2={padL + plotW - 70} y2={padT + 10} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="5,3" />
                    <text x={padL + plotW - 65} y={padT + 14} fill="#fbbf24" fontSize="8" fontFamily="var(--font-mono)">EGL</text>
                    <line x1={padL + plotW - 90} y1={padT + 22} x2={padL + plotW - 70} y2={padT + 22} stroke={COLOR_SAFE} strokeWidth="1.5" strokeDasharray="5,3" />
                    <text x={padL + plotW - 65} y={padT + 26} fill={COLOR_SAFE} fontSize="8" fontFamily="var(--font-mono)">yₙ</text>
                    <line x1={padL + plotW - 90} y1={padT + 34} x2={padL + plotW - 70} y2={padT + 34} stroke={COLOR_CRIT} strokeWidth="1.5" strokeDasharray="3,3" />
                    <text x={padL + plotW - 65} y={padT + 38} fill={COLOR_CRIT} fontSize="8" fontFamily="var(--font-mono)">yc</text>

                    {/* Y-axis */}
                    {[0, 1, 2, 3, 4, 5].filter(v => v <= profileYMax).map(v => (
                      <g key={v}>
                        <line x1={padL - 4} y1={waterSurfaceY(v)} x2={padL} y2={waterSurfaceY(v)} stroke="#475569" strokeWidth="1" />
                        <text x={padL - 7} y={waterSurfaceY(v) + 4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">{v}'</text>
                      </g>
                    ))}
                    <text x={padL - 30} y={padT + plotH / 2} fill="#64748b" fontSize="9" textAnchor="middle" transform={`rotate(-90,${padL - 30},${padT + plotH / 2})`} fontFamily="var(--font-mono)">Depth (ft)</text>

                    {/* Title */}
                    <rect x={padL} y={padT} width={220} height={20} rx="4" fill="rgba(15,23,42,0.85)" stroke="rgba(51,65,85,0.6)" strokeWidth="0.8" />
                    <text x={padL + 8} y={padT + 13} fill="var(--text-primary)" fontSize="9.5" fontWeight="700" fontFamily="var(--font-mono)">
                      {calcs.slopeClass} Slope Channel — {calcs.regimeN} Flow (Fr={Frn.toFixed(3)})
                    </text>
                  </g>
                );
              })()}

              {/* ── CROSS-SECTION VIEW ──────────────────────────────────── */}
              {viewMode === 'xsection' && (() => {
                const cx = svgW / 2;
                const groundY2 = padT + plotH * 0.85;
                const scale2 = Math.min(220 / Math.max(bEff + 2 * zEff * yn + 6, 4), 28);
                const halfBot = bEff * scale2 / 2;
                const halfTop = (bEff / 2 + zEff * yn) * scale2;
                const depPx = yn * scale2;
                const critPx = yc * scale2;
                const y1Px = Math.min(y1 * scale2, depPx * 2);

                return (
                  <g>
                    {/* Ground fill */}
                    <rect x={0} y={groundY2} width={svgW} height={svgH - groundY2} fill="rgba(120,53,15,0.4)" />
                    {/* Channel earth outline */}
                    <path
                      d={`M ${cx - halfTop - 30},${groundY2 - 5} L ${cx - halfTop},${groundY2} L ${cx - halfBot},${groundY2 - depPx} L ${cx + halfBot},${groundY2 - depPx} L ${cx + halfTop},${groundY2} L ${cx + halfTop + 30},${groundY2 - 5}`}
                      fill="rgba(146,64,14,0.6)" stroke="#92400e" strokeWidth="2" />

                    {/* Water fill to normal depth */}
                    {(() => {
                      const waterTopY = groundY2 - depPx;
                      const waterBL = cx - halfBot - zEff * scale2 * (depPx / scale2 * 0);
                      // Water shape: matches channel cross-section
                      return (
                        <path
                          d={`M ${cx - halfBot},${groundY2 - depPx}
                              L ${cx - halfBot - zEff * depPx},${groundY2}
                              L ${cx + halfBot + zEff * depPx},${groundY2}
                              L ${cx + halfBot},${groundY2 - depPx} Z`}
                          fill="url(#ch-water-grad)" opacity="0.8" />
                      );
                    })()}

                    {/* Ripple on water surface */}
                    <rect x={cx - halfBot - zEff * depPx} y={groundY2 - depPx} width={2 * (halfBot + zEff * depPx)} height={7}
                      fill="url(#ch-ripple)" opacity="0.55" />

                    {/* Normal depth line (solid green) */}
                    <line x1={cx - halfBot - zEff * depPx - 20} y1={groundY2 - depPx}
                      x2={cx + halfBot + zEff * depPx + 20} y2={groundY2 - depPx}
                      stroke={COLOR_SAFE} strokeWidth="2" />
                    <rect x={cx - halfBot - zEff * depPx - 80} y={groundY2 - depPx - 14} width={75} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_SAFE} strokeWidth="0.7" />
                    <text x={cx - halfBot - zEff * depPx - 42} y={groundY2 - depPx - 4} fill={COLOR_SAFE} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">yₙ = {yn.toFixed(2)} ft</text>

                    {/* Critical depth line (dashed purple) */}
                    <line x1={cx - halfBot - zEff * critPx - 20} y1={groundY2 - critPx}
                      x2={cx + halfBot + zEff * critPx + 20} y2={groundY2 - critPx}
                      stroke={COLOR_CRIT} strokeWidth="1.8" strokeDasharray="6,3" opacity="0.9" />
                    <rect x={cx + halfBot + zEff * critPx + 5} y={groundY2 - critPx - 14} width={75} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_CRIT} strokeWidth="0.7" />
                    <text x={cx + halfBot + zEff * critPx + 42} y={groundY2 - critPx - 4} fill={COLOR_CRIT} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">yc = {yc.toFixed(2)} ft</text>

                    {/* Upstream depth y1 if different */}
                    {Math.abs(y1 - yn) > 0.15 && (
                      <>
                        <line x1={cx - halfBot - zEff * y1Px - 10} y1={groundY2 - y1Px}
                          x2={cx + halfBot + zEff * y1Px + 10} y2={groundY2 - y1Px}
                          stroke={frColor1} strokeWidth="1.5" strokeDasharray="3,2" opacity="0.8" />
                        <text x={cx} y={groundY2 - y1Px - 3} fill={frColor1} fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">y₁ = {y1.toFixed(2)}' (Fr={Fr1.toFixed(2)})</text>
                      </>
                    )}

                    {/* Dimension: Bottom Width */}
                    <line x1={cx - halfBot} y1={groundY2 + 18} x2={cx + halfBot} y2={groundY2 + 18} stroke="var(--accent-blue)" strokeWidth="1.2" />
                    <line x1={cx - halfBot} y1={groundY2 + 13} x2={cx - halfBot} y2={groundY2 + 23} stroke="var(--accent-blue)" strokeWidth="1.2" />
                    <line x1={cx + halfBot} y1={groundY2 + 13} x2={cx + halfBot} y2={groundY2 + 23} stroke="var(--accent-blue)" strokeWidth="1.2" />
                    <text x={cx} y={groundY2 + 30} fill="var(--accent-blue)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">b = {bEff} ft</text>

                    {/* Dimension: Top Width T */}
                    <line x1={cx - halfBot - zEff * depPx} y1={groundY2 - depPx - 12} x2={cx + halfBot + zEff * depPx} y2={groundY2 - depPx - 12} stroke="var(--accent-cyan)" strokeWidth="1.2" />
                    <text x={cx} y={groundY2 - depPx - 16} fill="var(--accent-cyan)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)">
                      T = {(bEff + 2 * zEff * yn).toFixed(2)} ft
                    </text>

                    {/* Side slope label */}
                    {zEff > 0 && (
                      <text x={cx + halfBot + zEff * depPx / 2 + 15} y={groundY2 - depPx / 2} fill="#94a3b8" fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" transform={`rotate(${Math.atan(1 / zEff) * 180 / Math.PI},${cx + halfBot + zEff * depPx / 2 + 15},${groundY2 - depPx / 2})`}>
                        z = {zEff}:1
                      </text>
                    )}

                    {/* Flow properties box */}
                    <rect x={20} y={padT + 10} width={200} height={100} rx="6" fill="rgba(15,23,42,0.9)" stroke="rgba(51,65,85,0.6)" strokeWidth="1" />
                    {[
                      ['A (area)', `${calcs.geoN.A.toFixed(2)} ft²`],
                      ['P (wetted perim)', `${calcs.geoN.P.toFixed(2)} ft`],
                      ['R (hyd. radius)', `${calcs.geoN.R.toFixed(3)} ft`],
                      ['T (top width)', `${(bEff + 2 * zEff * yn).toFixed(2)} ft`],
                      ['Dh (hyd. depth)', `${calcs.geoN.Dh.toFixed(3)} ft`],
                    ].map(([label, val], i) => (
                      <g key={i}>
                        <text x={30} y={padT + 28 + i * 16} fill="#94a3b8" fontSize="8.5" fontFamily="var(--font-mono)">{label}</text>
                        <text x={215} y={padT + 28 + i * 16} fill="var(--text-primary)" fontSize="8.5" fontWeight="700" textAnchor="end" fontFamily="var(--font-mono)">{val}</text>
                      </g>
                    ))}
                  </g>
                );
              })()}

              {/* ── SPECIFIC ENERGY CURVE ─────────────────────────────── */}
              {viewMode === 'energy' && (() => {
                const margin = { l: 70, r: 30, t: 40, b: 55 };
                const w = svgW - margin.l - margin.r;
                const h = svgH - margin.t - margin.b;

                // Scale E axis and y axis
                const Emax = Math.max(E1 * 1.3, calcs.yn + calcs.Vn * calcs.Vn / (2 * G) * 1.4, 10);
                const yCurveMax2 = Math.max(yn * 2.2, yc * 2.2, 8);
                const eScale = w / Emax;
                const yScale = h / yCurveMax2;
                const eX = (E) => margin.l + E * eScale;
                const yY = (y) => margin.t + h - y * yScale;

                // Build curve points
                const curvePoints = yCurve.map(pt => `${eX(pt.E).toFixed(1)},${yY(pt.y).toFixed(1)}`).join(' ');

                // Current operating point at yn
                const EnOp = yn + calcs.Vn * calcs.Vn / (2 * G);
                const E1op = y1 + calcs.V1 * calcs.V1 / (2 * G);
                const E2op = hasJump ? jumpData.E2 : 0;

                return (
                  <g>
                    {/* Grid lines */}
                    {[0, 2, 4, 6, 8, 10].filter(v => v <= Emax).map(v => (
                      <g key={v}>
                        <line x1={eX(v)} y1={margin.t} x2={eX(v)} y2={margin.t + h} stroke="rgba(51,65,85,0.4)" strokeWidth="1" strokeDasharray="3,3" />
                        <text x={eX(v)} y={margin.t + h + 14} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)">{v}</text>
                      </g>
                    ))}
                    {[0, 1, 2, 3, 4, 5, 6].filter(v => v <= yCurveMax2).map(v => (
                      <g key={v}>
                        <line x1={margin.l} y1={yY(v)} x2={margin.l + w} y2={yY(v)} stroke="rgba(51,65,85,0.4)" strokeWidth="1" strokeDasharray="3,3" />
                        <text x={margin.l - 6} y={yY(v) + 4} fill="#64748b" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">{v}'</text>
                      </g>
                    ))}

                    {/* 45° line (y = E, limiting line) */}
                    <line x1={margin.l} y1={margin.t + h} x2={eX(yCurveMax2)} y2={yY(yCurveMax2)} stroke="#374151" strokeWidth="1" strokeDasharray="2,4" opacity="0.6" />

                    {/* Subcritical zone shading */}
                    <rect x={margin.l} y={margin.t} width={w} height={h} fill="rgba(56,189,248,0.05)" />

                    {/* Specific Energy Curve */}
                    <polyline points={curvePoints} fill="none" stroke="var(--accent-blue)" strokeWidth="2.5" filter="url(#ch-glow-blue)" />

                    {/* Critical point */}
                    <line x1={eX(Emin)} y1={margin.t} x2={eX(Emin)} y2={margin.t + h}
                      stroke={COLOR_CRIT} strokeWidth="1.2" strokeDasharray="4,3" opacity="0.7" />
                    <circle cx={eX(Emin)} cy={yY(yc)} r="6"
                      fill={COLOR_CRIT} stroke="white" strokeWidth="1.5" filter="url(#ch-glow-orange)" />
                    <rect x={eX(Emin) + 8} y={yY(yc) - 14} width={90} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_CRIT} strokeWidth="0.7" />
                    <text x={eX(Emin) + 53} y={yY(yc) - 4} fill={COLOR_CRIT} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                      Emin={Emin.toFixed(2)}', yc={yc.toFixed(2)}'
                    </text>

                    {/* Normal depth operating point */}
                    <circle cx={eX(EnOp)} cy={yY(yn)} r="5.5"
                      fill={frColor} stroke="white" strokeWidth="1.5" />
                    <rect x={eX(EnOp) + 8} y={yY(yn) - 13} width={100} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={frColor} strokeWidth="0.7" />
                    <text x={eX(EnOp) + 58} y={yY(yn) - 3} fill={frColor} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                      yₙ={yn.toFixed(2)}' Fr={Frn.toFixed(2)}
                    </text>

                    {/* y1 operating point */}
                    {Math.abs(y1 - yn) > 0.1 && (
                      <circle cx={eX(E1op)} cy={yY(y1)} r="5"
                        fill={frColor1} stroke="white" strokeWidth="1.5" />
                    )}
                    {Math.abs(y1 - yn) > 0.1 && (
                      <>
                        <rect x={eX(E1op) - 100} y={yY(y1) + 6} width={92} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={frColor1} strokeWidth="0.7" />
                        <text x={eX(E1op) - 54} y={yY(y1) + 16} fill={frColor1} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                          y₁={y1.toFixed(2)}' Fr={Fr1.toFixed(2)}
                        </text>
                      </>
                    )}

                    {/* Jump arc y1 → y2 */}
                    {hasJump && (() => {
                      const x1p = eX(E1op);
                      const y1p = yY(y1);
                      const x2p = eX(jumpData.E2);
                      const y2p = yY(jumpData.y2);
                      return (
                        <g>
                          <path d={`M ${x1p},${y1p} C ${x1p + 30},${y1p + 20} ${x2p - 30},${y2p - 20} ${x2p},${y2p}`}
                            fill="none" stroke={COLOR_FAIL} strokeWidth="2" strokeDasharray="5,3"
                            markerEnd="url(#ch-arrow-orange)" />
                          <circle cx={x2p} cy={y2p} r="5" fill={COLOR_SUB} stroke="white" strokeWidth="1.5" />
                          <rect x={x2p + 8} y={y2p - 13} width={92} height={13} rx="3" fill="rgba(15,23,42,0.9)" stroke={COLOR_SUB} strokeWidth="0.7" />
                          <text x={x2p + 54} y={y2p - 3} fill={COLOR_SUB} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700">
                            y₂={jumpData.y2.toFixed(2)}'
                          </text>
                          {/* ΔE annotation */}
                          <line x1={x1p} y1={margin.t + h + 30} x2={x2p} y2={margin.t + h + 30} stroke={COLOR_FAIL} strokeWidth="1" />
                          <text x={(x1p + x2p) / 2} y={margin.t + h + 42} fill={COLOR_FAIL} fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                            ΔE = {jumpData.dE.toFixed(2)} ft
                          </text>
                        </g>
                      );
                    })()}

                    {/* Axes */}
                    <line x1={margin.l} y1={margin.t} x2={margin.l} y2={margin.t + h} stroke="#475569" strokeWidth="2" />
                    <line x1={margin.l} y1={margin.t + h} x2={margin.l + w} y2={margin.t + h} stroke="#475569" strokeWidth="2" />
                    <text x={margin.l + w / 2} y={margin.t + h + 32} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="var(--font-mono)">Specific Energy E (ft)</text>
                    <text x={margin.l - 45} y={margin.t + h / 2} fill="#94a3b8" fontSize="10" textAnchor="middle" transform={`rotate(-90,${margin.l - 45},${margin.t + h / 2})`} fontFamily="var(--font-mono)">Depth y (ft)</text>

                    {/* Labels */}
                    <text x={margin.l + 8} y={margin.t + 14} fill="#94a3b8" fontSize="9" fontFamily="var(--font-mono)" fontWeight="700">Specific Energy Diagram — E = y + Q²/(2gA²)</text>

                    {/* Sub/Super labels */}
                    <text x={eX(Emin) - 30} y={margin.t + 30} fill={COLOR_SUPER} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" opacity="0.7">Super-</text>
                    <text x={eX(Emin) - 30} y={margin.t + 42} fill={COLOR_SUPER} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" opacity="0.7">critical</text>
                    <text x={eX(Emin) + 45} y={margin.t + 30} fill={COLOR_SUB} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" opacity="0.7">Sub-</text>
                    <text x={eX(Emin) + 45} y={margin.t + 42} fill={COLOR_SUB} fontSize="8.5" textAnchor="middle" fontFamily="var(--font-mono)" opacity="0.7">critical</text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* ── Derivation Modal ─────────────────────────────────────────────── */}
        {showDerivation && createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(2,6,23,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }} onClick={() => setShowDerivation(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))',
              border: '1px solid rgba(99,102,241,0.4)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '700px', width: '95vw',
              maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 25px 80px rgba(0,0,0,0.7)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'var(--accent-blue)', fontSize: '1.2rem', fontFamily: 'var(--font-mono)', fontWeight: '800' }}>
                  📐 Channel Hydraulics — Step-by-Step Derivation
                </h3>
                <button onClick={() => setShowDerivation(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              {[
                {
                  title: 'Step 1: Channel Geometry at Normal Depth yₙ',
                  color: 'var(--accent-blue)',
                  content: (
                    <>
                      Channel type: {channelType} (b = {bEff} ft, z = {zEff}:1)<br />
                      Flow Area: A = (b + zy)·y = ({bEff} + {zEff}·{yn.toFixed(2)})·{yn.toFixed(2)} = <strong>{calcs.geoN.A.toFixed(3)} ft²</strong><br />
                      Wetted Perimeter: P = b + 2y·√(1+z²) = {bEff} + 2·{yn.toFixed(2)}·√(1+{zEff}²) = <strong>{calcs.geoN.P.toFixed(3)} ft</strong><br />
                      Hydraulic Radius: R = A/P = {calcs.geoN.A.toFixed(3)}/{calcs.geoN.P.toFixed(3)} = <strong>{calcs.geoN.R.toFixed(4)} ft</strong><br />
                      Top Width: T = b + 2zy = {bEff} + 2·{zEff}·{yn.toFixed(2)} = <strong>{(bEff + 2 * zEff * yn).toFixed(3)} ft</strong><br />
                      Hydraulic Depth: Dh = A/T = <strong>{calcs.geoN.Dh.toFixed(4)} ft</strong>
                    </>
                  )
                },
                {
                  title: `Step 2: Manning's Equation — Normal Depth Solution`,
                  color: COLOR_SAFE,
                  content: (
                    <>
                      Q = (1.49/n) · A · R^(2/3) · S₀^(1/2)<br />
                      Q = (1.49/{n}) · {calcs.geoN.A.toFixed(3)} · {calcs.geoN.R.toFixed(4)}^(2/3) · √({S0.toFixed(4)})<br />
                      Q = {(1.49 / n).toFixed(3)} · {calcs.geoN.A.toFixed(3)} · {Math.pow(calcs.geoN.R, 2 / 3).toFixed(4)} · {Math.sqrt(S0).toFixed(5)}<br />
                      Q = <strong>{manningsQ(yn, bEff, zEff, n, S0).toFixed(2)} cfs</strong> (target: {Q} cfs ✓)<br /><br />
                      Normal Depth: <strong>yₙ = {yn.toFixed(3)} ft</strong> (solved by bisection iteration)
                    </>
                  )
                },
                {
                  title: 'Step 3: Critical Depth — Froude Criterion',
                  color: COLOR_CRIT,
                  content: (
                    <>
                      Critical condition: Q²T / (gA³) = 1<br />
                      {channelType === 'rectangular'
                        ? <>Rectangular closed-form: yc = (Q²/gb²)^(1/3) = ({Q}²/{G}·{bEff}²)^(1/3) = <strong>{yc.toFixed(3)} ft</strong></>
                        : <>Solved iteratively (bisection): <strong>yc = {yc.toFixed(3)} ft</strong></>
                      }<br /><br />
                      Minimum Specific Energy: Emin = yc + Q²/(2g·Ac²·Tc/Ac)<br />
                      Emin = yc + V²/(2g) at yc = <strong>{Emin.toFixed(3)} ft</strong><br /><br />
                      Slope Classification: S₀ = {S0.toFixed(4)} vs Sc = {calcs.Sc.toFixed(5)}<br />
                      → <strong>{calcs.slopeClass} Slope</strong> ({isMild ? 'S₀ < Sc → yₙ > yc → Subcritical' : 'S₀ > Sc → yₙ < yc → Supercritical'})
                    </>
                  )
                },
                {
                  title: 'Step 4: Froude Number & Flow Regime',
                  color: frColor,
                  content: (
                    <>
                      At Normal Depth yₙ = {yn.toFixed(3)} ft:<br />
                      Velocity: V = Q/A = {Q}/{calcs.geoN.A.toFixed(3)} = {calcs.Vn.toFixed(3)} ft/s<br />
                      Wave celerity: c = √(g·Dh) = √({G}·{calcs.geoN.Dh.toFixed(4)}) = {Math.sqrt(G * calcs.geoN.Dh).toFixed(3)} ft/s<br />
                      <strong>Froude Number: Fr = V/c = {calcs.Vn.toFixed(3)}/{Math.sqrt(G * calcs.geoN.Dh).toFixed(3)} = {Frn.toFixed(4)}</strong><br />
                      Flow Regime: {regimeN} (Fr {Frn < 1 ? '<' : '>'} 1.0)<br /><br />
                      At Upstream Depth y₁ = {y1.toFixed(2)} ft:<br />
                      Fr₁ = {Fr1.toFixed(4)} → {calcs.regime1}
                    </>
                  )
                },
                hasJump ? {
                  title: 'Step 5: Hydraulic Jump — Conjugate Depth & Energy Dissipation',
                  color: COLOR_FAIL,
                  content: (
                    <>
                      Upstream: y₁ = {y1.toFixed(2)} ft, V₁ = {calcs.V1.toFixed(3)} ft/s, Fr₁ = {Fr1.toFixed(4)} &gt; 1 → SUPERCRITICAL<br /><br />
                      {channelType === 'rectangular'
                        ? <>Rectangular closed-form conjugate depth:<br />
                          y₂/y₁ = ½·(-1 + √(1 + 8·Fr₁²))<br />
                          y₂ = {y1.toFixed(2)}/2 · (-1 + √(1 + 8·{Fr1.toFixed(4)}²))<br />
                        </>
                        : <>Momentum function solved iteratively:<br />
                          M(y₁) = Q²/(gA₁) + A₁·ȳ₁ = M(y₂)<br />
                        </>
                      }
                      <strong>Conjugate (Sequent) Depth: y₂ = {jumpData.y2.toFixed(3)} ft</strong><br /><br />
                      Upstream specific energy: E₁ = y₁ + V₁²/2g = {jumpData.E1.toFixed(3)} ft<br />
                      Downstream specific energy: E₂ = y₂ + V₂²/2g = {jumpData.E2.toFixed(3)} ft<br />
                      <strong>Head Loss: ΔE = E₁ − E₂ = {jumpData.dE.toFixed(3)} ft ({((jumpData.dE / jumpData.E1) * 100).toFixed(1)}% of E₁ dissipated)</strong><br />
                      Jump Efficiency: η = E₂/E₁ = {jumpData.E2.toFixed(3)}/{jumpData.E1.toFixed(3)} = <strong>{calcs.jumpLengths.efficiency.toFixed(1)}%</strong><br />
                      Jump Classification: <strong>{calcs.jumpLengths.jumpType}</strong><br /><br />

                      ── Jump Length Formulas (4 Empirical Methods) ──<br /><br />

                      1) <strong>USBR / Peterka (1958)</strong> — Standard design formula:<br />
                      &nbsp;&nbsp;Lⱼ = 6.1·y₂ = 6.1 × {jumpData.y2.toFixed(3)} = <strong style={{color:'#f97316'}}>{calcs.jumpLengths.Lpeterka.toFixed(2)} ft</strong><br />
                      &nbsp;&nbsp;(Conservative; recommended for Fr₁ &gt; 4.5. Used in USBR stilling basin design.)<br /><br />

                      2) <strong>Chow (1959)</strong> — Based on depth difference:<br />
                      &nbsp;&nbsp;Lⱼ = 6.9·(y₂ − y₁) = 6.9 × ({jumpData.y2.toFixed(3)} − {y1.toFixed(3)}) = 6.9 × {(jumpData.y2 - y1).toFixed(3)}<br />
                      &nbsp;&nbsp;= <strong style={{color:'#f97316'}}>{calcs.jumpLengths.Lchow.toFixed(2)} ft</strong> (Chow, Open Channel Hydraulics)<br /><br />

                      3) <strong>Silvester (1964)</strong> — Fr₁-based power law:<br />
                      &nbsp;&nbsp;Lⱼ = 9.75·y₁·(Fr₁ − 1)^1.01<br />
                      &nbsp;&nbsp;= 9.75 × {y1.toFixed(3)} × ({Fr1.toFixed(4)} − 1)^1.01<br />
                      &nbsp;&nbsp;= 9.75 × {y1.toFixed(3)} × {Math.pow(Math.max(Fr1 - 1, 0.01), 1.01).toFixed(4)}<br />
                      &nbsp;&nbsp;= <strong style={{color:'#f97316'}}>{calcs.jumpLengths.Lsilvester.toFixed(2)} ft</strong> (good for 1.7 &lt; Fr₁ &lt; 20)<br /><br />

                      4) <strong>Hager, Bremen &amp; Kawagoshi (1990)</strong> — Modern fitted:<br />
                      &nbsp;&nbsp;Lⱼ/y₁ = 8·Fr₁ − 12 → Lⱼ = y₁·(8·Fr₁ − 12)<br />
                      &nbsp;&nbsp;= {y1.toFixed(3)} × (8 × {Fr1.toFixed(4)} − 12) = {y1.toFixed(3)} × {(8 * Fr1 - 12).toFixed(4)}<br />
                      &nbsp;&nbsp;= <strong style={{color:'#f97316'}}>{calcs.jumpLengths.Lhager > 0 ? calcs.jumpLengths.Lhager.toFixed(2) : 'N/A (Fr₁ < 1.7)'} ft</strong> (valid Fr₁ = 1.7–18)<br /><br />

                      ── Summary Table ──<br />
                      Peterka: {calcs.jumpLengths.Lpeterka.toFixed(1)} ft · Chow: {calcs.jumpLengths.Lchow.toFixed(1)} ft · Silvester: {calcs.jumpLengths.Lsilvester.toFixed(1)} ft · Hager: {calcs.jumpLengths.Lhager > 0 ? calcs.jumpLengths.Lhager.toFixed(1) : 'N/A'} ft<br />
                      <strong>Design Lⱼ (conservative, USBR): {calcs.jumpLengths.Lpeterka.toFixed(1)} ft</strong>
                    </>
                  )
                } : {
                  title: 'Step 5: Hydraulic Jump — Not Present',
                  color: '#64748b',
                  content: <>No hydraulic jump. Fr₁ = {Fr1.toFixed(3)} ≤ 1.0 (flow is not supercritical upstream).<br />
                    To trigger a jump: drag y₁ below yc = {yc.toFixed(2)} ft so that Fr₁ &gt; 1.0.</>
                },
              ].map((step, i) => (
                <div key={i} style={{ marginBottom: '1.2rem' }}>
                  <h4 style={{ color: step.color, marginBottom: '0.4rem', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                    {step.title}
                  </h4>
                  <div className="math-block" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                    {step.content}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>

      <GenericProblemViewer problem={problem} />
    </div>
  );
};

export default ChannelHydraulicsVisualizer;
