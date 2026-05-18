import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

const OpenChannelVisualizer = ({ initialShape = 'circular', initialDepth = 15.7 }) => {
  const [shape, setShape] = useState(initialShape);
  const [depth, setDepth] = useState(initialDepth);
  
  // Specific parameters
  const [diameter, setDiameter] = useState(18.8); // Circular
  const [bottomWidth, setBottomWidth] = useState(10); // Rectangular & Trapezoidal
  const [sideSlope, setSideSlope] = useState(2); // Trapezoidal & Triangular (H:1V)
  
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Math Calculations based on shape
  let area = 0;
  let perimeter = 0;
  let topWidth = 0;
  
  if (shape === 'circular') {
    const r = diameter / 2;
    // Central angle in radians
    const theta = 2 * Math.acos(1 - (depth / r));
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

  const hydraulicRadius = area / perimeter;

  // SVG Drawing Logic
  const viewBoxWidth = 400;
  const viewBoxHeight = 300;
  const centerX = viewBoxWidth / 2;
  const bottomY = 250;

  const renderShapeSVG = () => {
    let earthPath = "";
    let waterPath = "";
    
    // Calculate dynamic scaling
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
      
      earthPath = `M ${centerX - sRadius - 20},${bottomY - sRadius * 2 - 20} L ${centerX + sRadius + 20},${bottomY - sRadius * 2 - 20} L ${centerX + sRadius + 20},${bottomY + 20} L ${centerX - sRadius - 20},${bottomY + 20} Z`;
      const pipePath = `M ${centerX},${bottomY} A ${sRadius} ${sRadius} 0 1 0 ${centerX},${bottomY - 2 * sRadius} A ${sRadius} ${sRadius} 0 1 0 ${centerX},${bottomY}`;
      
      // Water level calculation for circle
      const r = diameter / 2;
      const angle = 2 * Math.acos(1 - (depth / r));
      const chordLen = 2 * r * Math.sin(angle / 2) * scale;
      const isOverHalf = depth > r;
      const largeArc = isOverHalf ? 1 : 0;
      
      const p1x = centerX - (chordLen / 2);
      const p2x = centerX + (chordLen / 2);
      
      waterPath = `M ${p1x},${waterY} A ${sRadius} ${sRadius} 0 ${largeArc} 0 ${p2x},${waterY} Z`;

      return (
        <>
          <path d={earthPath} fill="rgba(42, 33, 24, 0.4)" />
          <path d={pipePath} fill="rgba(20, 25, 30, 0.9)" stroke="rgba(148, 163, 184, 0.6)" strokeWidth="4" />
          <path d={waterPath} fill="var(--accent-blue)" opacity="0.7" />
          <line x1={p1x} y1={waterY} x2={p2x} y2={waterY} stroke="var(--accent-cyan)" strokeWidth="2" strokeDasharray="5,5" />
        </>
      );
    } 
    
    else {
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
        const horizOffset = bankHeight * sideSlope; // For full bank height
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
        <>
          <path d={earthPath} fill="rgba(42, 33, 24, 0.6)" />
          {/* Channel boundary outline */}
          <path d={`M ${sTopXLeft},${bottomY - bankHeight} L ${centerX - (sBottomWidth/2)},${bottomY} L ${centerX + (sBottomWidth/2)},${bottomY} L ${sTopXRight},${bottomY - bankHeight}`} fill="none" stroke="#94a3b8" strokeWidth="3" />
          {/* Water */}
          <path d={waterPath} fill="var(--accent-blue)" opacity="0.7" />
          <line x1={waterTopXLeft} y1={waterY} x2={waterTopXRight} y2={waterY} stroke="var(--accent-cyan)" strokeWidth="2" strokeDasharray="5,5" />
        </>
      );
    }
  };

  const getHint = () => {
    switch(shape) {
      case 'circular': return "Hint: Use θ = 2 * arccos(1 - d/r) to find the central angle in radians, then A = (r²/2)(θ - sinθ).";
      case 'rectangular': return "Hint: Area = Width × Depth. Perimeter = Width + (2 × Depth).";
      case 'trapezoidal': return "Hint: Break it down! Area = (Bottom Width + (SideSlope × Depth)) × Depth.";
      case 'triangular': return "Hint: Area = SideSlope × Depth². Perimeter = 2 × Depth × √(1 + SideSlope²).";
      default: return "";
    }
  };

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">
        <div className="visualizer-controls">
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Open Channel Hydraulics</h3>
            <p className="text-muted text-sm">Design and analyze various channel shapes.</p>
          </div>
          
          <div className="control-group mt-4">
            <div className="control-header">
              <label>Channel Shape</label>
            </div>
            <select 
              value={shape} 
              onChange={(e) => setShape(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            >
              <option value="circular">Circular Pipe</option>
              <option value="rectangular">Rectangular</option>
              <option value="trapezoidal">Trapezoidal</option>
              <option value="triangular">V-Notch (Triangular)</option>
            </select>
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Water Depth (d)</label>
              <span className="value-display">{depth.toFixed(1)}</span>
            </div>
            <input type="range" min="0.1" max={shape === 'circular' ? diameter : 30} step="0.1" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value))} />
          </div>

          {shape === 'circular' && (
            <div className="control-group mt-2">
              <div className="control-header">
                <label>Pipe Diameter (D)</label>
                <span className="value-display">{diameter.toFixed(1)}</span>
              </div>
              <input type="range" min="1" max="100" step="0.5" value={diameter} onChange={(e) => {
                const newD = parseFloat(e.target.value);
                setDiameter(newD);
                if (depth > newD) setDepth(newD);
              }} />
            </div>
          )}

          {(shape === 'rectangular' || shape === 'trapezoidal') && (
            <div className="control-group mt-2">
              <div className="control-header">
                <label>Bottom Width (b)</label>
                <span className="value-display">{bottomWidth.toFixed(1)}</span>
              </div>
              <input type="range" min="1" max="50" step="1" value={bottomWidth} onChange={(e) => setBottomWidth(parseFloat(e.target.value))} />
            </div>
          )}

          {(shape === 'trapezoidal' || shape === 'triangular') && (
            <div className="control-group mt-2">
              <div className="control-header">
                <label>Side Slope (z) [H:1V]</label>
                <span className="value-display">{sideSlope.toFixed(1)}:1</span>
              </div>
              <input type="range" min="0.5" max="5" step="0.5" value={sideSlope} onChange={(e) => setSideSlope(parseFloat(e.target.value))} />
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setShowHint(!showHint)} className="solution-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>
              💡 Hint
            </button>
            <button onClick={() => setShowSolution(true)} className="solution-btn" style={{ flex: 2 }}>
              View Full Solution
            </button>
          </div>

          {showHint && (
            <div className="glass-panel mt-2" style={{ borderLeft: '4px solid var(--accent-cyan)', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.05)' }}>
              <p className="text-sm m-0">{getHint()}</p>
            </div>
          )}
        </div>

        {/* SVG Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '300px' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {renderShapeSVG()}
          </svg>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-label">Flow Area (A)</span>
          <span className="stat-value text-gradient">{area.toFixed(2)}<span className="text-sm ml-1 text-muted">sq units</span></span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Wetted Perimeter (P)</span>
          <span className="stat-value" style={{ color: 'var(--accent-indigo)'}}>{perimeter.toFixed(2)}<span className="text-sm ml-1 text-muted">units</span></span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Hydraulic Radius (R)</span>
          <span className="stat-value text-muted">{hydraulicRadius.toFixed(2)}<span className="text-sm ml-1 text-muted">units</span></span>
        </div>
      </div>

      {/* Solution Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>Solution & Background: {shape.charAt(0).toUpperCase() + shape.slice(1)} Channel</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section">
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>Core Concept</h4>
                <p><strong>Hydraulic Radius (R)</strong> is the ratio of the cross-sectional area of the water (A) to the length of the channel boundary touching the water (Wetted Perimeter, P). It is a key metric in the Manning's Equation to determine how fast water will flow! A larger radius means less friction from the walls.</p>
              </div>

              <div className="explanation-section" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Mathematical Formulas</h4>
                {shape === 'circular' && (
                  <>
                    <code className="math-block">θ (radians) = 2 × arccos(1 - depth/radius)</code>
                    <code className="math-block">Area (A) = (radius² / 2) × (θ - sin(θ))</code>
                    <code className="math-block">Wetted Perimeter (P) = radius × θ</code>
                  </>
                )}
                {shape === 'rectangular' && (
                  <>
                    <code className="math-block">Area (A) = Width × Depth</code>
                    <code className="math-block">Wetted Perimeter (P) = Width + (2 × Depth)</code>
                  </>
                )}
                {shape === 'trapezoidal' && (
                  <>
                    <code className="math-block">Area (A) = (Width + z × Depth) × Depth</code>
                    <code className="math-block">Wetted Perimeter (P) = Width + 2 × Depth × √(1 + z²)</code>
                  </>
                )}
                {shape === 'triangular' && (
                  <>
                    <code className="math-block">Area (A) = z × Depth²</code>
                    <code className="math-block">Wetted Perimeter (P) = 2 × Depth × √(1 + z²)</code>
                  </>
                )}
                <code className="math-block mt-2">Hydraulic Radius (R) = A / P = {hydraulicRadius.toFixed(2)}</code>
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
