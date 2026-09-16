import { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

const HAMMER_TYPES = {
  automatic: { name: 'Automatic Trip Hammer', er: 75, desc: 'High mechanical efficiency (70-80%), standard in modern practice.' },
  safety: { name: 'Safety Hammer (Rope & Cathead)', er: 60, desc: 'Standard baseline (approx. 60% energy ratio).' },
  donut: { name: 'Donut Hammer (Rope & Cathead)', er: 45, desc: 'Low efficiency (~45%), common in older historic records.' },
  hydraulic: { name: 'High-Efficiency Hydraulic Hammer', er: 85, desc: 'Instrumented hydraulic trip system (approx. 85%).' }
};

const BOREHOLE_DIAMETERS = {
  100: { label: '65 - 115 mm (2.5 - 4.5 in)', cb: 1.00 },
  150: { label: '150 mm (6.0 in)', cb: 1.05 },
  200: { label: '200 mm (8.0 in)', cb: 1.15 }
};

const SAMPLER_TYPES = {
  without_liner: { label: 'Standard Sampler WITHOUT Liner (ASTM)', cs: 1.20 },
  with_liner: { label: 'Standard Sampler WITH Liner (or dense soil)', cs: 1.00 }
};

// Rod length correction factor CR lookup function
function getRodLengthCorrection(depthFt) {
  const depthM = depthFt * 0.3048;
  if (depthM > 10) return 1.00;      // > 30 ft
  if (depthM >= 6) return 0.95;     // 20 - 30 ft
  if (depthM >= 4) return 0.85;     // 13 - 20 ft
  return 0.75;                      // 10 - 13 ft
}

const SPTVisualizer = ({ problem }) => {
  // State Initialization
  const [depth, setDepth] = useState(problem?.depth ?? 20); // ft
  const [gwt, setGwt] = useState(problem?.gwt ?? 8); // ft
  const [n1, setN1] = useState(problem?.n1 ?? 7); // 0-6 in seating
  const [n2, setN2] = useState(problem?.n2 ?? 10); // 6-12 in
  const [n3, setN3] = useState(problem?.n3 ?? 14); // 12-18 in
  const [gamma, setGamma] = useState(problem?.gamma ?? 120); // pcf (dry/moist above GWT)
  const [gammaSat, setGammaSat] = useState(problem?.gammaSat ?? 125); // pcf (submerged below GWT)
  const [hammerKey, setHammerKey] = useState('automatic');
  const [boreholeKey, setBoreholeKey] = useState(100);
  const [samplerKey, setSamplerKey] = useState('without_liner');
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('viewMode')) return params.get('viewMode');
    }
    return problem?.viewMode || 'rig';
  });
  const [showDerivation, setShowDerivation] = useState(false);

  // Sync state if problem changes
  const [prevProblem, setPrevProblem] = useState(problem);
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.depth !== undefined) setDepth(problem.depth);
    if (problem.gwt !== undefined) setGwt(problem.gwt);
    if (problem.n1 !== undefined) setN1(problem.n1);
    if (problem.n2 !== undefined) setN2(problem.n2);
    if (problem.n3 !== undefined) setN3(problem.n3);
    if (problem.gamma !== undefined) setGamma(problem.gamma);
    if (problem.gammaSat !== undefined) setGammaSat(problem.gammaSat);
    if (problem.er !== undefined) {
      if (problem.er >= 80) setHammerKey('hydraulic');
      else if (problem.er >= 70) setHammerKey('automatic');
      else if (problem.er >= 55) setHammerKey('safety');
      else setHammerKey('donut');
    }
    if (problem.cs !== undefined) {
      setSamplerKey(problem.cs === 1.0 ? 'with_liner' : 'without_liner');
    }
  }

  // Active parameter lookups
  const hammer = HAMMER_TYPES[hammerKey] || HAMMER_TYPES.automatic;
  const cb = BOREHOLE_DIAMETERS[boreholeKey]?.cb ?? 1.00;
  const cs = SAMPLER_TYPES[samplerKey]?.cs ?? 1.20;
  const cr = getRodLengthCorrection(depth);
  const ce = hammer.er / 60;

  // 1. Uncorrected Field SPT N-value (ASTM D1586)
  // First 6 inches is seating drive and discarded!
  const nField = n2 + n3;
  const totalBlowsAllIncrements = n1 + n2 + n3;

  // 2. Energy-Corrected N60
  const n60 = nField * ce * cb * cs * cr;

  // 3. Overburden Stress Calculation at Test Depth z
  const gammaW = 62.4; // pcf (water)
  const gammaPrime = Math.max(gammaSat - gammaW, 10); // buoyant unit weight

  let sigmaVo; // total vertical stress
  let porePressure; // hydrostatic pressure
  let sigmaPrimeVo; // effective vertical stress

  if (depth <= gwt) {
    // Completely above water table
    sigmaVo = gamma * depth;
    porePressure = 0;
    sigmaPrimeVo = sigmaVo;
  } else {
    // Water table above test depth
    const hDry = gwt;
    const hSub = depth - gwt;
    sigmaVo = (gamma * hDry) + (gammaSat * hSub);
    porePressure = gammaW * hSub;
    sigmaPrimeVo = (gamma * hDry) + (gammaPrime * hSub);
  }

  // 4. Overburden Stress Correction Factor CN
  // Pa = 2,000 psf (1 atm ≈ 100 kPa)
  const pa = 2000;
  const cnUncapped = Math.sqrt(pa / Math.max(sigmaPrimeVo, 100));
  const cn = Math.min(Math.max(cnUncapped, 0.4), 1.70); // capped at 1.70 per standard practice

  // 5. Normalized (N1)60
  const n160 = n60 * cn;

  // 6. Empirical Soil Consistency & Relative Density Dr
  const getDensityClassification = (val) => {
    if (val < 5) return { text: 'Very Loose', range: 'Dr < 15%', color: 'var(--accent-rose)' };
    if (val <= 10) return { text: 'Loose', range: '15% ≤ Dr ≤ 35%', color: 'var(--accent-amber)' };
    if (val <= 30) return { text: 'Medium Dense', range: '35% ≤ Dr ≤ 65%', color: 'var(--accent-blue)' };
    if (val <= 50) return { text: 'Dense', range: '65% ≤ Dr ≤ 85%', color: 'var(--accent-emerald)' };
    return { text: 'Very Dense', range: 'Dr > 85%', color: 'var(--accent-purple)' };
  };

  const density = getDensityClassification(n160);

  // 7. Estimated Internal Friction Angle φ' (Wolff 1989 / Peck-Hanson-Thornburn)
  // φ' ≈ 27.1 + 0.3 * (N1)60 - 0.00054 * (N1)60^2
  const phiEstimate = Math.min(Math.max(27.1 + (0.3 * n160) - (0.00054 * Math.pow(n160, 2)), 28), 45);

  // SVG Scalings
  const svgWidth = 600;
  const svgHeight = 420;
  const groundY = 110;
  const rigX = 170;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Workbench Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) minmax(420px, 1.4fr)', gap: '2.5rem', alignItems: 'start' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🔨</span> Standard Penetration Test (SPT)
                </h3>
                <p className="text-xs text-muted">ASTM D1586 / AASHTO T206: Energy Standardization & Overburden Normalization</p>
              </div>
              <span className="glass-badge" style={{ color: density.color, borderColor: density.color }}>
                {density.text} (Dr: {density.range})
              </span>
            </div>

            {/* Quick Scenario Preset Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                onClick={() => {
                  setDepth(20);
                  setGwt(8);
                  setN1(7);
                  setN2(10);
                  setN3(14);
                  setGamma(120);
                  setGammaSat(125);
                  setHammerKey('automatic');
                  setSamplerKey('without_liner');
                }}
              >
                🎯 Problem #106 Baseline
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                onClick={() => {
                  setDepth(15);
                  setGwt(4);
                  setN1(3);
                  setN2(4);
                  setN3(5);
                  setGamma(115);
                  setGammaSat(122);
                  setHammerKey('safety');
                  setSamplerKey('without_liner');
                }}
              >
                🌊 Loose Sand (High GWT)
              </button>
              <button 
                className="btn-secondary" 
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                onClick={() => {
                  setDepth(35);
                  setGwt(12);
                  setN1(12);
                  setN2(18);
                  setN3(24);
                  setGamma(125);
                  setGammaSat(132);
                  setHammerKey('hydraulic');
                  setSamplerKey('with_liner');
                }}
              >
                ⛏️ Deep Dense Gravelly Sand
              </button>
            </div>

            {/* Drive Increments (The 3 Six-Inch Drives) */}
            <div className="control-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  Split-Spoon 6-Inch Drive Increments
                </label>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  Raw N = {n2} + {n3} = {nField} blows/ft
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                {/* 0 - 6 in Seating */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>0-6" (Seating)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n1}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="35" 
                    value={n1} 
                    onChange={(e) => setN1(parseInt(e.target.value, 10))} 
                  />
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-rose)', marginTop: '0.15rem' }}>
                    ✗ Discarded
                  </div>
                </div>

                {/* 6 - 12 in Counted */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>6-12" (N2)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n2}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="45" 
                    value={n2} 
                    onChange={(e) => setN2(parseInt(e.target.value, 10))} 
                  />
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', marginTop: '0.15rem' }}>
                    ✓ Counted
                  </div>
                </div>

                {/* 12 - 18 in Counted */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.2rem' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>12-18" (N3)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n3}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="45" 
                    value={n3} 
                    onChange={(e) => setN3(parseInt(e.target.value, 10))} 
                  />
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', marginTop: '0.15rem' }}>
                    ✓ Counted
                  </div>
                </div>
              </div>
            </div>

            {/* Test Depth & Groundwater Table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Test Depth z */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Test Depth (z)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {depth.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="50" 
                  step="1" 
                  value={depth} 
                  onChange={(e) => setDepth(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>5.0 ft</span>
                  <span>CR = {cr.toFixed(2)}</span>
                  <span>50.0 ft</span>
                </div>
              </div>

              {/* Water Table GWT */}
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Water Table (GWT)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                    {gwt.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="35" 
                  step="1" 
                  value={gwt} 
                  onChange={(e) => setGwt(parseFloat(e.target.value))} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                  <span>0 ft (Surface)</span>
                  <span>u = {porePressure.toFixed(0)} psf</span>
                  <span>35.0 ft</span>
                </div>
              </div>
            </div>

            {/* Hammer System & Energy Ratio */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                  Hammer Type & Energy Ratio (ERm)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', fontSize: '0.9rem' }}>
                  ERm = {hammer.er}% (CE = {ce.toFixed(2)})
                </span>
              </div>
              <select
                value={hammerKey}
                onChange={(e) => setHammerKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem'
                }}
              >
                {Object.entries(HAMMER_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name} (ERm = {v.er}%)
                  </option>
                ))}
              </select>
              <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                {hammer.desc}
              </div>
            </div>

            {/* Borehole Diameter & Sampler Liner */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Borehole Diameter */}
              <div className="control-group">
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                  Borehole Diameter (CB)
                </label>
                <select
                  value={boreholeKey}
                  onChange={(e) => setBoreholeKey(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value={100}>100 mm (CB = 1.00)</option>
                  <option value={150}>150 mm (CB = 1.05)</option>
                  <option value={200}>200 mm (CB = 1.15)</option>
                </select>
              </div>

              {/* Sampler Liner */}
              <div className="control-group">
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                  Sampler Liner (CS)
                </label>
                <select
                  value={samplerKey}
                  onChange={(e) => setSamplerKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="without_liner">Without Liner (CS = 1.20)</option>
                  <option value="with_liner">With Liner (CS = 1.00)</option>
                </select>
              </div>
            </div>

            {/* Soil Unit Weights */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                  <span className="text-muted">Dry Unit Wt (γ)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{gamma} pcf</span>
                </div>
                <input 
                  type="range" 
                  min="95" 
                  max="135" 
                  step="1" 
                  value={gamma} 
                  onChange={(e) => setGamma(parseFloat(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                  <span className="text-muted">Sat Unit Wt (γsat)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{gammaSat} pcf</span>
                </div>
                <input 
                  type="range" 
                  min="110" 
                  max="145" 
                  step="1" 
                  value={gammaSat} 
                  onChange={(e) => setGammaSat(parseFloat(e.target.value))} 
                />
              </div>
            </div>

            {/* Derivation Modal Trigger */}
            <button 
              className="btn-secondary" 
              style={{ width: '100%', padding: '0.65rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem' }}
              onClick={() => setShowDerivation(true)}
            >
              <span>📐</span> View Full ASTM D1586 Derivation
            </button>
          </div>

          {/* Visualization Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* View Mode Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>Interactive SPT Borehole & Stress Graphics</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'rig' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    borderColor: viewMode === 'rig' ? 'var(--accent-blue)' : 'transparent',
                    color: viewMode === 'rig' ? 'var(--accent-blue)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('rig')}
                >
                  Borehole & Drive Rig
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'stress' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    borderColor: viewMode === 'stress' ? 'var(--accent-amber)' : 'transparent',
                    color: viewMode === 'stress' ? 'var(--accent-amber)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('stress')}
                >
                  Overburden Stress σ'v
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    padding: '0.25rem 0.55rem',
                    fontSize: '0.72rem',
                    background: viewMode === 'correlations' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    borderColor: viewMode === 'correlations' ? 'var(--accent-emerald)' : 'transparent',
                    color: viewMode === 'correlations' ? 'var(--accent-emerald)' : 'var(--text-dim)'
                  }}
                  onClick={() => setViewMode('correlations')}
                >
                  Dr & φ' Correlations
                </button>
              </div>
            </div>

            {/* Dynamic Interactive SVG Canvas */}
            <div style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(2,6,23,0.9) 100%)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '0.75rem', position: 'relative' }}>
              
              <svg 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                <defs>
                  {/* Procedural soil patterns */}
                  <pattern id="spt-sand-pattern" width="14" height="14" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill="#ca8a04" opacity="0.4" />
                    <circle cx="9" cy="8" r="1" fill="#eab308" opacity="0.35" />
                    <circle cx="5" cy="12" r="0.8" fill="#a16207" opacity="0.3" />
                  </pattern>

                  <linearGradient id="spt-water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                  </linearGradient>

                  <linearGradient id="hammer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="50%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>

                {/* View 1: Rig & Borehole */}
                {viewMode === 'rig' && (
                  <g>
                    {/* Sky Above Ground */}
                    <rect x="20" y="10" width={svgWidth - 40} height={groundY - 10} fill="rgba(15,23,42,0.3)" />

                    {/* Subgrade Soil Layers */}
                    {/* Upper Dry Soil */}
                    <rect 
                      x="20" 
                      y={groundY} 
                      width={svgWidth - 40} 
                      height={Math.min((gwt / 50) * 280, 280)} 
                      fill="url(#spt-sand-pattern)" 
                    />
                    <rect 
                      x="20" 
                      y={groundY} 
                      width={svgWidth - 40} 
                      height={Math.min((gwt / 50) * 280, 280)} 
                      fill="rgba(180, 83, 9, 0.08)" 
                    />

                    {/* Groundwater Submerged Soil Zone */}
                    {gwt < 50 && (
                      <g>
                        <rect 
                          x="20" 
                          y={groundY + Math.min((gwt / 50) * 280, 280)} 
                          width={svgWidth - 40} 
                          height={svgHeight - (groundY + Math.min((gwt / 50) * 280, 280)) - 10} 
                          fill="url(#spt-water-gradient)" 
                        />
                        {/* Water Table Line */}
                        <line 
                          x1="20" 
                          y1={groundY + Math.min((gwt / 50) * 280, 280)} 
                          x2={svgWidth - 20} 
                          y2={groundY + Math.min((gwt / 50) * 280, 280)} 
                          stroke="#38bdf8" 
                          strokeWidth="2" 
                          strokeDasharray="6,4" 
                        />
                        <text 
                          x={svgWidth - 140} 
                          y={groundY + Math.min((gwt / 50) * 280, 280) - 6} 
                          fill="#38bdf8" 
                          fontSize="10" 
                          fontWeight="700" 
                          fontFamily="var(--font-mono)"
                        >
                          ▼ G.W.T. (z = {gwt.toFixed(1)}')
                        </text>
                      </g>
                    )}

                    {/* Ground Surface Line */}
                    <line x1="20" y1={groundY} x2={svgWidth - 20} y2={groundY} stroke="#65a30d" strokeWidth="3" />
                    <text x="26" y={groundY - 6} fill="#84cc16" fontSize="10" fontWeight="700">
                      Ground Surface (z = 0)
                    </text>

                    {/* Tripod Drill Rig Above Ground */}
                    <g opacity="0.9">
                      <line x1={rigX - 45} y1={groundY} x2={rigX} y2="20" stroke="#94a3b8" strokeWidth="3" />
                      <line x1={rigX + 45} y1={groundY} x2={rigX} y2="20" stroke="#94a3b8" strokeWidth="3" />
                      <circle cx={rigX} cy="20" r="5" fill="#e2e8f0" />

                      {/* 140 lb Hammer & 30" Drop Guide */}
                      <rect x={rigX - 16} y="32" width="32" height="22" fill="url(#hammer-gradient)" rx="3" stroke="#1e293b" strokeWidth="1" />
                      <text x={rigX} y="47" fill="#f8fafc" fontSize="8" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                        140 lb
                      </text>

                      {/* 30-inch Drop Dimension Line */}
                      <line x1={rigX + 22} y1="32" x2={rigX + 22} y2="72" stroke="var(--accent-amber)" strokeWidth="1.5" />
                      <line x1={rigX + 18} y1="32" x2={rigX + 26} y2="32" stroke="var(--accent-amber)" strokeWidth="1.5" />
                      <line x1={rigX + 18} y1="72" x2={rigX + 26} y2="72" stroke="var(--accent-amber)" strokeWidth="1.5" />
                      <text x={rigX + 30} y="56" fill="var(--accent-amber)" fontSize="9" fontWeight="700" fontFamily="var(--font-mono)">
                        30" Drop
                      </text>

                      {/* Anvil */}
                      <rect x={rigX - 12} y="74" width="24" height="8" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
                    </g>

                    {/* Borehole Casing & Drill Rods */}
                    {/* Borehole Casing Tube */}
                    <rect x={rigX - 18} y={groundY} width="36" height={Math.min(depth * 5.2, 230)} fill="#1e293b" opacity="0.6" />
                    <line x1={rigX - 18} y1={groundY} x2={rigX - 18} y2={groundY + Math.min(depth * 5.2, 230)} stroke="#64748b" strokeWidth="2" />
                    <line x1={rigX + 18} y1={groundY} x2={rigX + 18} y2={groundY + Math.min(depth * 5.2, 230)} stroke="#64748b" strokeWidth="2" />

                    {/* Drill Rod Centered */}
                    <line x1={rigX} y1="82" x2={rigX} y2={groundY + Math.min(depth * 5.2, 230)} stroke="#e2e8f0" strokeWidth="4" />

                    {/* Split-Barrel Sampler Graphic on the Right (Enlarged Detail) */}
                    <g transform="translate(320, 100)">
                      <rect x="0" y="0" width="250" height="295" fill="rgba(15,23,42,0.85)" stroke="var(--border-color)" rx="8" />
                      
                      <text x="15" y="24" fill="var(--text-muted)" fontSize="10" fontWeight="700" style={{ textTransform: 'uppercase' }}>
                        Split-Barrel Sampler (2.0" OD)
                      </text>
                      <text x="15" y="38" fill="var(--accent-blue)" fontSize="12" fontWeight="800" fontFamily="var(--font-mono)">
                        Depth z = {depth.toFixed(1)} ft
                      </text>

                      {/* Sampler Tube Representation */}
                      <g transform="translate(30, 55)">
                        {/* Increment 1: 0 - 6 in Seating */}
                        <rect x="0" y="0" width="36" height="55" fill="rgba(244, 63, 94, 0.25)" stroke="#f43f5e" strokeWidth="1.5" />
                        <text x="44" y="24" fill="#f43f5e" fontSize="11" fontWeight="700">
                          0 - 6" Seating: {n1} blows
                        </text>
                        <text x="44" y="40" fill="var(--text-dim)" fontSize="9">
                          ✗ Discarded (Disturbed soil)
                        </text>

                        {/* Increment 2: 6 - 12 in Counted */}
                        <rect x="0" y="55" width="36" height="55" fill="rgba(6, 182, 212, 0.25)" stroke="var(--accent-cyan)" strokeWidth="1.5" />
                        <text x="44" y="80" fill="var(--accent-cyan)" fontSize="11" fontWeight="700">
                          6 - 12" (N2): {n2} blows
                        </text>
                        <text x="44" y="96" fill="var(--text-dim)" fontSize="9">
                          ✓ Counted in N-value
                        </text>

                        {/* Increment 3: 12 - 18 in Counted */}
                        <rect x="0" y="110" width="36" height="55" fill="rgba(16, 185, 129, 0.25)" stroke="var(--accent-emerald)" strokeWidth="1.5" />
                        <text x="44" y="136" fill="var(--accent-emerald)" fontSize="11" fontWeight="700">
                          12 - 18" (N3): {n3} blows
                        </text>
                        <text x="44" y="152" fill="var(--text-dim)" fontSize="9">
                          ✓ Counted in N-value
                        </text>

                        {/* Cutting Shoe Tip */}
                        <polygon points="0,165 36,165 18,185" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
                        <text x="44" y="180" fill="var(--text-dim)" fontSize="9">
                          Hardened Steel Shoe Tip
                        </text>

                        {/* ASTM Sum Bracket for N = N2 + N3 */}
                        <line x1="-10" y1="55" x2="-10" y2="165" stroke="var(--accent-amber)" strokeWidth="2" />
                        <line x1="-6" y1="55" x2="-14" y2="55" stroke="var(--accent-amber)" strokeWidth="2" />
                        <line x1="-6" y1="165" x2="-14" y2="165" stroke="var(--accent-amber)" strokeWidth="2" />
                        <text 
                          x="-18" 
                          y="114" 
                          fill="var(--accent-amber)" 
                          fontSize="11" 
                          fontWeight="800" 
                          textAnchor="end" 
                          fontFamily="var(--font-mono)"
                        >
                          N = {nField}
                        </text>
                      </g>

                      {/* Formula Box Inside Detail Panel */}
                      <rect x="15" y="250" width="220" height="34" fill="rgba(255,255,255,0.03)" stroke="var(--border-color)" rx="4" />
                      <text x="25" y="271" fill="var(--accent-cyan)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="700">
                        N60 = N · (ER/60) · CB · CS · CR = {n60.toFixed(1)}
                      </text>
                    </g>
                  </g>
                )}

                {/* View 2: Overburden Stress Profile */}
                {viewMode === 'stress' && (
                  <g>
                    <text x="30" y="35" fill="var(--text-main)" fontSize="13" fontWeight="700">
                      Overburden Stress Profile (σvo vs. Effective Stress σ'vo)
                    </text>
                    <text x="30" y="52" fill="var(--text-dim)" fontSize="10">
                      Depth vs. Vertical Effective Stress at z = {depth.toFixed(1)} ft
                    </text>

                    {/* Stress Profile Axes */}
                    <g transform="translate(80, 75)">
                      {/* Depth Axis (Downwards) */}
                      <line x1="0" y1="0" x2="0" y2="280" stroke="#64748b" strokeWidth="1.5" />
                      <text x="-10" y="140" fill="var(--text-muted)" fontSize="10" textAnchor="middle" transform="rotate(-90 -10 140)">
                        Depth z (ft)
                      </text>

                      {/* Stress Axis (Rightwards) */}
                      <line x1="0" y1="0" x2="420" y2="0" stroke="#64748b" strokeWidth="1.5" />
                      <text x="210" y="-10" fill="var(--text-muted)" fontSize="10" textAnchor="middle">
                        Vertical Stress (psf)
                      </text>

                      {/* Grid lines */}
                      {[1000, 2000, 3000].map((val) => (
                        <g key={val}>
                          <line x1={val * 0.12} y1="0" x2={val * 0.12} y2="280" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                          <text x={val * 0.12} y="-2" fill="var(--text-dim)" fontSize="8" textAnchor="middle">
                            {val}
                          </text>
                        </g>
                      ))}

                      {/* Water Table Horizontal Marker */}
                      <line x1="0" y1={Math.min(gwt * 5.6, 280)} x2="420" y2={Math.min(gwt * 5.6, 280)} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5,3" />
                      <text x="320" y={Math.min(gwt * 5.6, 280) - 6} fill="#38bdf8" fontSize="9" fontWeight="700">
                        GWT (z = {gwt.toFixed(1)}')
                      </text>

                      {/* Total Stress Curve σvo (Red) */}
                      <path 
                        d={`M 0 0 L ${(gamma * Math.min(depth, gwt)) * 0.12} ${Math.min(gwt * 5.6, 280)} L ${sigmaVo * 0.12} ${Math.min(depth * 5.6, 280)}`} 
                        fill="none" 
                        stroke="#f43f5e" 
                        strokeWidth="2.5" 
                      />

                      {/* Effective Stress Curve σ'vo (Emerald) */}
                      <path 
                        d={`M 0 0 L ${(gamma * Math.min(depth, gwt)) * 0.12} ${Math.min(gwt * 5.6, 280)} L ${sigmaPrimeVo * 0.12} ${Math.min(depth * 5.6, 280)}`} 
                        fill="none" 
                        stroke="var(--accent-emerald)" 
                        strokeWidth="2.5" 
                      />

                      {/* Test Depth Line */}
                      <line x1="0" y1={Math.min(depth * 5.6, 280)} x2="420" y2={Math.min(depth * 5.6, 280)} stroke="var(--accent-blue)" strokeWidth="1" strokeDasharray="4,2" />
                      <circle cx={sigmaPrimeVo * 0.12} cy={Math.min(depth * 5.6, 280)} r="5" fill="var(--accent-emerald)" />

                      {/* Labels */}
                      <text x={sigmaPrimeVo * 0.12 + 10} y={Math.min(depth * 5.6, 280) + 4} fill="var(--accent-emerald)" fontSize="11" fontWeight="800" fontFamily="var(--font-mono)">
                        σ'vo = {sigmaPrimeVo.toFixed(0)} psf
                      </text>
                      <text x={sigmaVo * 0.12 + 10} y={Math.min(depth * 5.6, 280) - 10} fill="#f43f5e" fontSize="9" fontFamily="var(--font-mono)">
                        σvo = {sigmaVo.toFixed(0)} psf
                      </text>
                    </g>
                  </g>
                )}

                {/* View 3: Relative Density & Friction Angle Correlations */}
                {viewMode === 'correlations' && (
                  <g>
                    <text x="30" y="32" fill="var(--text-main)" fontSize="13" fontWeight="700">
                      Empirical Soil Correlations: (N1)60 vs. Relative Density & Friction Angle
                    </text>
                    <text x="30" y="48" fill="var(--text-dim)" fontSize="10">
                      Based on Peck, Hanson & Thornburn and Wolff (1989) empirical charts for granular soils
                    </text>

                    {/* Correlation Table & Chart */}
                    <g transform="translate(30, 70)">
                      {/* Density Zones */}
                      {[
                        { label: 'Very Loose', range: '0 - 4', phi: '< 28°', bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e' },
                        { label: 'Loose', range: '4 - 10', phi: '28° - 30°', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
                        { label: 'Medium Dense', range: '10 - 30', phi: '30° - 36°', bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8' },
                        { label: 'Dense', range: '30 - 50', phi: '36° - 41°', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' },
                        { label: 'Very Dense', range: '> 50', phi: '> 41°', bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7' }
                      ].map((item, idx) => {
                        const yPos = idx * 48;
                        const isCurrent = density.text === item.label;
                        return (
                          <g key={item.label}>
                            <rect 
                              x="0" 
                              y={yPos} 
                              width="540" 
                              height="42" 
                              fill={isCurrent ? item.bg : 'rgba(255,255,255,0.02)'} 
                              stroke={isCurrent ? item.border : 'var(--border-color)'} 
                              strokeWidth={isCurrent ? 2 : 1} 
                              rx="6" 
                            />
                            <text x="15" y={yPos + 26} fill={item.border} fontSize="12" fontWeight="700">
                              {item.label} {isCurrent && '◀ CURRENT'}
                            </text>
                            <text x="180" y={yPos + 26} fill="var(--text-main)" fontSize="11" fontFamily="var(--font-mono)">
                              (N1)60: {item.range}
                            </text>
                            <text x="320" y={yPos + 26} fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-mono)">
                              Est. φ': {item.phi}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </g>
                )}
              </svg>
            </div>

            {/* Performance Indicators Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
              
              {/* Raw Field N */}
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Raw Field N-Value
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {nField} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>blows/ft</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  N2 ({n2}) + N3 ({n3}) • N1 ({n1}) Discarded
                </div>
              </div>

              {/* Energy Corrected N60 */}
              <div className="glass-card" style={{ padding: '0.85rem' }}>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Energy Corrected N60
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {n60.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>blows/ft</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  CE = {ce.toFixed(2)} • CS = {cs.toFixed(2)} • CR = {cr.toFixed(2)}
                </div>
              </div>

              {/* Overburden Normalized (N1)60 */}
              <div className="glass-card" style={{ padding: '0.85rem', borderColor: density.color }}>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Normalized (N1)60
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: density.color, fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
                  {n160.toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>blows/ft</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  CN = {cn.toFixed(3)} • Est. φ' ≈ {phiEstimate.toFixed(1)}°
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Embedded Generic Problem Viewer */}
      {problem && (
        <GenericProblemViewer problem={problem} />
      )}

      {/* Engineering Derivation Modal */}
      {showDerivation && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}
          onClick={() => setShowDerivation(false)}
        >
          <div 
            className="glass-panel" 
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2.5rem',
              position: 'relative',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📐</span> Standard Penetration Test (SPT) Complete ASTM D1586 Derivation
                </h3>
                <p className="text-xs text-muted">Field N Data Reduction, Equipment Energy Ratio, Effective Overburden & (N1)60 Normalization</p>
              </div>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                onClick={() => setShowDerivation(false)}
              >
                ✕ Close
              </button>
            </div>

            {/* Derivation Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              
              {/* Step 1: ASTM D1586 Raw N-Value */}
              <div>
                <h4 style={{ color: 'var(--accent-rose)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 1: Uncorrected Field N-Value & Seating Drive Rule
                </h4>
                <p className="text-sm">
                  The split-barrel sampler is driven 18 inches (450 mm) in three 6-inch increments. The first 6 inches is the seating drive into disturbed cuttings and is always DISCARDED:
                </p>
                <div className="math-block">
                  Increment 1 (0 - 6 in): N1 = {n1} blows (Seating Drive → Excluded)
                  <br />
                  Increment 2 (6 - 12 in): N2 = {n2} blows
                  <br />
                  Increment 3 (12 - 18 in): N3 = {n3} blows
                  <br />
                  <strong>Uncorrected Field N = N2 + N3 = {n2} + {n3} = {nField} blows/ft</strong>
                  <br />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Total recorded blows = {totalBlowsAllIncrements} (Never use total blows!)
                  </span>
                </div>
              </div>

              {/* Step 2: Energy Standardization to N60 */}
              <div>
                <h4 style={{ color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 2: Energy & Equipment Correction to Baseline 60% Energy Ratio (N60)
                </h4>
                <p className="text-sm">
                  Field hammers transmit variable kinetic energy. The standard N60 normalizes blow counts to a 60% delivered energy ratio:
                </p>
                <div className="math-block">
                  N60 = N × (ERm / 60) × CB × CS × CR
                  <br />
                  • Energy Ratio Factor: CE = {hammer.er} / 60 = {ce.toFixed(3)}
                  <br />
                  • Borehole Diameter Factor: CB = {cb.toFixed(2)}
                  <br />
                  • Sampler Liner Factor: CS = {cs.toFixed(2)}
                  <br />
                  • Rod Length Factor: CR = {cr.toFixed(2)}
                  <br />
                  <strong>N60 = {nField} × {ce.toFixed(3)} × {cb.toFixed(2)} × {cs.toFixed(2)} × {cr.toFixed(2)} = {n60.toFixed(2)} ≈ {n60.toFixed(1)} blows/ft</strong>
                </div>
              </div>

              {/* Step 3: Effective Overburden Stress σ'vo */}
              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 3: Effective Vertical Overburden Stress (σ'vo) at Depth z = {depth.toFixed(1)} ft
                </h4>
                <p className="text-sm">
                  Overburden confinement increases penetration resistance. Below the water table (GWT = {gwt.toFixed(1)} ft), buoyant unit weight must be used:
                </p>
                <div className="math-block">
                  {depth <= gwt ? (
                    <>
                      • Soil is entirely above GWT:
                      <br />
                      σ'vo = γ · z = {gamma} pcf × {depth} ft = {sigmaPrimeVo.toFixed(1)} psf
                    </>
                  ) : (
                    <>
                      • Layer 1 (Above GWT, 0 to {gwt} ft): σv1 = {gamma} × {gwt} = {(gamma * gwt).toFixed(1)} psf
                      <br />
                      • Layer 2 (Below GWT, {gwt} to {depth} ft, Δz = {(depth - gwt).toFixed(1)} ft):
                      <br />
                      &nbsp;&nbsp;Buoyant Unit Wt: γ' = γsat - γw = {gammaSat} - 62.4 = {gammaPrime.toFixed(1)} pcf
                      <br />
                      &nbsp;&nbsp;Δσ'v = {(depth - gwt).toFixed(1)} × {gammaPrime.toFixed(1)} = {((depth - gwt) * gammaPrime).toFixed(1)} psf
                      <br />
                      <strong>Total Effective Overburden: σ'vo = {(gamma * gwt).toFixed(1)} + {((depth - gwt) * gammaPrime).toFixed(1)} = {sigmaPrimeVo.toFixed(1)} psf</strong>
                      <br />
                      Pore Water Pressure: u = 62.4 × {(depth - gwt).toFixed(1)} = {porePressure.toFixed(1)} psf
                    </>
                  )}
                </div>
              </div>

              {/* Step 4: Overburden Correction Factor CN & (N1)60 */}
              <div>
                <h4 style={{ color: density.color, marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 4: Overburden Normalization Factor (CN) & Normalized (N1)60
                </h4>
                <p className="text-sm">
                  Using the standard Liao & Whitman (1986) / NCEES overburden formula with reference pressure Pa = 2,000 psf (100 kPa):
                </p>
                <div className="math-block">
                  CN = (Pa / σ'vo)^0.5 = (2,000 / {sigmaPrimeVo.toFixed(1)})^0.5 = {cnUncapped.toFixed(4)} (Capped at 1.70 → CN = {cn.toFixed(4)})
                  <br />
                  <strong>(N1)60 = N60 × CN = {n60.toFixed(2)} × {cn.toFixed(4)} = {n160.toFixed(2)} ≈ {Math.round(n160)} blows/ft</strong>
                </div>
              </div>

              {/* Step 5: Engineering Soil State Evaluation */}
              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1.05rem' }}>
                  Step 5: Geotechnical Engineering State Classification
                </h4>
                <div className="math-block">
                  • Relative Density: {density.text} ({density.range})
                  <br />
                  • Estimated Effective Internal Friction Angle: φ' ≈ {phiEstimate.toFixed(1)}°
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default SPTVisualizer;
