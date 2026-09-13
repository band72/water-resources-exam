import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

const SlopeVisualizer = ({ problem }) => {
  const [alpha, setAlpha] = useState(problem?.alpha ?? 28); // degrees (slip inclination)
  const [weight, setWeight] = useState(problem?.weight ?? 85000); // lb/ft
  const [length, setLength] = useState(problem?.length ?? 36); // ft
  const [cohesion, setCohesion] = useState(problem?.cohesion ?? 250); // psf
  const [phi, setPhi] = useState(problem?.phi ?? 24); // degrees
  const [uplift, setUplift] = useState(problem?.uplift ?? 0); // lb/ft (pore water pressure)
  const [showDerivation, setShowDerivation] = useState(false);

  // Sync state if problem changes
  const [prevProblem, setPrevProblem] = useState(problem);
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.alpha !== undefined) setAlpha(problem.alpha);
    if (problem.weight !== undefined) setWeight(problem.weight);
    if (problem.length !== undefined) setLength(problem.length);
    if (problem.cohesion !== undefined) setCohesion(problem.cohesion);
    if (problem.phi !== undefined) setPhi(problem.phi);
    if (problem.uplift !== undefined) setUplift(problem.uplift);
    else setUplift(0);
  }

  // Trigonometry
  const alphaRad = (alpha * Math.PI) / 180;
  const phiRad = (phi * Math.PI) / 180;

  // 1. Driving Force (Mobilized Shear Force TMOB)
  const tMob = weight * Math.sin(alphaRad); // lb/ft

  // 2. Normal Force on Slip Surface
  const normalTotal = weight * Math.cos(alphaRad); // lb/ft
  const normalEffective = Math.max(normalTotal - uplift, 0); // lb/ft

  // 3. Frictional Resistance
  const tFrictional = normalEffective * Math.tan(phiRad); // lb/ft

  // 4. Cohesive Resistance
  const tCohesive = cohesion * length; // lb/ft

  // 5. Total Available Shearing Resistance TFF
  const tFF = tCohesive + tFrictional; // lb/ft

  // 6. Factor of Safety against Slope Instability
  const fs = tMob > 0 ? (tFF / tMob) : 0;

  // Status Styling
  const getFsColor = (val) => {
    if (val >= 1.5) return 'var(--accent-emerald)';
    if (val >= 1.0) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
  };

  const getFsBadge = (val) => {
    if (val >= 1.5) return '✓ STABLE (FS ≥ 1.5)';
    if (val >= 1.0) return '⚠ MARGINAL (1.0 ≤ FS < 1.5)';
    return '✗ UNSTABLE / IMPENDING FAILURE (FS < 1.0)';
  };

  // SVG Dimensioning
  const svgWidth = 540;
  const svgHeight = 360;
  const toeX = 70;
  const toeY = 270;
  const slipLengthPx = 280;
  const crownX = toeX + slipLengthPx * Math.cos(alphaRad);
  const crownY = toeY - slipLengthPx * Math.sin(alphaRad);

  // Wedge Midpoint & Force Vectors
  const midX = toeX + (crownX - toeX) * 0.52;
  const midY = toeY + (crownY - toeY) * 0.52;
  const cgX = midX - 25 * Math.sin(alphaRad);
  const cgY = midY - 35 * Math.cos(alphaRad);

  // Force vector lengths (scaled for visual clarity)
  const forceScale = 0.00085;
  const sWeight = Math.min(Math.max(weight * forceScale, 40), 95);
  const sTMob = Math.min(Math.max(tMob * forceScale, 30), 80);
  const sTFF = Math.min(Math.max(tFF * forceScale, 30), 85);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Workbench Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1fr) minmax(380px, 1.25fr)', gap: '2.5rem', alignItems: 'center' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem' }}>Planar Slope Stability Simulator</h3>
                <p className="text-xs text-muted">Limit Equilibrium Analysis: Mohr-Coulomb Resistance vs. Mobilized Shear</p>
              </div>
              <span className="glass-badge" style={{ color: getFsColor(fs), borderColor: getFsColor(fs) }}>
                {getFsBadge(fs)}
              </span>
            </div>

            {/* Slip Angle Slider */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Slip Angle (αs)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '1.05rem' }}>
                  {alpha.toFixed(1)}°
                </span>
              </div>
              <input 
                type="range" 
                min="12" 
                max="55" 
                step="0.5" 
                value={alpha} 
                onChange={(e) => setAlpha(parseFloat(e.target.value))} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <span>12° (Gentle)</span>
                <span>Driving Force TMOB = W·sin(α)</span>
                <span>55° (Steep)</span>
              </div>
            </div>

            {/* Soil Wedge Weight & Slip Length */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Wedge Weight (WM)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {(weight / 1000).toFixed(1)} kips
                  </span>
                </div>
                <input 
                  type="range" 
                  min="20000" 
                  max="180000" 
                  step="5000" 
                  value={weight} 
                  onChange={(e) => setWeight(parseFloat(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Slip Length (Ls)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                    {length.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="75" 
                  step="1" 
                  value={length} 
                  onChange={(e) => setLength(parseFloat(e.target.value))} 
                />
              </div>
            </div>

            {/* Cohesion & Friction Angle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Cohesion (c)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    {cohesion} psf
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1200" 
                  step="25" 
                  value={cohesion} 
                  onChange={(e) => setCohesion(parseInt(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Friction Angle (φ)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {phi}°
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="45" 
                  step="1" 
                  value={phi} 
                  onChange={(e) => setPhi(parseInt(e.target.value))} 
                />
              </div>
            </div>

            {/* Pore Water Pressure Uplift (U) Slider */}
            <div className="control-group" style={{ 
              border: uplift > 0 ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid var(--border-color)', 
              background: uplift > 0 ? 'rgba(6, 182, 212, 0.06)' : 'transparent',
              padding: '0.75rem',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', color: uplift > 0 ? '#06b6d4' : 'var(--text-muted)' }}>
                  💧 Seepage / Pore Water Uplift (U)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#06b6d4' }}>
                  {(uplift / 1000).toFixed(1)} kips/ft
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="60000" 
                step="2500" 
                value={uplift} 
                onChange={(e) => setUplift(parseFloat(e.target.value))} 
                style={{ accentColor: '#06b6d4' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                <span>0 (Dry)</span>
                <span>Reduces N' = (W·cosα - U)</span>
                <span>60 kips/ft (Saturated)</span>
              </div>
            </div>

            {/* Quick Exam Presets */}
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
                onClick={() => { setAlpha(28); setWeight(85000); setLength(36); setCohesion(250); setPhi(24); setUplift(0); }}
              >
                #98: c-φ Soil (FS=1.06)
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem' }}
                onClick={() => { setAlpha(25); setWeight(140000); setLength(50); setCohesion(0); setPhi(34); setUplift(0); }}
              >
                #99: Granular c=0 (FS=1.45)
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderColor: 'rgba(6, 182, 212, 0.4)', color: '#06b6d4' }}
                onClick={() => { setAlpha(30); setWeight(120000); setLength(40); setCohesion(200); setPhi(30); setUplift(35000); }}
              >
                #100: Rain Seepage (FS=0.80)
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                onClick={() => { setAlpha(32); setWeight(110000); setLength(45); setCohesion(1110); setPhi(22); setUplift(0); }}
              >
                #101: Target FS=1.50
              </button>
            </div>

            <button 
              onClick={() => setShowDerivation(true)} 
              className="solution-btn" 
              style={{ marginTop: '0.25rem' }}
            >
              📘 Step-by-Step Limit Equilibrium Derivation
            </button>
          </div>

          {/* SVG Diagram Column - Zero Text Overlap */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div 
              className="blueprint-grid"
              style={{ 
                width: '100%', 
                height: '370px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)', 
                background: 'rgba(5, 9, 18, 0.92)',
                boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.85), 0 10px 30px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <defs>
                  <linearGradient id="wedgeDynamic" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(245, 158, 11, 0.2)" />
                    <stop offset="100%" stopColor="rgba(245, 158, 11, 0.42)" />
                  </linearGradient>
                  <pattern id="bedrockPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(148, 163, 184, 0.15)" strokeWidth="1" />
                  </pattern>
                  <marker id="arrowRedD" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrowGreenD" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                  </marker>
                  <marker id="arrowBlueD" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Bedrock / Stable Subgrade */}
                <polygon points={`${toeX},${toeY} ${crownX},${crownY} ${svgWidth - 20},${crownY} ${svgWidth - 20},${svgHeight - 20} ${toeX},${svgHeight - 20}`} fill="url(#bedrockPattern)" />
                <line x1="20" y1={toeY} x2={toeX} y2={toeY} stroke="#64748b" strokeWidth="2" />

                {/* Planar Slip Surface */}
                <line x1={toeX} y1={toeY} x2={crownX} y2={crownY} stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="6,3" />

                {/* Sliding Soil Wedge */}
                <path 
                  d={`M ${toeX},${toeY} Q ${toeX + (crownX - toeX) * 0.3},${toeY - (toeY - crownY) * 0.75} ${toeX + (crownX - toeX) * 0.6},${crownY + 20} Q ${toeX + (crownX - toeX) * 0.85},${crownY + 5} ${crownX},${crownY} Z`} 
                  fill="url(#wedgeDynamic)" 
                  stroke="#f59e0b" 
                  strokeWidth="2" 
                />

                {/* Wedge Center of Gravity & Total Weight WM */}
                <circle cx={cgX} cy={cgY} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
                <line x1={cgX} y1={cgY} x2={cgX} y2={cgY + sWeight} stroke="#38bdf8" strokeWidth="2.5" markerEnd="url(#arrowBlueD)" />
                <g transform={`translate(${cgX + 8}, ${cgY + sWeight * 0.4})`}>
                  <rect width="70" height="18" rx="3" fill="#0f172a" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
                  <text x="5" y="13" fill="#38bdf8" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">
                    WM={(weight/1000).toFixed(0)}k
                  </text>
                </g>

                {/* Driving Mobilized Shear Force TMOB (Downslope) */}
                <line 
                  x1={midX} 
                  y1={midY} 
                  x2={midX - sTMob * Math.cos(alphaRad)} 
                  y2={midY + sTMob * Math.sin(alphaRad)} 
                  stroke="#f43f5e" 
                  strokeWidth="2.5" 
                  markerEnd="url(#arrowRedD)" 
                />
                <g transform={`translate(${midX - sTMob * Math.cos(alphaRad) - 75}, ${midY + sTMob * Math.sin(alphaRad) + 10})`}>
                  <rect width="90" height="19" rx="3" fill="rgba(15, 23, 42, 0.95)" stroke="#f43f5e" strokeWidth="1" />
                  <text x="5" y="14" fill="#f43f5e" fontSize="9.5" fontWeight="700" fontFamily="var(--font-mono)">
                    TMOB={(tMob/1000).toFixed(1)}k
                  </text>
                </g>

                {/* Resisting Shearing Strength TFF (Upslope) */}
                <line 
                  x1={midX} 
                  y1={midY} 
                  x2={midX + sTFF * Math.cos(alphaRad)} 
                  y2={midY - sTFF * Math.sin(alphaRad)} 
                  stroke="#10b981" 
                  strokeWidth="2.5" 
                  markerEnd="url(#arrowGreenD)" 
                />
                <g transform={`translate(${midX + sTFF * Math.cos(alphaRad) + 8}, ${midY - sTFF * Math.sin(alphaRad) - 10})`}>
                  <rect width="86" height="19" rx="3" fill="rgba(15, 23, 42, 0.95)" stroke="#10b981" strokeWidth="1" />
                  <text x="5" y="14" fill="#10b981" fontSize="9.5" fontWeight="700" fontFamily="var(--font-mono)">
                    TFF={(tFF/1000).toFixed(1)}k
                  </text>
                </g>

                {/* Inclination Angle alpha_s Arc at Toe */}
                <line x1={toeX} y1={toeY} x2={toeX + 60} y2={toeY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2" />
                <path d={`M ${toeX + 38},${toeY} A 38,38 0 0 0 ${toeX + 38 * Math.cos(alphaRad)},${toeY - 38 * Math.sin(alphaRad)}`} fill="none" stroke="#38bdf8" strokeWidth="1.5" />
                <text x={toeX + 44} y={toeY - 8} fill="#38bdf8" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                  αs={alpha.toFixed(0)}°
                </text>

                {/* Length Dimension Ls */}
                <g transform={`translate(${toeX + (crownX - toeX) * 0.45}, ${toeY + 28})`}>
                  <rect width="80" height="18" rx="3" fill="#0b1120" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />
                  <text x="6" y="13" fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)">
                    Ls = {length} ft
                  </text>
                </g>

                {/* Status Badge in Top Right */}
                <g transform="translate(365, 16)">
                  <rect width="160" height="42" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke={getFsColor(fs)} strokeWidth="1.2" />
                  <text x="8" y="18" fill="var(--text-muted)" fontSize="9" fontWeight="700" fontFamily="sans-serif">LIMIT EQUILIBRIUM</text>
                  <text x="8" y="34" fill={getFsColor(fs)} fontSize="13" fontWeight="800" fontFamily="var(--font-mono)">
                    FS = {fs.toFixed(2)}
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stability Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: `4px solid ${getFsColor(fs)}` }}>
          <span className="stat-label">Factor of Safety (TFF / TMOB)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: getFsColor(fs) }}>
              {fs.toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: getFsColor(fs), fontWeight: 600 }}>
              {fs >= 1.5 ? '✓ SAFE' : fs >= 1.0 ? '⚠ MARGINAL' : '✗ FAILING'}
            </span>
          </div>
          <span className="text-xs text-dim">{fs >= 1.0 ? 'Resisting > Driving' : 'Driving Exceeds Strength'}</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Mobilized Shear (TMOB)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: 'var(--accent-rose)' }}>{(tMob / 1000).toFixed(1)}</span>
            <span className="text-xs text-muted">kips/ft</span>
          </div>
          <span className="text-xs text-dim">WM · sin({alpha}°) = {tMob.toFixed(0)} lb/ft</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Available Strength (TFF)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-emerald">{(tFF / 1000).toFixed(1)}</span>
            <span className="text-xs text-muted">kips/ft</span>
          </div>
          <span className="text-xs text-dim">Cohesion + Friction = {tFF.toFixed(0)} lb/ft</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Cohesive Component (c·Ls)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-cyan">{(tCohesive / 1000).toFixed(1)}</span>
            <span className="text-xs text-muted">kips/ft</span>
          </div>
          <span className="text-xs text-dim">{cohesion} psf × {length}' = {tCohesive.toFixed(0)} lb</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Frictional Component (N'·tanφ)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-amber">{(tFrictional / 1000).toFixed(1)}</span>
            <span className="text-xs text-muted">kips/ft</span>
          </div>
          <span className="text-xs text-dim">
            {uplift > 0 ? `N'=(${normalTotal.toFixed(0)}-${uplift})` : `N=${normalTotal.toFixed(0)}`} × tan({phi}°)
          </span>
        </div>
      </div>

      {/* Embedded Generic Guidance Drawer */}
      {problem && (
        <GenericProblemViewer problem={problem} />
      )}

      {/* Step-by-Step Derivation Modal */}
      {showDerivation && createPortal(
        <div className="modal-overlay" onClick={() => setShowDerivation(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>⛰️</span>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>Planar Slope Failure Limit Equilibrium Analysis</h3>
                  <p className="text-xs text-muted">AASHTO & NCEES Geotechnical Slope Stability Formulation</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDerivation(false)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', lineHeight: '1.6' }}>
              {/* Intuitive 5th Grader Analogy */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  🏖️ The Giant Beach Sand Pile (Intuitive Concept)
                </h4>
                <p className="text-sm">
                  Imagine you build a giant pile of wet sand at the beach. If you pile it up way too steeply, a big chunk of it suddenly slides down onto your feet.
                </p>
                <p className="text-sm" style={{ marginTop: '0.4rem' }}>
                  That slide happens because gravity is pulling the sand downward like a playground slide, while the sand particles sticking together are trying to hold hands and stay put. Engineers use a score called the <strong>Factor of Safety</strong> to measure this. It compares the forces fighting to keep the hill stable against the forces trying to make it slide. If the "staying put" forces win by a lot, the hill is safe. If gravity wins, down comes the dirt!
                </p>
              </div>

              {/* Step 1: Mobilized Shear Force */}
              <div>
                <h4 style={{ color: 'var(--accent-rose)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 1: Mobilized Shear Force (Driving Force TMOB)
                </h4>
                <p className="text-sm">
                  The weight of the sliding mass W_M = {weight.toLocaleString()} lb/ft resolves parallel to the slip plane inclined at αs = {alpha}°:
                </p>
                <div className="math-block">
                  T_MOB = W_M · sin(αs) = {weight.toLocaleString()} × sin({alpha}°)
                  <br />
                  T_MOB = {weight.toLocaleString()} × {Math.sin(alphaRad).toFixed(4)} = {tMob.toFixed(1)} lb/ft
                </div>
              </div>

              {/* Step 2: Normal Force & Frictional Resistance */}
              <div>
                <h4 style={{ color: 'var(--accent-amber)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 2: Normal Force & Frictional Shear Resistance
                </h4>
                <p className="text-sm">
                  The weight component perpendicular to the slip plane clamps the sliding wedge to the subgrade:
                </p>
                <div className="math-block">
                  N = W_M · cos(αs) = {weight.toLocaleString()} × cos({alpha}°) = {normalTotal.toFixed(1)} lb/ft
                  {uplift > 0 && (
                    <>
                      <br />
                      Effective Normal Force: N' = N - U = {normalTotal.toFixed(1)} - {uplift} = {normalEffective.toFixed(1)} lb/ft
                    </>
                  )}
                  <br />
                  T_frictional = N' · tan(φ) = {normalEffective.toFixed(1)} × tan({phi}°)
                  <br />
                  T_frictional = {normalEffective.toFixed(1)} × {Math.tan(phiRad).toFixed(4)} = {tFrictional.toFixed(1)} lb/ft
                </div>
              </div>

              {/* Step 3: Cohesion Resistance */}
              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 3: Cohesive Resistance across Slip Surface Length Ls
                </h4>
                <div className="math-block">
                  T_cohesive = c · L_s = {cohesion} psf × {length} ft = {tCohesive.toFixed(1)} lb/ft
                </div>
              </div>

              {/* Step 4: Total Available Resistance */}
              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 4: Total Available Shearing Resistance (TFF)
                </h4>
                <div className="math-block">
                  T_FF = c · L_s + N' · tan(φ) = {tCohesive.toFixed(1)} + {tFrictional.toFixed(1)} = {tFF.toFixed(1)} lb/ft
                </div>
              </div>

              {/* Step 5: Factor of Safety */}
              <div>
                <h4 style={{ color: getFsColor(fs), marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 5: Factor of Safety against Slope Instability (FS)
                </h4>
                <div className="math-block" style={{ fontSize: '1.1rem', color: getFsColor(fs) }}>
                  FS = T_FF / T_MOB = {tFF.toFixed(1)} / {tMob.toFixed(1)} = {fs.toFixed(2)}
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  ✦ Engineering Criterion: Standard civil engineering cut and embankment slopes typically require a minimum design $\text{FS} \ge 1.30 \text{ to } 1.50$. An $\text{FS} \le 1.0$ indicates impending or active slope failure.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SlopeVisualizer;
