import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const GradingVisualizer = () => {
  const [clElev, setClElev] = useState(100.00);
  const [roadSlope, setRoadSlope] = useState(-2.0); // %
  const [clToCurb, setClToCurb] = useState(12.0); // ft
  const [curbHeight, setCurbHeight] = useState(0.5); // ft (6 inches)
  const [drivewaySlope, setDrivewaySlope] = useState(2.0); // %
  const [drivewayLength, setDrivewayLength] = useState(30.0); // ft
  
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // --- MATH CALCULATIONS ---
  // 1. Edge of Pavement (EOP) or Gutter Elevation
  const eopElev = clElev + (clToCurb * (roadSlope / 100));
  
  // 2. Top of Curb (TOC) Elevation
  const tocElev = eopElev + curbHeight;
  
  // 3. Garage Elevation
  const garageElev = tocElev + (drivewayLength * (drivewaySlope / 100));
  
  // 4. House FFE (0.55 ft above garage)
  const ffe = garageElev + 0.55;

  // --- SVG DRAWING LOGIC ---
  const viewBoxWidth = 800;
  const viewBoxHeight = 400;
  
  // We need to map real-world feet to screen pixels.
  // X scale: Total distance is clToCurb + drivewayLength + houseDepth (let's say 20 ft for house)
  const totalX = clToCurb + drivewayLength + 20;
  const scaleX = (viewBoxWidth - 100) / totalX; // Leave 50px padding on each side
  const startX = 50;

  // Y scale: The elevations are around 100. Let's map elevation 98 to Y=350 (bottom) and 105 to Y=50 (top)
  // Let's make it dynamic based on the min/max elevations.
  const minElev = Math.min(clElev, eopElev) - 1;
  const maxElev = Math.max(ffe, clElev) + 3;
  const totalY = maxElev - minElev;
  const scaleY = (viewBoxHeight - 100) / totalY;
  
  // Helper to map elevation to Y pixel (inverted because SVG Y goes down)
  const getY = (elev) => 350 - ((elev - minElev) * scaleY);
  
  // X coordinates
  const clX = startX;
  const curbX = startX + (clToCurb * scaleX);
  const garageX = curbX + (drivewayLength * scaleX);
  const backHouseX = garageX + (20 * scaleX);

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel" style={{ width: '100%' }}>
        <div className="visualizer-controls" style={{ minWidth: '350px' }}>
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Site Grading & FFE Simulator</h3>
            <p className="text-muted text-sm">Site Development: Profile Grading</p>
          </div>
          
          <div className="control-group mt-3">
            <div className="control-header">
              <label>Centerline (CL) Elev (ft)</label>
              <span className="value-display">{clElev.toFixed(2)}</span>
            </div>
            <input type="range" min="90" max="110" step="0.5" value={clElev} onChange={(e) => setClElev(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Road Cross Slope (%)</label>
              <span className="value-display">{roadSlope.toFixed(1)}%</span>
            </div>
            <input type="range" min="-5" max="0" step="0.5" value={roadSlope} onChange={(e) => setRoadSlope(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Distance CL to Curb (ft)</label>
              <span className="value-display">{clToCurb.toFixed(1)}</span>
            </div>
            <input type="range" min="10" max="24" step="1" value={clToCurb} onChange={(e) => setClToCurb(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Driveway Length (ft)</label>
              <span className="value-display">{drivewayLength.toFixed(1)}</span>
            </div>
            <input type="range" min="15" max="100" step="1" value={drivewayLength} onChange={(e) => setDrivewayLength(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Driveway Slope (%)</label>
              <span className="value-display">{drivewaySlope.toFixed(1)}%</span>
            </div>
            <input type="range" min="0.5" max="10" step="0.5" value={drivewaySlope} onChange={(e) => setDrivewaySlope(parseFloat(e.target.value))} />
            <p className="text-xs text-muted mt-1" style={{color: drivewaySlope < 1 ? '#ef4444' : ''}}>
              {drivewaySlope < 1 ? '⚠️ Warning: Slope < 1% may cause poor drainage!' : 'Positive drainage achieved.'}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setShowSolution(true)} className="solution-btn" style={{ flex: 1, background: 'var(--accent-indigo)' }}>
              View Step-by-Step Math
            </button>
          </div>
        </div>

        {/* Profile Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '400px', flex: 1, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            
            {/* Background Grid */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Earth Mass Fill */}
            <path d={`M ${clX} ${getY(clElev)} L ${curbX} ${getY(eopElev)} L ${curbX} ${getY(tocElev)} L ${garageX} ${getY(garageElev)} L ${garageX} ${getY(ffe)} L ${backHouseX} ${getY(ffe)} L ${backHouseX} 400 L ${clX} 400 Z`} fill="#451a03" opacity="0.6" />

            {/* 1. Road Centerline to Edge of Pavement (Gutter) */}
            <line x1={clX} y1={getY(clElev)} x2={curbX} y2={getY(eopElev)} stroke="#94a3b8" strokeWidth="6" />
            <circle cx={clX} cy={getY(clElev)} r="4" fill="#38bdf8" />
            <text x={clX - 10} y={getY(clElev) - 15} fill="#38bdf8" fontSize="12" fontWeight="bold">CL: {clElev.toFixed(2)}'</text>

            {/* 2. Curb Face */}
            <line x1={curbX} y1={getY(eopElev)} x2={curbX} y2={getY(tocElev)} stroke="#cbd5e1" strokeWidth="4" />
            <text x={curbX - 25} y={getY(eopElev) + 20} fill="#94a3b8" fontSize="12">Gutter: {eopElev.toFixed(2)}'</text>
            <text x={curbX - 10} y={getY(tocElev) - 10} fill="#cbd5e1" fontSize="12">TOC: {tocElev.toFixed(2)}'</text>

            {/* 3. Driveway */}
            <line x1={curbX} y1={getY(tocElev)} x2={garageX} y2={getY(garageElev)} stroke="#78716c" strokeWidth="4" />
            <text x={(curbX + garageX) / 2 - 20} y={getY((tocElev + garageElev) / 2) - 10} fill="#fcd34d" fontSize="12">{drivewaySlope.toFixed(1)}%</text>
            
            {/* 4. Garage Slab */}
            <line x1={garageX} y1={getY(garageElev)} x2={garageX + 10} y2={getY(garageElev)} stroke="#fbbf24" strokeWidth="4" />
            <circle cx={garageX} cy={getY(garageElev)} r="4" fill="#fbbf24" />
            <text x={garageX - 15} y={getY(garageElev) + 20} fill="#fbbf24" fontSize="12" fontWeight="bold">Garage: {garageElev.toFixed(2)}'</text>

            {/* 5. House FFE (Step up) */}
            <line x1={garageX + 10} y1={getY(garageElev)} x2={garageX + 10} y2={getY(ffe)} stroke="#fb923c" strokeWidth="2" strokeDasharray="4,2" />
            <line x1={garageX + 10} y1={getY(ffe)} x2={backHouseX} y2={getY(ffe)} stroke="#fb923c" strokeWidth="6" />
            <circle cx={garageX + 10} cy={getY(ffe)} r="4" fill="#fb923c" />
            <text x={garageX + 15} y={getY(ffe) - 10} fill="#fb923c" fontSize="14" fontWeight="bold">FFE: {ffe.toFixed(2)}'</text>

            {/* Dimensions (Bottom) */}
            <line x1={clX} y1={360} x2={curbX} y2={360} stroke="#a8a29e" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={(clX + curbX) / 2 - 10} y={355} fill="#a8a29e" fontSize="11">{clToCurb} ft</text>

            <line x1={curbX} y1={360} x2={garageX} y2={360} stroke="#a8a29e" strokeWidth="1" />
            <text x={(curbX + garageX) / 2 - 15} y={355} fill="#a8a29e" fontSize="11">{drivewayLength} ft driveway</text>

            {/* SVG Markers */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8a29e" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>

      {/* Simplified Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid #38bdf8' }}>
          <span className="stat-label">Total Distance (CL to Garage)</span>
          <span className="stat-value text-gradient">{(clToCurb + drivewayLength).toFixed(1)}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid #fbbf24' }}>
          <span className="stat-label">Garage Elevation</span>
          <span className="stat-value" style={{ color: '#fbbf24'}}>{garageElev.toFixed(2)}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid #fb923c' }}>
          <span className="stat-label">Finished Floor (FFE)</span>
          <span className="stat-value" style={{ color: '#fb923c'}}>{ffe.toFixed(2)}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
      </div>

      {/* Math Breakdown Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>📐 Grading Math Breakdown</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section mb-4" style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '0.5rem' }}>Step 1: Edge of Pavement (Gutter)</h4>
                <p>Start at the Centerline and drop down the cross-slope of the road to the edge.</p>
                <code>EOP = CL Elev + (Distance × Slope)</code><br/>
                <code>EOP = {clElev.toFixed(2)} + ({clToCurb} × {roadSlope/100}) = {(eopElev).toFixed(2)} ft</code>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(203, 213, 225, 0.05)', padding: '1rem', borderLeft: '4px solid #cbd5e1' }}>
                <h4 style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Step 2: Top of Curb (TOC)</h4>
                <p>Add the physical height of the curb (usually 6 inches or 0.5 ft).</p>
                <code>TOC = {eopElev.toFixed(2)} + {curbHeight} = {(tocElev).toFixed(2)} ft</code>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(251, 191, 36, 0.05)', padding: '1rem', borderLeft: '4px solid #fbbf24' }}>
                <h4 style={{ color: '#fbbf24', marginBottom: '0.5rem' }}>Step 3: Garage Slab Elevation</h4>
                <p>Run the driveway slope from the back of the curb up to the garage.</p>
                <code>Garage = TOC + (Length × Driveway Slope)</code><br/>
                <code>Garage = {tocElev.toFixed(2)} + ({drivewayLength} × {drivewaySlope/100}) = {(garageElev).toFixed(2)} ft</code>
              </div>

              <div className="explanation-section" style={{ background: 'rgba(251, 146, 60, 0.05)', padding: '1rem', borderLeft: '4px solid #fb923c' }}>
                <h4 style={{ color: '#fb923c', marginBottom: '0.5rem' }}>Step 4: House FFE</h4>
                <p>The problem states the garage is exactly 0.55 ft below the main house floor.</p>
                <code>FFE = Garage Elev + 0.55</code><br/>
                <code>FFE = {garageElev.toFixed(2)} + 0.55 = <span style={{fontWeight: 'bold', fontSize: '1.2em'}}>{(ffe).toFixed(2)} ft</span></code>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GradingVisualizer;
