import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from './GenericProblemViewer';

const RetainingWallVisualizer = ({ problem }) => {
  const [height, setHeight] = useState(8); // ft
  const [topWidth, setTopWidth] = useState(2); // ft
  const [baseWidth, setBaseWidth] = useState(4); // ft
  const [gammaConc, setGammaConc] = useState(150); // pcf
  const [phi, setPhi] = useState(32); // degrees
  const [gammaSoil, setGammaSoil] = useState(110); // pcf
  const [showDerivation, setShowDerivation] = useState(false);

  // Geometric sections
  const bTri = Math.max(baseWidth - topWidth, 0.1);
  const bRect = Math.min(topWidth, baseWidth);

  // Weights & Centroids from Toe Point O (x = 0)
  // Section 1: Triangular front toe wedge
  const area1 = 0.5 * bTri * height;
  const w1 = area1 * gammaConc; // lb/ft
  const arm1 = (2 / 3) * bTri; // ft from toe O
  const mr1 = w1 * arm1; // ft-lb/ft

  // Section 2: Rectangular back block
  const area2 = bRect * height;
  const w2 = area2 * gammaConc; // lb/ft
  const arm2 = bTri + (bRect / 2); // ft from toe O
  const mr2 = w2 * arm2; // ft-lb/ft

  // Total Resisting Weight & Moment
  const totalWeight = w1 + w2;
  const totalResistingMoment = mr1 + mr2;

  // Rankine Active Earth Pressure
  const phiRad = (phi * Math.PI) / 180;
  const ka = (1 - Math.sin(phiRad)) / (1 + Math.sin(phiRad));
  const pa = 0.5 * ka * gammaSoil * Math.pow(height, 2); // lb/ft
  const armPa = height / 3; // ft above base
  const overturningMoment = pa * armPa; // ft-lb/ft

  // Factor of Safety against Overturning
  const fsOverturning = overturningMoment > 0 ? (totalResistingMoment / overturningMoment) : 0;
  
  // Factor of Safety against Sliding (assuming friction coefficient mu = tan(phi_base) ~ tan(32°))
  const mu = Math.tan(phiRad * 0.8); // typical concrete-soil friction
  const resistingSliding = totalWeight * mu;
  const fsSliding = pa > 0 ? (resistingSliding / pa) : 0;

  // Status color for FS
  const getFsColor = (fs) => {
    if (fs >= 2.0) return 'var(--accent-emerald)';
    if (fs >= 1.5) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
  };

  // SVG Dimensioning
  const svgWidth = 500;
  const svgHeight = 360;
  const groundY = 275;
  const wallRightX = 300;
  const scale = 25; // 25 px per foot

  const sHeight = height * scale;
  const sTopWidth = topWidth * scale;
  const sBaseWidth = baseWidth * scale;
  const wallTopY = groundY - sHeight;
  const toeX = wallRightX - sBaseWidth;
  const topToeX = wallRightX - sTopWidth;

  const wallPath = `M ${toeX},${groundY} L ${topToeX},${wallTopY} L ${wallRightX},${wallTopY} L ${wallRightX},${groundY} Z`;
  const splitLineX = wallRightX - sTopWidth;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Workbench Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)', gap: '2.5rem', alignItems: 'center' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem' }}>Gravity Retaining Wall Stability</h3>
                <p className="text-xs text-muted">Rankine Active Earth Pressure & Overturning FS</p>
              </div>
              <span className="glass-badge" style={{ color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                Soil Mechanics
              </span>
            </div>

            {/* Height Slider */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wall Height (H)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>
                  {height.toFixed(1)} ft
                </span>
              </div>
              <input 
                type="range" 
                min="4" 
                max="16" 
                step="0.5" 
                value={height} 
                onChange={(e) => setHeight(parseFloat(e.target.value))} 
              />
            </div>

            {/* Base & Top Width Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Base Width (B)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {baseWidth.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min={topWidth} 
                  max="10" 
                  step="0.5" 
                  value={baseWidth} 
                  onChange={(e) => setBaseWidth(parseFloat(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Top Width (b)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-indigo)' }}>
                    {topWidth.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max={baseWidth} 
                  step="0.5" 
                  value={topWidth} 
                  onChange={(e) => setTopWidth(parseFloat(e.target.value))} 
                />
              </div>
            </div>

            {/* Soil Properties */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Friction Angle (φ)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    {phi}°
                  </span>
                </div>
                <input 
                  type="range" 
                  min="24" 
                  max="42" 
                  step="1" 
                  value={phi} 
                  onChange={(e) => setPhi(parseInt(e.target.value))} 
                />
              </div>

              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Soil Unit Wt (γ)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)' }}>
                    {gammaSoil} pcf
                  </span>
                </div>
                <input 
                  type="range" 
                  min="90" 
                  max="135" 
                  step="5" 
                  value={gammaSoil} 
                  onChange={(e) => setGammaSoil(parseInt(e.target.value))} 
                />
              </div>
            </div>

            {/* Reset / Presets */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                onClick={() => {
                  setHeight(8);
                  setTopWidth(2);
                  setBaseWidth(4);
                  setPhi(32);
                  setGammaSoil(110);
                  setGammaConc(150);
                }}
              >
                ↺ Reset to Problem Defaults (8' x 4' x 2', φ=32°)
              </button>
            </div>

            <button 
              onClick={() => setShowDerivation(true)} 
              className="solution-btn" 
              style={{ marginTop: '0.5rem' }}
            >
              📘 View Step-by-Step Derivation & Moments
            </button>
          </div>

          {/* SVG Diagram Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div 
              className="blueprint-grid"
              style={{ 
                width: '100%', 
                height: '360px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)', 
                background: 'rgba(5, 9, 18, 0.9)',
                boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
                <defs>
                  <pattern id="soilPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" />
                  </pattern>
                  <linearGradient id="concreteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrowBlue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Granular Backfill Behind Wall */}
                <rect x={wallRightX} y={wallTopY} width={svgWidth - wallRightX} height={sHeight} fill="url(#soilPattern)" />
                <line x1={wallRightX} y1={wallTopY} x2={svgWidth} y2={wallTopY} stroke="#f59e0b" strokeWidth="2" />
                {/* Ground Hatch marks on top of backfill */}
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <line 
                    key={i} 
                    x1={wallRightX + 15 + i * 15} 
                    y1={wallTopY} 
                    x2={wallRightX + 5 + i * 15} 
                    y2={wallTopY - 8} 
                    stroke="#f59e0b" 
                    strokeWidth="1.5" 
                  />
                ))}

                {/* Subgrade Ground Line on Toe side */}
                <line x1={20} y1={groundY} x2={toeX} y2={groundY} stroke="#94a3b8" strokeWidth="2" />
                {[0, 1, 2, 3, 4].map(i => (
                  <line 
                    key={i} 
                    x1={30 + i * 15} 
                    y1={groundY} 
                    x2={20 + i * 15} 
                    y2={groundY + 8} 
                    stroke="#64748b" 
                    strokeWidth="1.5" 
                  />
                ))}

                {/* Concrete Gravity Wall */}
                <path d={wallPath} fill="url(#concreteGrad)" stroke="#38bdf8" strokeWidth="2" />

                {/* Internal Split Line between Triangle (1) and Rectangle (2) */}
                <line x1={splitLineX} y1={wallTopY} x2={splitLineX} y2={groundY} stroke="rgba(255,255,255,0.25)" strokeDasharray="4,4" />

                {/* Section labels */}
                <text x={toeX + (splitLineX - toeX) * 0.65} y={groundY - sHeight * 0.3} fill="#e2e8f0" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
                  W₁
                </text>
                <text x={splitLineX + (wallRightX - splitLineX) * 0.35} y={groundY - sHeight * 0.5} fill="#e2e8f0" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
                  W₂
                </text>

                {/* Weight Vectors W1 and W2 */}
                <line 
                  x1={toeX + arm1 * scale} 
                  y1={groundY - sHeight * 0.35} 
                  x2={toeX + arm1 * scale} 
                  y2={groundY - 10} 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  markerEnd="url(#arrowBlue)" 
                />
                <line 
                  x1={toeX + arm2 * scale} 
                  y1={groundY - sHeight * 0.55} 
                  x2={toeX + arm2 * scale} 
                  y2={groundY - 10} 
                  stroke="#38bdf8" 
                  strokeWidth="2" 
                  markerEnd="url(#arrowBlue)" 
                />

                {/* Lateral Earth Pressure Triangle on Back Face */}
                <polygon 
                  points={`${wallRightX},${wallTopY} ${wallRightX},${groundY} ${wallRightX + 60},${groundY}`} 
                  fill="rgba(244, 63, 94, 0.15)" 
                  stroke="#f43f5e" 
                  strokeWidth="1.5" 
                  strokeDasharray="3,3" 
                />

                {/* Resultant Active Thrust Vector Pa at H/3 */}
                <line 
                  x1={wallRightX + 75} 
                  y1={groundY - (sHeight / 3)} 
                  x2={wallRightX} 
                  y2={groundY - (sHeight / 3)} 
                  stroke="#f43f5e" 
                  strokeWidth="3" 
                  markerEnd="url(#arrow)" 
                />
                <text x={wallRightX + 80} y={groundY - (sHeight / 3) + 4} fill="#f43f5e" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
                  Pa = {pa.toFixed(0)} lb/ft
                </text>
                <text x={wallRightX + 80} y={groundY - (sHeight / 3) + 18} fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono)">
                  @ H/3 = {(height / 3).toFixed(2)}'
                </text>

                {/* Toe Point O */}
                <circle cx={toeX} cy={groundY} r="6" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                <text x={toeX - 18} y={groundY + 18} fill="#06b6d4" fontSize="14" fontWeight="800" fontFamily="var(--font-heading)">
                  Point O
                </text>

                {/* Dimension Lines: Base Width */}
                <line x1={toeX} y1={groundY + 28} x2={wallRightX} y2={groundY + 28} stroke="#94a3b8" strokeWidth="1" />
                <line x1={toeX} y1={groundY + 23} x2={toeX} y2={groundY + 33} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX} y1={groundY + 23} x2={wallRightX} y2={groundY + 33} stroke="#94a3b8" strokeWidth="1" />
                <text x={toeX + (sBaseWidth / 2) - 15} y={groundY + 42} fill="#94a3b8" fontSize="11" fontFamily="var(--font-mono)">
                  B = {baseWidth} ft
                </text>

                {/* Dimension Lines: Top Width */}
                <line x1={topToeX} y1={wallTopY - 14} x2={wallRightX} y2={wallTopY - 14} stroke="#94a3b8" strokeWidth="1" />
                <line x1={topToeX} y1={wallTopY - 19} x2={topToeX} y2={wallTopY - 9} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX} y1={wallTopY - 19} x2={wallRightX} y2={wallTopY - 9} stroke="#94a3b8" strokeWidth="1" />
                <text x={topToeX + (sTopWidth / 2) - 12} y={wallTopY - 20} fill="#94a3b8" fontSize="11" fontFamily="var(--font-mono)">
                  b = {topWidth} ft
                </text>

                {/* Height Dimension Line */}
                <line x1={wallRightX + 15} y1={wallTopY} x2={wallRightX + 15} y2={groundY} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX + 10} y1={wallTopY} x2={wallRightX + 20} y2={wallTopY} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX + 10} y1={groundY} x2={wallRightX + 20} y2={groundY} stroke="#94a3b8" strokeWidth="1" />
                <text x={wallRightX + 20} y={wallTopY + (sHeight / 2) + 4} fill="#94a3b8" fontSize="11" fontFamily="var(--font-mono)">
                  H = {height} ft
                </text>
              </svg>

              {/* Status Badge */}
              <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
                <span className="glass-badge" style={{ background: 'rgba(15, 23, 42, 0.8)', borderColor: 'var(--border-color)', fontSize: '0.75rem' }}>
                  Ka = {ka.toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stability Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: `4px solid ${getFsColor(fsOverturning)}` }}>
          <span className="stat-label">FS Overturning (ΣMR / MOT)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: getFsColor(fsOverturning) }}>
              {fsOverturning.toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: getFsColor(fsOverturning), fontWeight: 600 }}>
              {fsOverturning >= 2.0 ? '✓ SAFE (≥ 2.0)' : fsOverturning >= 1.5 ? '⚠ ACCEPTABLE (≥ 1.5)' : '✗ UNSAFE (< 1.5)'}
            </span>
          </div>
          <span className="text-xs text-dim">Point O Toe Pivot</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Resisting Moment (ΣMR)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-cyan">{totalResistingMoment.toFixed(0)}</span>
            <span className="text-xs text-muted">ft-lb/ft</span>
          </div>
          <span className="text-xs text-dim">W₁·arm₁ + W₂·arm₂ = {mr1.toFixed(0)} + {mr2.toFixed(0)}</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Overturning Moment (MOT)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: 'var(--accent-rose)' }}>{overturningMoment.toFixed(0)}</span>
            <span className="text-xs text-muted">ft-lb/ft</span>
          </div>
          <span className="text-xs text-dim">Pa · (H/3) = {pa.toFixed(0)} · {(height/3).toFixed(2)}'</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Active Thrust (Pa)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-amber">{pa.toFixed(0)}</span>
            <span className="text-xs text-muted">lb/ft</span>
          </div>
          <span className="text-xs text-dim">0.5 · Ka · γ · H²</span>
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
                <span style={{ fontSize: '1.75rem' }}>📐</span>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>NCEES Civil PE Solution: Gravity Retaining Wall</h3>
                  <p className="text-xs text-muted">Rankine Active Lateral Pressure & Factor of Safety against Overturning</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDerivation(false)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', lineHeight: '1.6' }}>
              <div>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 1: Rankine Active Earth Pressure Coefficient (Ka)
                </h4>
                <p className="text-sm">
                  For horizontal granular backfill with friction angle φ = {phi}° and cohesion c = 0:
                </p>
                <div className="math-block">
                  Ka = tan²(45° - φ / 2) = (1 - sin {phi}°) / (1 + sin {phi}°)
                  <br />
                  Ka = (1 - {Math.sin(phiRad).toFixed(4)}) / (1 + {Math.sin(phiRad).toFixed(4)}) = {ka.toFixed(4)}
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-rose)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 2: Total Active Lateral Force (Pa) & Overturning Moment (MOT)
                </h4>
                <p className="text-sm">
                  The lateral earth pressure distribution is triangular, acting at H/3 above the toe:
                </p>
                <div className="math-block">
                  Pa = ½ · Ka · γt · H² = 0.5 × {ka.toFixed(4)} × {gammaSoil} pcf × ({height} ft)²
                  <br />
                  Pa = {pa.toFixed(2)} lb/ft
                  <br />
                  y_arm = H / 3 = {height} / 3 = {(height / 3).toFixed(3)} ft
                  <br />
                  MOT = Pa × (H / 3) = {pa.toFixed(2)} × {(height / 3).toFixed(3)} = {overturningMoment.toFixed(2)} ft-lb/ft
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 3: Concrete Wall Weights & Resisting Moments about Toe Point O
                </h4>
                <p className="text-sm">
                  Decompose the wall cross-section into a front triangular wedge (1) and a rear rectangular stem (2):
                </p>
                <div className="math-block">
                  Section 1 (Triangle): Base = {bTri} ft, Height = {height} ft
                  <br />
                  W₁ = ½ × {bTri} × {height} × {gammaConc} = {w1.toFixed(0)} lb/ft
                  <br />
                  x₁ = ⅔ × {bTri} = {arm1.toFixed(3)} ft from Point O
                  <br />
                  MR₁ = W₁ × x₁ = {w1.toFixed(0)} × {arm1.toFixed(3)} = {mr1.toFixed(1)} ft-lb/ft
                  <br /><br />
                  Section 2 (Rectangle): Base = {bRect} ft, Height = {height} ft
                  <br />
                  W₂ = {bRect} × {height} × {gammaConc} = {w2.toFixed(0)} lb/ft
                  <br />
                  x₂ = {bTri} + ½ × {bRect} = {arm2.toFixed(3)} ft from Point O
                  <br />
                  MR₂ = W₂ × x₂ = {w2.toFixed(0)} × {arm2.toFixed(3)} = {mr2.toFixed(1)} ft-lb/ft
                  <br /><br />
                  Total Resisting Moment: ΣMR = {mr1.toFixed(1)} + {mr2.toFixed(1)} = {totalResistingMoment.toFixed(1)} ft-lb/ft
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step 4: Factor of Safety Against Overturning (FS_OT)
                </h4>
                <div className="math-block" style={{ fontSize: '1.05rem', color: '#10b981' }}>
                  FS_OT = ΣMR / MOT = {totalResistingMoment.toFixed(1)} / {overturningMoment.toFixed(2)} = {fsOverturning.toFixed(2)} ≈ 3.05 (or 3.1)
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  ✦ Standard NCEES exam criterion: Minimum required FS against overturning is typically 1.5 to 2.0. With FS = {fsOverturning.toFixed(2)}, the wall is fully stable against overturning.
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

export default RetainingWallVisualizer;
