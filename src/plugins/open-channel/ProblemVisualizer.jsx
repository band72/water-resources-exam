import { useState } from 'react';
import { createPortal } from 'react-dom';
import GenericProblemViewer from '../../components/GenericProblemViewer';

const OpenChannelVisualizer = ({ 
  diameter: initialDiameter = 18.8, 
  initialDepth = 15.7, 
  slope = 1.5, 
  n = 0.012,
  problem = null 
}) => {
  const [shape, setShape] = useState('circular');
  const [depth, setDepth] = useState(initialDepth);
  const [diameter, setDiameter] = useState(initialDiameter);
  const [bottomWidth, setBottomWidth] = useState(10);
  const [sideSlope, setSideSlope] = useState(2); // H:1V
  const channelSlope = slope;
  const manningsN = n;
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  // Geometric Calculations
  let area = 0;
  let perimeter = 0;
  let topWidth = 0;
  
  if (shape === 'circular') {
    const r = diameter / 2;
    // Guard against depth exceeding diameter or negative
    const clampedDepth = Math.min(Math.max(depth, 0.001), diameter);
    const theta = 2 * Math.acos(Math.min(Math.max(1 - (clampedDepth / r), -1), 1));
    area = (Math.pow(r, 2) / 2) * (theta - Math.sin(theta));
    perimeter = r * theta;
    topWidth = 2 * r * Math.sin(theta / 2);
  } else if (shape === 'rectangular') {
    area = bottomWidth * depth;
    perimeter = bottomWidth + (2 * depth);
    topWidth = bottomWidth;
  } else if (shape === 'trapezoidal') {
    area = (bottomWidth + (sideSlope * depth)) * depth;
    perimeter = bottomWidth + (2 * depth * Math.sqrt(1 + Math.pow(sideSlope, 2)));
    topWidth = bottomWidth + (2 * sideSlope * depth);
  } else if (shape === 'triangular') {
    area = sideSlope * Math.pow(depth, 2);
    perimeter = 2 * depth * Math.sqrt(1 + Math.pow(sideSlope, 2));
    topWidth = 2 * sideSlope * depth;
  }

  const hydraulicRadius = perimeter > 0 ? area / perimeter : 0;
  // Manning's Equation in US Customary units (Q = (1.49 / n) * A * R^(2/3) * S^(1/2))
  const slopeDecimal = channelSlope / 100;
  const flowRateCfs = (1.49 / manningsN) * (area / 144) * Math.pow(hydraulicRadius / 12, 2/3) * Math.sqrt(slopeDecimal);
  const velocityFps = area > 0 ? (flowRateCfs / (area / 144)) : 0;

  // SVG Dimensioning
  const viewBoxWidth = 440;
  const viewBoxHeight = 320;
  const centerX = viewBoxWidth / 2;
  const bottomY = 260;

  const renderShapeSVG = () => {
    let earthPath;
    let waterPath;
    
    const maxDim = Math.max(
      shape === 'circular' ? diameter : 0,
      shape === 'rectangular' ? bottomWidth : 0,
      shape === 'trapezoidal' ? bottomWidth + (2 * sideSlope * Math.max(depth, 20)) : 0,
      shape === 'triangular' ? 2 * sideSlope * Math.max(depth, 20) : 0,
      depth * 1.5
    );
    
    const scale = 200 / Math.max(maxDim, 10);
    const sDepth = depth * scale;
    const waterY = bottomY - sDepth;

    if (shape === 'circular') {
      const sRadius = (diameter / 2) * scale;
      const centerY = bottomY - sRadius;
      
      earthPath = `M ${centerX - sRadius - 25},${bottomY - sRadius * 2 - 25} L ${centerX + sRadius + 25},${bottomY - sRadius * 2 - 25} L ${centerX + sRadius + 25},${bottomY + 25} L ${centerX - sRadius - 25},${bottomY + 25} Z`;
      const pipePath = `M ${centerX},${bottomY} A ${sRadius} ${sRadius} 0 1 0 ${centerX},${bottomY - 2 * sRadius} A ${sRadius} ${sRadius} 0 1 0 ${centerX},${bottomY}`;
      
      const r = diameter / 2;
      const angle = 2 * Math.acos(Math.min(Math.max(1 - (depth / r), -1), 1));
      const chordLen = 2 * r * Math.sin(angle / 2) * scale;
      const isOverHalf = depth > r;
      const largeArc = isOverHalf ? 1 : 0;
      
      const p1x = centerX - (chordLen / 2);
      const p2x = centerX + (chordLen / 2);
      
      waterPath = `M ${p1x},${waterY} A ${sRadius} ${sRadius} 0 ${largeArc} 0 ${p2x},${waterY} Z`;

      return (
        <g>
          <path d={earthPath} fill="rgba(15, 23, 42, 0.6)" />
          {/* Outer Trench */}
          <path d={pipePath} fill="rgba(6, 11, 24, 0.95)" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="3" />
          {/* Water Fill */}
          <path d={waterPath} fill="url(#waterGradient)" opacity="0.85" />
          {/* Water Surface Line */}
          <line x1={p1x} y1={waterY} x2={p2x} y2={waterY} stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6,4" />
          {/* Centerline Crosshair */}
          <line x1={centerX} y1={bottomY - 2 * sRadius - 10} x2={centerX} y2={bottomY + 10} stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />
          <line x1={centerX - sRadius - 10} y1={centerY} x2={centerX + sRadius + 10} y2={centerY} stroke="rgba(255,255,255,0.08)" strokeDasharray="4,4" />
          {/* Depth Label */}
          <text x={p2x + 8} y={waterY + 4} fill="#38bdf8" fontSize="11" fontFamily="var(--font-mono)">
            d = {depth.toFixed(1)}"
          </text>
        </g>
      );
    } else {
      let sBottomWidth = 0;
      let sTopXLeft = 0;
      let sTopXRight = 0;
      let bankHeight = Math.max(depth + 5, 20) * scale;

      if (shape === 'rectangular') {
        sBottomWidth = bottomWidth * scale;
        sTopXLeft = centerX - (sBottomWidth / 2);
        sTopXRight = centerX + (sBottomWidth / 2);
      } else if (shape === 'trapezoidal') {
        sBottomWidth = bottomWidth * scale;
        const horizOffset = bankHeight * sideSlope;
        sTopXLeft = centerX - (sBottomWidth / 2) - horizOffset;
        sTopXRight = centerX + (sBottomWidth / 2) + horizOffset;
      } else if (shape === 'triangular') {
        sBottomWidth = 0;
        const horizOffset = bankHeight * sideSlope;
        sTopXLeft = centerX - horizOffset;
        sTopXRight = centerX + horizOffset;
      }

      const waterTopXLeft = centerX - (topWidth * scale / 2);
      const waterTopXRight = centerX + (topWidth * scale / 2);

      earthPath = `M 0,${bottomY - bankHeight} L ${sTopXLeft},${bottomY - bankHeight} L ${centerX - (sBottomWidth/2)},${bottomY} L ${centerX + (sBottomWidth/2)},${bottomY} L ${sTopXRight},${bottomY - bankHeight} L ${viewBoxWidth},${bottomY - bankHeight} L ${viewBoxWidth},${viewBoxHeight} L 0,${viewBoxHeight} Z`;
      waterPath = `M ${waterTopXLeft},${waterY} L ${centerX - (sBottomWidth/2)},${bottomY} L ${centerX + (sBottomWidth/2)},${bottomY} L ${waterTopXRight},${waterY} Z`;

      return (
        <g>
          <path d={earthPath} fill="rgba(15, 23, 42, 0.6)" />
          <path d={`M ${sTopXLeft},${bottomY - bankHeight} L ${centerX - (sBottomWidth/2)},${bottomY} L ${centerX + (sBottomWidth/2)},${bottomY} L ${sTopXRight},${bottomY - bankHeight}`} fill="none" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="3" />
          <path d={waterPath} fill="url(#waterGradient)" opacity="0.85" />
          <line x1={waterTopXLeft} y1={waterY} x2={waterTopXRight} y2={waterY} stroke="#38bdf8" strokeWidth="2.5" strokeDasharray="6,4" />
        </g>
      );
    }
  };

  const applyPreset = (preset) => {
    if (shape === 'circular') {
      if (preset === 'quarter') setDepth(diameter * 0.25);
      if (preset === 'half') setDepth(diameter * 0.5);
      if (preset === 'eighty') setDepth(diameter * 0.81); // Max velocity in circular pipe occurs at d ≈ 0.81 D
      if (preset === 'full') setDepth(diameter);
      if (preset === 'problem') setDepth(15.7);
    } else {
      if (preset === 'half') setDepth(10);
      if (preset === 'full') setDepth(20);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Visualizer Workbench */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)', gap: '2.5rem', alignItems: 'center' }}>
          
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem' }}>Parametric Channel Controls</h3>
                <p className="text-xs text-muted">Manning's open channel flow solver</p>
              </div>
              <span className="glass-badge" style={{ color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                Live Calculator
              </span>
            </div>

            {/* Shape Select */}
            <div className="control-group">
              <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Channel Cross Section
              </label>
              <select 
                value={shape} 
                onChange={(e) => setShape(e.target.value)}
                className="custom-select"
              >
                <option value="circular">Circular Culvert / Pipe</option>
                <option value="rectangular">Rectangular Flume</option>
                <option value="trapezoidal">Trapezoidal Lined Canal</option>
                <option value="triangular">Triangular V-Ditch</option>
              </select>
            </div>

            {/* Depth Slider & Presets */}
            <div className="control-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Water Depth (d)
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '1.1rem' }}>
                  {depth.toFixed(1)}"
                </span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max={shape === 'circular' ? diameter : 40} 
                step="0.1" 
                value={depth} 
                onChange={(e) => setDepth(parseFloat(e.target.value))} 
              />
              
              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => applyPreset('problem')}>
                  Reset (15.7")
                </button>
                <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => applyPreset('half')}>
                  0.5 D (Half)
                </button>
                <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => applyPreset('eighty')}>
                  0.81 D (Max V)
                </button>
                <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => applyPreset('full')}>
                  1.0 D (Full)
                </button>
              </div>
            </div>

            {/* Geometry Specific Inputs */}
            {shape === 'circular' && (
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Pipe Inside Diameter (D)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', fontSize: '1.1rem' }}>
                    {diameter.toFixed(1)}"
                  </span>
                </div>
                <input 
                  type="range" 
                  min="6" 
                  max="48" 
                  step="0.1" 
                  value={diameter} 
                  onChange={(e) => {
                    const newD = parseFloat(e.target.value);
                    setDiameter(newD);
                    if (depth > newD) setDepth(newD);
                  }} 
                />
              </div>
            )}

            {(shape === 'rectangular' || shape === 'trapezoidal') && (
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bottom Width (b)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-blue)', fontSize: '1.1rem' }}>
                    {bottomWidth.toFixed(1)} ft
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  step="0.5" 
                  value={bottomWidth} 
                  onChange={(e) => setBottomWidth(parseFloat(e.target.value))} 
                />
              </div>
            )}

            {(shape === 'trapezoidal' || shape === 'triangular') && (
              <div className="control-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="text-xs text-muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Side Slope (z : 1)
                  </label>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-indigo)', fontSize: '1.1rem' }}>
                    {sideSlope.toFixed(1)}:1
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="5" 
                  step="0.25" 
                  value={sideSlope} 
                  onChange={(e) => setSideSlope(parseFloat(e.target.value))} 
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowSolutionModal(true)} 
                className="solution-btn" 
                style={{ flex: 1 }}
              >
                📘 Derivation & Theory
              </button>
            </div>
          </div>

          {/* Canvas Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div 
              className="blueprint-grid"
              style={{ 
                width: '100%', 
                height: '320px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-color)', 
                background: 'rgba(5, 9, 18, 0.85)',
                boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8), 0 10px 30px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
                <defs>
                  <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                {renderShapeSVG()}
              </svg>

              {/* Water status pill overlay */}
              <div style={{ position: 'absolute', bottom: '1rem', right: '1rem' }}>
                <span className="glass-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                  d / D = {(depth / diameter).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calculated Engineering Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel stat-card">
          <span className="stat-label">Flow Area (A)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-cyan">{area.toFixed(2)}</span>
            <span className="text-xs text-muted">sq in</span>
          </div>
          <span className="text-xs text-dim">{(area / 144).toFixed(3)} sq ft</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Wetted Perimeter (P)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: 'var(--accent-indigo)' }}>{perimeter.toFixed(2)}</span>
            <span className="text-xs text-muted">inches</span>
          </div>
          <span className="text-xs text-dim">{(perimeter / 12).toFixed(3)} ft</span>
        </div>

        <div className="glass-panel stat-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
          <span className="stat-label">Hydraulic Radius (Rh)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value" style={{ color: 'var(--accent-blue)' }}>{hydraulicRadius.toFixed(2)}</span>
            <span className="text-xs text-muted">inches</span>
          </div>
          <span className="text-xs text-dim">{(hydraulicRadius / 12).toFixed(3)} ft (Rh = A / P)</span>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-label">Discharge Capacity (Q)</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span className="stat-value text-gradient-emerald">{flowRateCfs.toFixed(2)}</span>
            <span className="text-xs text-muted">cfs</span>
          </div>
          <span className="text-xs text-dim">V = {velocityFps.toFixed(2)} ft/s</span>
        </div>
      </div>

      {/* Embedded Generic Problem Guidance Drawer */}
      {problem && (
        <GenericProblemViewer problem={problem} key={problem.id} />
      )}

      {/* Solution & Derivation Modal */}
      {showSolutionModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolutionModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🌊</span>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>NCEES Open Channel Formulation</h3>
                  <p className="text-xs text-muted">Partially full circular pipe & Manning's equation</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowSolutionModal(false)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', lineHeight: '1.6' }}>
              <div>
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  1. Central Angle (θ) in Radians
                </h4>
                <p className="text-sm">
                  With pipe diameter D = {diameter}", radius r = {(diameter / 2).toFixed(2)}", and water depth d = {depth.toFixed(1)}":
                </p>
                <div className="math-block">
                  cos(θ / 2) = (r - d) / r = {(1 - (depth / (diameter / 2))).toFixed(4)}
                  <br />
                  θ = 2 · arccos(1 - d / r) = {(2 * Math.acos(1 - (depth / (diameter / 2)))).toFixed(4)} rad
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  2. Cross-Sectional Flow Area (A)
                </h4>
                <div className="math-block">
                  A = (r² / 2) · [θ - sin(θ)] = {area.toFixed(2)} sq in ({(area / 144).toFixed(3)} sq ft)
                </div>
              </div>

              <div>
                <h4 style={{ color: 'var(--accent-indigo)', marginBottom: '0.4rem', fontSize: '1rem' }}>
                  3. Wetted Perimeter (P) & Hydraulic Radius (Rh)
                </h4>
                <div className="math-block">
                  P = r · θ = {(diameter / 2).toFixed(2)} · {(2 * Math.acos(1 - (depth / (diameter / 2)))).toFixed(4)} = {perimeter.toFixed(2)}" ({(perimeter / 12).toFixed(3)} ft)
                  <br />
                  Rh = A / P = {area.toFixed(2)} / {perimeter.toFixed(2)} = {hydraulicRadius.toFixed(2)}" ({(hydraulicRadius / 12).toFixed(3)} ft)
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <p className="text-xs text-muted">
                  ✦ <strong>Exam Tip:</strong> Circular pipes achieve maximum discharge capacity at depth <strong>d = 0.94 D</strong> (due to reduced top-surface drag), and maximum velocity at <strong>d = 0.81 D</strong>.
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

export default OpenChannelVisualizer;
