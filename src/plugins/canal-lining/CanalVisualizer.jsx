import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const CanalVisualizer = ({ 
  initialLength = 227, 
  initialWaste = 12, 
  initialThickness = 7, 
  initialBottomWidth = 9, 
  initialDepth = 14 
}) => {
  const [length, setLength] = useState(initialLength);
  const [waste, setWaste] = useState(initialWaste);
  const [thickness, setThickness] = useState(initialThickness);
  const [bottomWidth, setBottomWidth] = useState(initialBottomWidth);
  const [depth, setDepth] = useState(initialDepth);
  const [showSolution, setShowSolution] = useState(false);
  
  // Math Calculations (Slope 3H:2V)
  const horizLength = depth * (3/2);
  const slopeLength = Math.sqrt(Math.pow(depth, 2) + Math.pow(horizLength, 2));
  const crossSectionalAreaFeet = ((2 * slopeLength) + bottomWidth) * (thickness / 12);
  const volumeCubicFeet = crossSectionalAreaFeet * length;
  const volumeCubicYards = volumeCubicFeet / 27;
  const deliveredVolume = volumeCubicYards * (1 + (waste / 100));

  // SVG Drawing Logic
  const viewBoxWidth = 400;
  const viewBoxHeight = 250;
  const topWidth = bottomWidth + (2 * horizLength);
  
  // Dynamic scaling to fit the SVG box (adding some padding)
  const maxCanalWidth = Math.max(topWidth, 30); // minimum scale width
  const scale = 300 / maxCanalWidth; // target width ~300px
  
  const svgBottomWidth = bottomWidth * scale;
  const svgTopWidth = topWidth * scale;
  const svgDepth = depth * scale;
  const svgThickness = thickness * 0.5; // Visual scale for thickness
  
  const centerX = viewBoxWidth / 2;
  const startY = 30; // Top of canal
  const bottomY = startY + svgDepth;
  
  // Coordinates for the trapezoid
  const topLeftX = centerX - (svgTopWidth / 2);
  const topRightX = centerX + (svgTopWidth / 2);
  const bottomLeftX = centerX - (svgBottomWidth / 2);
  const bottomRightX = centerX + (svgBottomWidth / 2);

  // Outer boundary (earth)
  const earthPath = `M 0,${startY} L ${topLeftX},${startY} L ${bottomLeftX},${bottomY} L ${bottomRightX},${bottomY} L ${topRightX},${startY} L ${viewBoxWidth},${startY} L ${viewBoxWidth},${viewBoxHeight} L 0,${viewBoxHeight} Z`;
  
  // Concrete lining
  const liningPath = `M ${topLeftX},${startY} L ${bottomLeftX},${bottomY} L ${bottomRightX},${bottomY} L ${topRightX},${startY}`;

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">
        {/* Controls */}
        <div className="visualizer-controls">
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Quantity Estimating: Concrete Lining</h3>
            <p className="text-muted text-sm">Interactive trapezoidal canal cross-section</p>
          </div>
          
          <div className="control-group">
            <div className="control-header">
              <label>Canal Depth (ft)</label>
              <span className="value-display">{depth.toFixed(1)}</span>
            </div>
            <input type="range" min="5" max="30" step="0.5" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label>Bottom Width (ft)</label>
              <span className="value-display">{bottomWidth.toFixed(1)}</span>
            </div>
            <input type="range" min="2" max="30" step="0.5" value={bottomWidth} onChange={(e) => setBottomWidth(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label>Lining Thickness (in)</label>
              <span className="value-display">{thickness.toFixed(1)}</span>
            </div>
            <input type="range" min="2" max="18" step="0.5" value={thickness} onChange={(e) => setThickness(parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <div className="control-header">
              <label>Waste Allowance (%)</label>
              <span className="value-display">{waste.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="30" step="1" value={waste} onChange={(e) => setWaste(parseFloat(e.target.value))} />
          </div>
          
          <div className="stats-bar pt-4 mt-2 mb-4">
            <span className="text-sm text-muted">Length: <strong className="text-main">{length} ft</strong></span>
            <span className="text-sm text-muted">Side Slope: <strong className="text-main">3H:2V</strong></span>
          </div>
          
          <button onClick={() => setShowSolution(true)} className="solution-btn">
            View Solution & Background
          </button>
        </div>

        {/* SVG Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '300px' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Earth cross section */}
            <path 
              d={earthPath} 
              fill="rgba(42, 33, 24, 0.6)" 
              stroke="none"
            />
            
            {/* Earth surface line */}
            <line x1="0" y1={startY} x2={viewBoxWidth} y2={startY} stroke="rgba(139, 148, 158, 0.4)" strokeWidth="2" strokeDasharray="5,5" />
            
            {/* Concrete Lining */}
            <path 
              d={liningPath} 
              fill="none"
              stroke="url(#concreteGrad)"
              strokeWidth={svgThickness}
              style={{ filter: 'drop-shadow(0 0 8px rgba(168, 178, 193, 0.5))' }}
            />
            
            {/* Dimensions */}
            <line x1={centerX} y1={startY} x2={centerX} y2={bottomY} stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={centerX + 5} y={startY + (svgDepth/2)} fill="var(--accent-cyan)" fontSize="12" fontWeight="bold">D = {depth}'</text>
            
            <line x1={bottomLeftX} y1={bottomY + 15} x2={bottomRightX} y2={bottomY + 15} stroke="rgba(56, 189, 248, 0.8)" strokeWidth="1" />
            <text x={centerX} y={bottomY + 30} fill="var(--accent-cyan)" fontSize="12" fontWeight="bold" textAnchor="middle">W = {bottomWidth}'</text>
            
            <defs>
              <linearGradient id="concreteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-label">Theoretical Volume (V)</span>
          <span className="stat-value text-gradient">{volumeCubicYards.toFixed(1)}<span className="text-sm ml-1 text-muted">yd³</span></span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Delivered Volume</span>
          <span className="stat-value" style={{ color: 'var(--accent-indigo)'}}>{deliveredVolume.toFixed(1)}<span className="text-sm ml-1 text-muted">yd³</span></span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Slope Length</span>
          <span className="stat-value">{slopeLength.toFixed(2)}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
      </div>

      {/* Solution Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>Solution & Background</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section">
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>Background Concepts (Explained for a 6th Grader)</h4>
                <p>Imagine you are building a giant dirt slide for water to flow through. To make sure the water doesn't wash the dirt away, you need to spray a thick layer of concrete along the sides and the bottom.</p>
                <ul>
                  <li><strong>Cross-Sectional Area:</strong> If you take a giant knife and slice the canal right down the middle, the shape you see is the cross-section. The area of the concrete is just the total length of the sides and bottom multiplied by how thick the concrete is!</li>
                  <li><strong>Slope Length (Hypotenuse):</strong> The sides of the canal are slanted. If you know how deep the canal is (vertical) and how far out the sides reach (horizontal), you can use the Pythagorean theorem (A² + B² = C²) to find the exact slanted length.</li>
                  <li><strong>Waste Allowance:</strong> When pouring concrete in real life, some spills, some gets stuck in the truck, and the dirt isn't perfectly smooth. Engineers always order a little bit extra (like 12% more) just in case!</li>
                </ul>
              </div>

              <div className="explanation-section" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Step-by-Step Solution</h4>
                
                <div className="step">
                  <strong>Step 1: Find the horizontal length of the side slope.</strong>
                  <p>Using the 3:2 (Horizontal:Vertical) slope ratio and depth of 14 ft:</p>
                  <code className="math-block">Horizontal length = 14 ft × (3 / 2) = 21.0 ft</code>
                </div>
                
                <div className="step">
                  <strong>Step 2: Calculate actual slope length (hypotenuse).</strong>
                  <p>Apply the Pythagorean theorem:</p>
                  <code className="math-block">Slope length = √(14² + 21²) = 25.24 ft</code>
                </div>
                
                <div className="step">
                  <strong>Step 3: Find the total cross-sectional area of the concrete.</strong>
                  <p>The concrete lines both side slopes and the 9 ft bottom width. The 7-inch thickness must be converted to feet (7/12):</p>
                  <code className="math-block">Area = [(2 × 25.24) + 9] × (7 / 12) = 34.70 ft²</code>
                </div>

                <div className="step">
                  <strong>Step 4: Calculate Theoretical Volume (yd³)</strong>
                  <p>Multiply the cross-sectional area by the 227 ft length, then divide by 27 (since there are 27 cubic feet in a cubic yard):</p>
                  <code className="math-block">Volume = (34.70 × 227) / 27 = 291.7 yd³</code>
                </div>

                <div className="step">
                  <strong>Step 5: Factor in Waste Allowance.</strong>
                  <p>Multiply theoretical volume by 1.12 to get final delivered volume:</p>
                  <code className="math-block">Delivered = 291.7 yd³ × 1.12 = 326.7 yd³ (Rounds to 327 yd³)</code>
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

export default CanalVisualizer;
