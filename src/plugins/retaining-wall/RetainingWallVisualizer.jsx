import { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

const RetainingWallVisualizer = ({ problem }) => {
  const [height, setHeight] = useState(problem?.height || 8); // ft
  const [topWidth, setTopWidth] = useState(problem?.topWidth || 2); // ft
  const [baseWidth, setBaseWidth] = useState(problem?.baseWidth || 4); // ft
  const [gammaConc, setGammaConc] = useState(problem?.gammaConc || 150); // pcf
  const [phi, setPhi] = useState(problem?.phi || 32); // degrees
  const [gammaSoil, setGammaSoil] = useState(problem?.gammaSoil || 110); // pcf (moist)
  const [submergedHeight, setSubmergedHeight] = useState(problem?.submergedHeight ?? 0); // ft from base
  const [gammaSat, setGammaSat] = useState(problem?.gammaSat || 125); // pcf
  const [includeUplift, setIncludeUplift] = useState(false);
  const [showDerivation, setShowDerivation] = useState(false);

  const [prevProblem, setPrevProblem] = useState(problem);

  // Sync state whenever selected problem prop changes without cascading renders
  if (problem && problem !== prevProblem) {
    setPrevProblem(problem);
    if (problem.height !== undefined) setHeight(problem.height);
    if (problem.topWidth !== undefined) setTopWidth(problem.topWidth);
    if (problem.baseWidth !== undefined) setBaseWidth(problem.baseWidth);
    if (problem.gammaConc !== undefined) setGammaConc(problem.gammaConc);
    if (problem.phi !== undefined) setPhi(problem.phi);
    if (problem.gammaSoil !== undefined) setGammaSoil(problem.gammaSoil);
    setSubmergedHeight(problem.submergedHeight ?? 0);
    if (problem.gammaSat !== undefined) setGammaSat(problem.gammaSat);
  }

  // Geometric sections
  const bTri = Math.max(baseWidth - topWidth, 0.1);
  const bRect = Math.min(topWidth, baseWidth);

  // Concrete Wall Weights & Centroids from Toe Point O (x = 0)
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

  // Total Resisting Weight & Moment from Concrete
  const totalWeight = w1 + w2;
  const totalResistingMoment = mr1 + mr2;

  // Rankine Active Earth Pressure Coefficient
  const phiRad = (phi * Math.PI) / 180;
  const ka = (1 - Math.sin(phiRad)) / (1 + Math.sin(phiRad));

  // Water Table Geometry & Properties
  const gammaW = 62.4; // pcf
  const hw = Math.min(Math.max(submergedHeight, 0), height); // clamped submerged height
  const hDry = height - hw; // upper moist/dry zone thickness
  const gammaPrime = Math.max(gammaSat - gammaW, 10); // buoyant unit weight

  // 1. Lateral Soil Forces:
  // (a) Upper dry triangular zone
  let pa1 = 0;
  let armPa1 = 0;
  let motPa1 = 0;
  if (hDry > 0) {
    pa1 = 0.5 * ka * gammaSoil * Math.pow(hDry, 2);
    armPa1 = hw + (hDry / 3);
    motPa1 = pa1 * armPa1;
  }

  // (b) Surcharge effect on lower submerged layer from dry soil overburden
  let pa2Rect = 0;
  let motPa2Rect = 0;
  if (hw > 0 && hDry > 0) {
    const qDry = gammaSoil * hDry; // effective vertical stress at water table
    pa2Rect = ka * qDry * hw;
    const armPa2Rect = hw / 2;
    motPa2Rect = pa2Rect * armPa2Rect;
  }

  // (c) Triangular effective soil thrust from submerged soil (buoyant unit weight)
  let pa2Tri = 0;
  let motPa2Tri = 0;
  if (hw > 0) {
    pa2Tri = 0.5 * ka * gammaPrime * Math.pow(hw, 2);
    const armPa2Tri = hw / 3;
    motPa2Tri = pa2Tri * armPa2Tri;
  }

  const paEffective = pa1 + pa2Rect + pa2Tri;
  const motSoil = motPa1 + motPa2Rect + motPa2Tri;
  const armPaEffective = paEffective > 0 ? (motSoil / paEffective) : (height / 3);

  // 2. Pore Water Pressure (Hydrostatic Thrust Pw):
  let pw = 0;
  let armPw = 0;
  let motWater = 0;
  let uBase = 0;
  if (hw > 0) {
    uBase = gammaW * hw; // psf at base
    pw = 0.5 * gammaW * Math.pow(hw, 2); // lb/ft
    armPw = hw / 3; // ft above base
    motWater = pw * armPw; // ft-lb/ft
  }

  // 3. Optional Base Uplift:
  let upliftForce = 0;
  let motUplift = 0;
  if (includeUplift && hw > 0) {
    upliftForce = 0.5 * uBase * baseWidth; // triangular uplift from heel to toe
    const armUplift = (2 / 3) * baseWidth; // from toe Point O
    motUplift = upliftForce * armUplift;
  }

  // Total Lateral Force & Total Overturning Moment
  const totalLateralForce = paEffective + pw;
  const totalOverturningMoment = motSoil + motWater + motUplift;

  // Factor of Safety against Overturning
  const fsOverturning = totalOverturningMoment > 0 ? (totalResistingMoment / totalOverturningMoment) : 0;

  // Factor of Safety against Sliding
  const mu = Math.tan(phiRad * 0.8);
  const netNormalWeight = Math.max(totalWeight - upliftForce, 0);
  const resistingSliding = netNormalWeight * mu;
  const fsSliding = totalLateralForce > 0 ? (resistingSliding / totalLateralForce) : 0;

  // Status color for FS
  const getFsColor = (fs) => {
    if (fs >= 2.0) return 'var(--accent-emerald)';
    if (fs >= 1.5) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
  };

  // SVG Dimensioning & Dynamic Scaling
  const svgWidth = 560;
  const svgHeight = 370;
  const groundY = 285;
  const wallRightX = 270;
  const scale = height > 12 ? 18 : 22; // responsive scaling

  const sHeight = height * scale;
  const sTopWidth = topWidth * scale;
  const sBaseWidth = baseWidth * scale;
  const sHw = hw * scale;

  const wallTopY = groundY - sHeight;
  const toeX = wallRightX - sBaseWidth;
  const topToeX = wallRightX - sTopWidth;
  const waterY = groundY - sHw;

  const wallPath = `M ${toeX},${groundY} L ${topToeX},${wallTopY} L ${wallRightX},${wallTopY} L ${wallRightX},${groundY} Z`;
  const splitLineX = wallRightX - sTopWidth;

  // Arrow / force coordinates in SVG
  const soilForceY = groundY - (armPaEffective * scale);
  const waterForceY = groundY - (armPw * scale);

  // Guarantee ZERO text overlap by staggering force badge label Y coordinates if they get close
  let soilBadgeY = soilForceY - 8;
  let waterBadgeY = waterForceY + 12;
  if (Math.abs(soilBadgeY - waterBadgeY) < 32) {
    if (soilForceY < waterForceY) {
      soilBadgeY = Math.min(soilForceY - 14, groundY - 50);
      waterBadgeY = Math.max(waterForceY + 16, groundY - 30);
    } else {
      soilBadgeY = Math.max(soilForceY + 14, groundY - 30);
      waterBadgeY = Math.min(waterForceY - 16, groundY - 50);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Workbench Card */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 1fr) minmax(380px, 1.25fr)', gap: '2.5rem', alignItems: 'center' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem' }}>Gravity Retaining Wall Stability</h3>
                <p className="text-xs text-muted">Rankine Earth Pressure & Pore Water Overturning Analysis</p>
              </div>
              <span className="glass-badge" style={{ color: hw > 0 ? 'var(--accent-blue)' : 'var(--accent-cyan)', borderColor: hw > 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(6, 182, 212, 0.3)' }}>
                {hw > 0 ? '💧 Submerged Backfill' : '🏜️ Dry Backfill'}
              </span>
            </div>

            {/* Submerged Portion / Pore Water Pressure Slider */}
            <div className="control-group" style={{ 
              border: hw > 0 ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-color)', 
              background: hw > 0 ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
              padding: '0.85rem',
              borderRadius: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: hw > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                  💧 Submerged Portion (Water Table hw)
                </label>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#38bdf8', fontSize: '1.15rem' }}>
                    {hw.toFixed(1)} ft
                  </span>
                  <span className="text-xs" style={{ color: hw > 0 ? '#38bdf8' : 'var(--text-dim)', fontWeight: 600 }}>
                    ({((hw / height) * 100).toFixed(0)}% Submerged)
                  </span>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max={height} 
                step="0.5" 
                value={hw} 
                onChange={(e) => setSubmergedHeight(parseFloat(e.target.value))} 
                style={{ accentColor: '#38bdf8' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <span>0 ft (Dry)</span>
                <span>Pore Pressure: {hw > 0 ? `${pw.toFixed(0)} lb/ft (ACTIVE)` : 'None'}</span>
                <span>{height} ft (Full)</span>
              </div>
            </div>

            {/* Height Slider */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Wall Height (H)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '1.05rem' }}>
                  {height.toFixed(1)} ft
                </span>
              </div>
              <input 
                type="range" 
                min="4" 
                max="16" 
                step="0.5" 
                value={height} 
                onChange={(e) => {
                  const newH = parseFloat(e.target.value);
                  setHeight(newH);
                  if (submergedHeight > newH) setSubmergedHeight(newH);
                }} 
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
                    Moist Unit Wt (γ)
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

            {/* Saturated Weight & Base Uplift Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <input 
                  type="checkbox" 
                  checked={includeUplift} 
                  onChange={(e) => setIncludeUplift(e.target.checked)} 
                  style={{ cursor: 'pointer' }}
                />
                Include Hydrostatic Base Uplift (U)
              </label>
              <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                γsat = {gammaSat} pcf (γ' = {gammaPrime.toFixed(1)})
              </span>
            </div>

            {/* Reset / Presets */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                onClick={() => {
                  setHeight(8);
                  setTopWidth(2);
                  setBaseWidth(4);
                  setPhi(32);
                  setGammaSoil(110);
                  setGammaConc(150);
                  setSubmergedHeight(0);
                  setIncludeUplift(false);
                }}
              >
                ↺ Problem 96 (Dry: hw = 0')
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                onClick={() => {
                  setHeight(8);
                  setTopWidth(2);
                  setBaseWidth(4);
                  setPhi(32);
                  setGammaSoil(110);
                  setGammaConc(150);
                  setGammaSat(125);
                  setSubmergedHeight(4);
                  setIncludeUplift(false);
                }}
              >
                💧 Problem 97 (Submerged: hw = 4')
              </button>
            </div>

            <button 
              onClick={() => setShowDerivation(true)} 
              className="solution-btn" 
              style={{ marginTop: '0.25rem' }}
            >
              📘 Step-by-Step Derivation & Moment Equilibrium
            </button>
          </div>

          {/* SVG Diagram Column - Engineered for ZERO Text Overlap */}
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
                  <pattern id="soilPatternMain" width="12" height="12" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" />
                  </pattern>
                  <linearGradient id="concreteGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  <marker id="arrowRed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrowCyan" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                  </marker>
                  <marker id="arrowBlueStem" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                  </marker>
                </defs>

                {/* Granular Backfill Area */}
                <rect x={wallRightX} y={wallTopY} width={svgWidth - wallRightX} height={sHeight} fill="url(#soilPatternMain)" />
                <line x1={wallRightX} y1={wallTopY} x2={svgWidth - 10} y2={wallTopY} stroke="#f59e0b" strokeWidth="2" />
                
                {/* Surface Hatch marks on backfill */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                  <line 
                    key={i} 
                    x1={wallRightX + 15 + i * 22} 
                    y1={wallTopY} 
                    x2={wallRightX + 5 + i * 22} 
                    y2={wallTopY - 7} 
                    stroke="#f59e0b" 
                    strokeWidth="1.5" 
                  />
                ))}

                {/* Submerged Zone Overlay & Water Table Line (if hw > 0) */}
                {hw > 0 && (
                  <>
                    <rect 
                      x={wallRightX} 
                      y={waterY} 
                      width={svgWidth - wallRightX} 
                      height={sHw} 
                      fill="rgba(6, 182, 212, 0.22)" 
                    />
                    <line 
                      x1={wallRightX} 
                      y1={waterY} 
                      x2={svgWidth - 10} 
                      y2={waterY} 
                      stroke="#06b6d4" 
                      strokeWidth="2" 
                      strokeDasharray="6,3" 
                    />
                    {/* Water Table Symbol ▽ */}
                    <polygon points={`${wallRightX + 35},${waterY} ${wallRightX + 41},${waterY - 9} ${wallRightX + 29},${waterY - 9}`} fill="#06b6d4" />
                    <line x1={wallRightX + 27} y1={waterY - 11} x2={wallRightX + 43} y2={waterY - 11} stroke="#06b6d4" strokeWidth="1.5" />
                    
                    {/* GWT Label Badge */}
                    <rect x={wallRightX + 48} y={waterY - 16} width={130} height={18} rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1" />
                    <text x={wallRightX + 53} y={waterY - 3} fill="#06b6d4" fontSize="10" fontWeight="700" fontFamily="sans-serif">
                      G.W.T. (hw = {hw.toFixed(1)} ft)
                    </text>
                  </>
                )}

                {/* Subgrade Ground Line on Toe side */}
                <line x1={15} y1={groundY} x2={toeX} y2={groundY} stroke="#94a3b8" strokeWidth="2" />
                {[0, 1, 2, 3].map(i => (
                  <line 
                    key={i} 
                    x1={25 + i * 20} 
                    y1={groundY} 
                    x2={15 + i * 20} 
                    y2={groundY + 8} 
                    stroke="#64748b" 
                    strokeWidth="1.5" 
                  />
                ))}

                {/* Concrete Gravity Wall */}
                <path d={wallPath} fill="url(#concreteGradMain)" stroke="#38bdf8" strokeWidth="2" />

                {/* Internal Split Line between Triangle (1) and Rectangle (2) */}
                <line x1={splitLineX} y1={wallTopY} x2={splitLineX} y2={groundY} stroke="rgba(255,255,255,0.3)" strokeDasharray="4,4" />

                {/* Section labels W1 and W2 */}
                <text x={toeX + (splitLineX - toeX) * 0.6} y={groundY - sHeight * 0.25} fill="#e2e8f0" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
                  W₁
                </text>
                <text x={splitLineX + (wallRightX - splitLineX) * 0.35} y={groundY - sHeight * 0.45} fill="#e2e8f0" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)">
                  W₂
                </text>

                {/* Weight Vectors W1 and W2 */}
                <line 
                  x1={toeX + arm1 * scale} 
                  y1={groundY - sHeight * 0.32} 
                  x2={toeX + arm1 * scale} 
                  y2={groundY - 8} 
                  stroke="#38bdf8" 
                  strokeWidth="1.8" 
                  markerEnd="url(#arrowBlueStem)" 
                />
                <line 
                  x1={toeX + arm2 * scale} 
                  y1={groundY - sHeight * 0.52} 
                  x2={toeX + arm2 * scale} 
                  y2={groundY - 8} 
                  stroke="#38bdf8" 
                  strokeWidth="1.8" 
                  markerEnd="url(#arrowBlueStem)" 
                />

                {/* Lateral Earth Pressure Triangle on Back Face */}
                <polygon 
                  points={`${wallRightX},${wallTopY} ${wallRightX},${groundY} ${wallRightX + 45},${groundY}`} 
                  fill="rgba(244, 63, 94, 0.12)" 
                  stroke="#f43f5e" 
                  strokeWidth="1.5" 
                  strokeDasharray="3,3" 
                />

                {/* Resultant Effective Soil Thrust Vector P'a */}
                <line 
                  x1={wallRightX + 65} 
                  y1={soilForceY} 
                  x2={wallRightX} 
                  y2={soilForceY} 
                  stroke="#f43f5e" 
                  strokeWidth="2.5" 
                  markerEnd="url(#arrowRed)" 
                />
                
                {/* Soil Force Label Badge (Zero Overlap Guaranteed) */}
                <g transform={`translate(${wallRightX + 70}, ${soilBadgeY})`}>
                  <rect width="130" height="22" rx="4" fill="rgba(15, 23, 42, 0.92)" stroke="#f43f5e" strokeWidth="1" />
                  <text x="6" y="15" fill="#f43f5e" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                    {hw > 0 ? "P'a" : "Pa"} = {paEffective.toFixed(0)} lb/ft
                  </text>
                </g>

                {/* Pore Water Pressure Triangle & Thrust Vector Pw (if hw > 0) */}
                {hw > 0 && (
                  <>
                    <polygon 
                      points={`${wallRightX},${waterY} ${wallRightX},${groundY} ${wallRightX + 35},${groundY}`} 
                      fill="rgba(6, 182, 212, 0.3)" 
                      stroke="#06b6d4" 
                      strokeWidth="1.8" 
                    />
                    <line 
                      x1={wallRightX + 65} 
                      y1={waterForceY} 
                      x2={wallRightX} 
                      y2={waterForceY} 
                      stroke="#06b6d4" 
                      strokeWidth="2.5" 
                      markerEnd="url(#arrowCyan)" 
                    />
                    {/* Pore Water Badge (Zero Overlap Guaranteed) */}
                    <g transform={`translate(${wallRightX + 70}, ${waterBadgeY})`}>
                      <rect width="130" height="22" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="#06b6d4" strokeWidth="1" />
                      <text x="6" y="15" fill="#06b6d4" fontSize="10.5" fontWeight="700" fontFamily="var(--font-mono)">
                        Pw = {pw.toFixed(0)} lb/ft
                      </text>
                    </g>
                  </>
                )}

                {/* Optional Uplift Pressure Wedge under Base */}
                {includeUplift && hw > 0 && (
                  <polygon 
                    points={`${toeX},${groundY} ${wallRightX},${groundY} ${wallRightX},${groundY + 18}`} 
                    fill="rgba(6, 182, 212, 0.2)" 
                    stroke="#06b6d4" 
                    strokeWidth="1.2" 
                    strokeDasharray="3,2" 
                  />
                )}

                {/* Toe Point O */}
                <circle cx={toeX} cy={groundY} r="6" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
                <g transform={`translate(${toeX - 18}, ${groundY + 18})`}>
                  <rect x="-4" y="-12" width="26" height="18" rx="3" fill="#0f172a" stroke="#06b6d4" strokeWidth="1" />
                  <text x="3" y="1" fill="#06b6d4" fontSize="12" fontWeight="800" fontFamily="var(--font-heading)">
                    O
                  </text>
                </g>

                {/* Dimension 1: Base Width B */}
                <line x1={toeX} y1={groundY + 36} x2={wallRightX} y2={groundY + 36} stroke="#94a3b8" strokeWidth="1" />
                <line x1={toeX} y1={groundY + 30} x2={toeX} y2={groundY + 42} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX} y1={groundY + 30} x2={wallRightX} y2={groundY + 42} stroke="#94a3b8" strokeWidth="1" />
                <g transform={`translate(${toeX + (sBaseWidth / 2) - 26}, ${groundY + 28})`}>
                  <rect width="52" height="16" rx="3" fill="#0b1120" />
                  <text x="6" y="12" fill="#94a3b8" fontSize="10.5" fontFamily="var(--font-mono)">
                    B = {baseWidth} ft
                  </text>
                </g>

                {/* Dimension 2: Top Width b */}
                <line x1={topToeX} y1={wallTopY - 14} x2={wallRightX} y2={wallTopY - 14} stroke="#94a3b8" strokeWidth="1" />
                <line x1={topToeX} y1={wallTopY - 19} x2={topToeX} y2={wallTopY - 9} stroke="#94a3b8" strokeWidth="1" />
                <line x1={wallRightX} y1={wallTopY - 19} x2={wallRightX} y2={wallTopY - 9} stroke="#94a3b8" strokeWidth="1" />
                <g transform={`translate(${topToeX + (sTopWidth / 2) - 24}, ${wallTopY - 22})`}>
                  <rect width="48" height="16" rx="3" fill="#0b1120" />
                  <text x="6" y="12" fill="#94a3b8" fontSize="10.5" fontFamily="var(--font-mono)">
                    b = {topWidth} ft
                  </text>
                </g>

                {/* Dimension 3: Wall Height H (Far Left) */}
                <line x1={toeX - 35} y1={wallTopY} x2={toeX - 35} y2={groundY} stroke="#94a3b8" strokeWidth="1" />
                <line x1={toeX - 40} y1={wallTopY} x2={toeX - 30} y2={wallTopY} stroke="#94a3b8" strokeWidth="1" />
                <line x1={toeX - 40} y1={groundY} x2={toeX - 30} y2={groundY} stroke="#94a3b8" strokeWidth="1" />
                <g transform={`translate(${toeX - 62}, ${wallTopY + (sHeight / 2) - 10})`}>
                  <rect width="52" height="18" rx="3" fill="#0f172a" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1" />
                  <text x="5" y="13" fill="#94a3b8" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">
                    H = {height}'
                  </text>
                </g>
              </svg>

              {/* Status Badges on Top Corners */}
              <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                <span className="glass-badge" style={{ background: 'rgba(15, 23, 42, 0.85)', borderColor: 'var(--border-color)', fontSize: '0.72rem' }}>
                  Ka = {ka.toFixed(4)}
                </span>
                {hw > 0 && (
                  <span className="glass-badge" style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)', fontSize: '0.72rem' }}>
                    γ' = {gammaPrime.toFixed(1)} pcf
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stability Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: `4px solid ${getFsColor(fsOverturning)}` }}>
          <span className="stat-label">FS Overturning (ΣMR / MOT)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: getFsColor(fsOverturning) }}>
              {fsOverturning.toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: getFsColor(fsOverturning), fontWeight: 600 }}>
              {fsOverturning >= 2.0 ? '✓ SAFE' : fsOverturning >= 1.5 ? '⚠ OK' : '✗ UNSAFE'}
            </span>
          </div>
          <span className="text-xs text-dim">About Toe Point O</span>
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
            <span className="stat-value" style={{ color: 'var(--accent-rose)' }}>{totalOverturningMoment.toFixed(0)}</span>
            <span className="text-xs text-muted">ft-lb/ft</span>
          </div>
          <span className="text-xs text-dim">
            Soil: {motSoil.toFixed(0)} {hw > 0 ? `+ Water: ${motWater.toFixed(0)}` : ''}
          </span>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: hw > 0 ? '3px solid #38bdf8' : 'none' }}>
          <span className="stat-label">Pore Water Force (Pw)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: hw > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
              {pw.toFixed(0)}
            </span>
            <span className="text-xs text-muted">lb/ft</span>
          </div>
          <span className="text-xs text-dim">
            {hw > 0 ? `0.5·γw·hw² @ ${(hw/3).toFixed(2)}'` : '0 (Dry Backfill)'}
          </span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Effective Soil Thrust (P'a)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-amber">{paEffective.toFixed(0)}</span>
            <span className="text-xs text-muted">lb/ft</span>
          </div>
          <span className="text-xs text-dim">
            {hw > 0 ? `Submerged γ' = ${gammaPrime.toFixed(1)} pcf` : '0.5·Ka·γ·H²'}
          </span>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: `4px solid ${getFsColor(fsSliding)}` }}>
          <span className="stat-label">FS Sliding (Fres / Ptot)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: getFsColor(fsSliding) }}>
              {fsSliding.toFixed(2)}
            </span>
            <span className="text-xs" style={{ color: getFsColor(fsSliding), fontWeight: 600 }}>
              {fsSliding >= 1.5 ? '✓ SAFE' : '⚠ LOW'}
            </span>
          </div>
          <span className="text-xs text-dim">μ = tan(0.8φ)</span>
        </div>
      </div>

      {/* Embedded Generic Guidance Drawer */}
      {problem && (
        <GenericProblemViewer problem={problem} key={problem.id} />
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
                  <p className="text-xs text-muted">Rankine Active Lateral Pressure, Pore Water Pressure & Overturning Equilibrium</p>
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
                  Step 2: Lateral Effective Soil Forces & Moments
                </h4>
                {hw === 0 ? (
                  <div className="math-block">
                    Dry Backfill (No Water Table):
                    <br />
                    Pa = ½ · Ka · γ · H² = 0.5 × {ka.toFixed(4)} × {gammaSoil} pcf × ({height} ft)² = {paEffective.toFixed(2)} lb/ft
                    <br />
                    Arm above toe = H / 3 = {(height / 3).toFixed(3)} ft
                    <br />
                    MOT_soil = Pa × (H / 3) = {motSoil.toFixed(2)} ft-lb/ft
                  </div>
                ) : (
                  <div className="math-block">
                    Layered Analysis (Dry Height = {hDry.toFixed(1)} ft, Submerged Height = {hw.toFixed(1)} ft):
                    <br /><br />
                    <strong>(a) Upper Dry Soil (z = 0 to {hDry.toFixed(1)} ft):</strong>
                    <br />
                    Pa1 = ½ · Ka · γ · h_dry² = 0.5 × {ka.toFixed(4)} × {gammaSoil} × ({hDry.toFixed(1)})² = {pa1.toFixed(1)} lb/ft
                    <br />
                    Arm = hw + h_dry / 3 = {hw.toFixed(1)} + {(hDry / 3).toFixed(2)} = {armPa1.toFixed(3)} ft → M1 = {motPa1.toFixed(1)} ft-lb/ft
                    <br /><br />
                    <strong>(b) Surcharge on Submerged Layer from Dry Soil Overburden:</strong>
                    <br />
                    q_dry = γ · h_dry = {gammaSoil} × {hDry.toFixed(1)} = {(gammaSoil * hDry).toFixed(1)} psf
                    <br />
                    Pa2,rect = Ka · q_dry · hw = {ka.toFixed(4)} × {(gammaSoil * hDry).toFixed(1)} × {hw.toFixed(1)} = {pa2Rect.toFixed(1)} lb/ft
                    <br />
                    Arm = hw / 2 = {(hw / 2).toFixed(2)} ft → M2,rect = {motPa2Rect.toFixed(1)} ft-lb/ft
                    <br /><br />
                    <strong>(c) Submerged Soil Thrust (Buoyant Unit Weight γ' = {gammaSat} - 62.4 = {gammaPrime.toFixed(1)} pcf):</strong>
                    <br />
                    Pa2,tri = ½ · Ka · γ' · hw² = 0.5 × {ka.toFixed(4)} × {gammaPrime.toFixed(1)} × ({hw.toFixed(1)})² = {pa2Tri.toFixed(1)} lb/ft
                    <br />
                    Arm = hw / 3 = {(hw / 3).toFixed(3)} ft → M2,tri = {motPa2Tri.toFixed(1)} ft-lb/ft
                    <br /><br />
                    Total Effective Soil Moment: MOT_soil = {motPa1.toFixed(1)} + {motPa2Rect.toFixed(1)} + {motPa2Tri.toFixed(1)} = {motSoil.toFixed(1)} ft-lb/ft
                  </div>
                )}
              </div>

              {hw > 0 && (
                <div>
                  <h4 style={{ color: '#38bdf8', marginBottom: '0.4rem', fontSize: '1rem' }}>
                    Step 3: Hydrostatic Pore Water Pressure Thrust (Pw)
                  </h4>
                  <p className="text-sm">
                    Water is an isotropic fluid (Ka = 1.0) with unit weight γw = 62.4 pcf:
                  </p>
                  <div className="math-block">
                    Max Pore Water Pressure at Base: u_base = γw × hw = 62.4 × {hw.toFixed(1)} = {uBase.toFixed(1)} psf
                    <br />
                    Pw = ½ · γw · hw² = 0.5 × 62.4 × ({hw.toFixed(1)})² = {pw.toFixed(1)} lb/ft
                    <br />
                    Arm yw = hw / 3 = {(hw / 3).toFixed(3)} ft above Point O
                    <br />
                    MOT_water = Pw × (hw / 3) = {pw.toFixed(1)} × {(hw / 3).toFixed(3)} = {motWater.toFixed(1)} ft-lb/ft
                  </div>
                </div>
              )}

              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step {hw > 0 ? '4' : '3'}: Concrete Wall Weights & Resisting Moments about Toe Point O
                </h4>
                <div className="math-block">
                  W₁ (Toe Triangle) = ½ × {bTri.toFixed(1)} × {height} × {gammaConc} = {w1.toFixed(0)} lb/ft, Arm = ⅔ × {bTri.toFixed(1)} = {arm1.toFixed(3)} ft → MR₁ = {mr1.toFixed(1)} ft-lb/ft
                  <br />
                  W₂ (Back Stem) = {bRect.toFixed(1)} × {height} × {gammaConc} = {w2.toFixed(0)} lb/ft, Arm = {bTri.toFixed(1)} + ½ × {bRect.toFixed(1)} = {arm2.toFixed(3)} ft → MR₂ = {mr2.toFixed(1)} ft-lb/ft
                  <br /><br />
                  Total Resisting Moment: ΣMR = {mr1.toFixed(1)} + {mr2.toFixed(1)} = {totalResistingMoment.toFixed(1)} ft-lb/ft
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  Step {hw > 0 ? '5' : '4'}: Factor of Safety Against Overturning (FS_OT)
                </h4>
                <div className="math-block" style={{ fontSize: '1.05rem', color: '#10b981' }}>
                  Total Overturning Moment: MOT = {motSoil.toFixed(1)} {hw > 0 ? `+ ${motWater.toFixed(1)} (water) ` : ''}= {totalOverturningMoment.toFixed(1)} ft-lb/ft
                  <br />
                  FS_OT = ΣMR / MOT = {totalResistingMoment.toFixed(1)} / {totalOverturningMoment.toFixed(1)} = {fsOverturning.toFixed(2)}
                </div>
                <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
                  ✦ Engineering Insight: Notice how the water table lowers the factor of safety (from {hw > 0 ? '3.05 down to ' + fsOverturning.toFixed(2) : '3.05'} because pore water pressure pushes with Ka = 1.0). This demonstrates why weep holes and backfill drainage systems are essential for retaining wall integrity!
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
