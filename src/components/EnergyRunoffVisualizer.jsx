import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const EnergyRunoffVisualizer = () => {
  const [velocity, setVelocity] = useState(10.0); // ft/s
  const [clElev, setClElev] = useState(100.00); // Z for centerline
  const [roadSlope, setRoadSlope] = useState(-2.0); // %
  const [clToCurb, setClToCurb] = useState(12.0); // ft
  const [drivewaySlope, setDrivewaySlope] = useState(2.0); // %
  const [drivewayLength, setDrivewayLength] = useState(30.0); // ft
  const [frictionCoeff, setFrictionCoeff] = useState(0.04); // unitless head loss per ft
  const [safetyFactor, setSafetyFactor] = useState(1.5); // FS
  
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const g = 32.2; // ft/s^2

  // --- MATH CALCULATIONS ---
  // Absolute Elevations
  const curbElev = clElev + (clToCurb * (roadSlope / 100));
  const garageElev = curbElev + (drivewayLength * (drivewaySlope / 100));

  // 1. Kinetic Energy (Velocity Head at Centerline)
  const velocityHead = Math.pow(velocity, 2) / (2 * g);
  
  // 2. Potential Energy (Elevation Drop from Road Centerline to Curb)
  // If road slopes down to curb, water gains energy.
  const clElevDrop = clElev - curbElev; 
  
  // Total Energy available to push water up the driveway
  const availableEnergy = velocityHead + clElevDrop;

  // Total Resistance (Gravity slope + Friction)
  const totalResistance = (drivewaySlope / 100) + frictionCoeff;
  
  let travelDistance = 0;
  let garageHit = false;

  if (availableEnergy <= 0) {
    // Water doesn't even have enough energy to reach the curb or overcome adverse road slope
    travelDistance = 0;
  } else if (totalResistance <= 0) {
    // Slopes downhill to garage, infinite travel
    travelDistance = drivewayLength;
    garageHit = true;
  } else {
    // How far up the driveway can this energy push the water?
    travelDistance = availableEnergy / totalResistance;
    if (travelDistance >= drivewayLength) {
      travelDistance = drivewayLength;
      garageHit = true;
    }
  }

  const maxWaterElev = curbElev + (travelDistance * (drivewaySlope / 100));
  const recommendedLength = (totalResistance > 0 && availableEnergy > 0) ? (availableEnergy / totalResistance) * safetyFactor : 'Infinite';
  
  // Status check
  let safetyStatus = 'SAFE ✅';
  let statusColor = '#10b981'; // Green
  
  if (garageHit) {
    safetyStatus = 'FLOODED ⚠️';
    statusColor = '#ef4444'; // Red
  } else if (drivewayLength < recommendedLength) {
    safetyStatus = 'MARGINAL (Below FS) ⚠️';
    statusColor = '#f59e0b'; // Orange
  }

  // --- SVG DRAWING LOGIC ---
  const viewBoxWidth = 800;
  const viewBoxHeight = 400;
  
  const scaleX = 15;
  // Dynamic Y Scale based on elevations
  const minElev = Math.min(clElev, curbElev) - 2;
  const maxElev = Math.max(garageElev, clElev, curbElev + velocityHead) + 3;
  const scaleY = (viewBoxHeight - 100) / (maxElev - minElev);
  const getY = (elev) => 350 - ((elev - minElev) * scaleY);

  const clX = 50;
  const curbX = clX + (clToCurb * scaleX);
  const garageX = curbX + (drivewayLength * scaleX);

  const waterEndX = curbX + (travelDistance * scaleX);
  
  // Recommended Safe Point SVG X
  const safeX = totalResistance > 0 ? curbX + (recommendedLength * scaleX) : 0;

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel" style={{ width: '100%' }}>
        <div className="visualizer-controls" style={{ minWidth: '350px' }}>
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Runoff Energy Simulator</h3>
            <p className="text-muted text-sm">Hydraulics: Energy + Friction Losses</p>
          </div>
          
          <div className="control-group mt-3">
            <div className="control-header">
              <label>Centerline Elev (Z), ft</label>
              <span className="value-display">{clElev.toFixed(2)}'</span>
            </div>
            <input type="range" min="90" max="110" step="0.5" value={clElev} onChange={(e) => setClElev(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Road Slope (%)</label>
              <span className="value-display">{roadSlope.toFixed(1)}%</span>
            </div>
            <input type="range" min="-5" max="5" step="0.5" value={roadSlope} onChange={(e) => setRoadSlope(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Runoff Velocity at Curb, V (ft/s)</label>
              <span className="value-display">{velocity.toFixed(1)}</span>
            </div>
            <input type="range" min="0" max="25" step="0.5" value={velocity} onChange={(e) => setVelocity(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Driveway Slope (%)</label>
              <span className="value-display">{drivewaySlope.toFixed(1)}%</span>
            </div>
            <input type="range" min="-5" max="15" step="0.5" value={drivewaySlope} onChange={(e) => setDrivewaySlope(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Driveway Length (ft)</label>
              <span className="value-display">{drivewayLength.toFixed(1)}</span>
            </div>
            <input type="range" min="10" max="60" step="1" value={drivewayLength} onChange={(e) => setDrivewayLength(parseFloat(e.target.value))} />
          </div>
          
          <div className="control-group mt-2">
            <div className="control-header">
              <label>Concrete Friction Factor (Cf)</label>
              <span className="value-display">{frictionCoeff.toFixed(3)}</span>
            </div>
            <input type="range" min="0.005" max="0.100" step="0.005" value={frictionCoeff} onChange={(e) => setFrictionCoeff(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Factor of Safety (FS)</label>
              <span className="value-display">{safetyFactor.toFixed(1)}x</span>
            </div>
            <input type="range" min="1.0" max="3.0" step="0.1" value={safetyFactor} onChange={(e) => setSafetyFactor(parseFloat(e.target.value))} />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setShowSolution(true)} className="solution-btn" style={{ flex: 1, background: 'var(--accent-indigo)' }}>
              View Energy Equation Math
            </button>
          </div>
        </div>

        {/* Profile Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '500px', flex: 1, position: 'relative' }}>
          
          {/* Flooding Alert overlay */}
          {garageHit && (
            <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '8px', color: '#f87171', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
              ⚠️ GARAGE FLOODING!
            </div>
          )}

          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            {/* Background Grid */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Earth Fill */}
            <path d={`M ${clX} ${getY(clElev)} L ${curbX} ${getY(curbElev)} L ${garageX} ${getY(garageElev)} L ${garageX} 400 L ${clX} 400 Z`} fill="#451a03" opacity="0.6" />

            {/* Road Surface */}
            <line x1={clX} y1={getY(clElev)} x2={curbX} y2={getY(curbElev)} stroke="#94a3b8" strokeWidth="6" />
            <circle cx={clX} cy={getY(clElev)} r="4" fill="#38bdf8" />
            <text x={clX - 10} y={getY(clElev) - 15} fill="#38bdf8" fontSize="12" fontWeight="bold">CL Elev: Z={clElev.toFixed(2)}'</text>
            <text x={curbX - 20} y={getY(curbElev) + 20} fill="#94a3b8" fontSize="12">Curb: Z={curbElev.toFixed(2)}'</text>

            {/* Driveway Surface */}
            <line x1={curbX} y1={getY(curbElev)} x2={garageX} y2={getY(garageElev)} stroke="#78716c" strokeWidth="6" />
            
            {/* Garage Structure */}
            <rect x={garageX} y={getY(garageElev) - 80} width={100} height={80} fill="#334155" stroke="#475569" strokeWidth="4" />
            <line x1={garageX} y1={getY(garageElev)} x2={garageX + 100} y2={getY(garageElev)} stroke="#fbbf24" strokeWidth="6" />
            <text x={garageX + 10} y={getY(garageElev) - 40} fill="#f8fafc" fontSize="16" fontWeight="bold">Garage: Z={garageElev.toFixed(2)}'</text>

            {/* Water Wave (The Runoff) */}
            {velocity > 0 && (
              <>
                {/* Water pooling in street */}
                <path d={`M ${clX} ${getY(curbElev) - 10} L ${curbX} ${getY(curbElev) - 10} L ${curbX} ${getY(curbElev)} L ${clX} ${getY(curbElev)} Z`} fill="rgba(56, 189, 248, 0.6)" />
                
                {/* Water climbing driveway */}
                <path d={`M ${curbX} ${getY(curbElev)} L ${waterEndX} ${getY(maxWaterElev)} L ${waterEndX} ${getY(maxWaterElev) - 8} L ${curbX} ${getY(curbElev) - 10} Z`} fill="rgba(56, 189, 248, 0.7)" />
                
                {/* Flow lines inside water */}
                <path d={`M ${curbX} ${getY(curbElev) - 5} L ${waterEndX - 10} ${getY(maxWaterElev) - 5}`} stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" />

                {/* Stop marker */}
                {!garageHit && (
                  <circle cx={waterEndX} cy={getY(maxWaterElev)} r="6" fill="#ef4444" className="animate-bounce" />
                )}
                {garageHit && (
                  <path d={`M ${garageX} ${getY(garageElev)} L ${garageX + 40} ${getY(garageElev)} L ${garageX + 40} ${getY(garageElev) - 10} L ${garageX} ${getY(garageElev) - 10} Z`} fill="rgba(56, 189, 248, 0.9)" />
                )}
              </>
            )}

            {/* Dimension Lines */}
            <line x1={curbX} y1={getY(maxWaterElev) - 40} x2={waterEndX} y2={getY(maxWaterElev) - 40} stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrowBlue)" markerStart="url(#arrowBlue)" />
            <text x={(curbX + waterEndX) / 2 - 20} y={getY(maxWaterElev) - 50} fill="#38bdf8" fontSize="12" fontWeight="bold">Travel: {travelDistance.toFixed(1)}'</text>

            {/* Safe Distance Marker */}
            {totalResistance > 0 && (
              <>
                <line x1={safeX} y1={getY(curbElev) - 60} x2={safeX} y2={400} stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5" />
                <rect x={safeX - 40} y={getY(curbElev) - 80} width="80" height="20" fill="#f59e0b" rx="4" />
                <text x={safeX} y={getY(curbElev) - 66} fill="#1e293b" fontSize="10" fontWeight="bold" textAnchor="middle">SAFE ZONE</text>
              </>
            )}

            {/* Total Driveway Dimension */}
            <line x1={curbX} y1={380} x2={garageX} y2={380} stroke="#a8a29e" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={(curbX + garageX) / 2 - 20} y={395} fill="#a8a29e" fontSize="11">Total L = {drivewayLength}'</text>

            {/* Markers */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a8a29e" />
              </marker>
              <marker id="arrowBlue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
              </marker>
            </defs>
          </svg>
        </div>
      </div>

      {/* Simplified Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid #f43f5e' }}>
          <span className="stat-label">Total Available Energy</span>
          <span className="stat-value text-gradient">{availableEnergy.toFixed(2)}<span className="text-sm ml-1 text-muted">ft of head</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid #38bdf8' }}>
          <span className="stat-label">Required FS Safe Length</span>
          <span className="stat-value" style={{ color: '#38bdf8'}}>{(totalResistance > 0 && availableEnergy > 0) ? recommendedLength.toFixed(1) : '∞'}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: `3px solid ${statusColor}` }}>
          <span className="stat-label">Garage Status</span>
          <span className="stat-value" style={{ color: statusColor, fontSize: '1.2rem'}}>
            {safetyStatus}
          </span>
        </div>
      </div>

      {/* Math Breakdown Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>📐 Bernoulli Energy Math</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section mb-4" style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '1rem', borderLeft: '4px solid #f43f5e' }}>
                <h4 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Step 1: Calculate Kinetic Energy</h4>
                <p>The water starts at the Centerline with an initial velocity. We convert this into "Velocity Head".</p>
                <code>Velocity Head = V² / 2g</code><br/>
                <code>Head = {velocity.toFixed(1)}² / (2 × 32.2) = <span style={{fontWeight: 'bold'}}>{velocityHead.toFixed(2)} ft</span></code>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(52, 211, 153, 0.05)', padding: '1rem', borderLeft: '4px solid #34d399' }}>
                <h4 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Step 2: Add Road Potential Energy</h4>
                <p>Because the road slopes from the Centerline down to the Curb, the water gains "Potential Energy" (it accelerates downhill before hitting the driveway).</p>
                <code>Elevation Drop = CL Elev - Curb Elev</code><br/>
                <code>Drop = {clElev.toFixed(2)} - {curbElev.toFixed(2)} = <span style={{fontWeight: 'bold'}}>{clElevDrop.toFixed(2)} ft</span></code><br/><br/>
                <code>Total Available Energy = Velocity Head + Elev Drop</code><br/>
                <code>Total Energy = {velocityHead.toFixed(2)} + {clElevDrop.toFixed(2)} = <span style={{fontWeight: 'bold'}}>{availableEnergy.toFixed(2)} ft</span></code>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '1rem', borderLeft: '4px solid #38bdf8' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '0.5rem' }}>Step 3: Calculate Driveway Resistance</h4>
                <p>As the water climbs the driveway, it loses energy to gravity (upward slope) and concrete friction.</p>
                <code>Total Resistance = Driveway Slope + Friction Factor</code><br/>
                <code>Resistance = {(drivewaySlope/100).toFixed(3)} + {frictionCoeff.toFixed(3)} = <span style={{fontWeight: 'bold'}}>{totalResistance.toFixed(3)}</span></code>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(168, 85, 247, 0.05)', padding: '1rem', borderLeft: '4px solid #a855f7' }}>
                <h4 style={{ color: '#a855f7', marginBottom: '0.5rem' }}>Step 4: Convert Energy to Distance</h4>
                <p>The water pushes up the driveway until it runs out of Total Available Energy.</p>
                <code>Distance = Total Energy / Total Resistance</code><br/>
                <code>Distance = {availableEnergy.toFixed(2)} / {totalResistance.toFixed(3)} = <span style={{fontWeight: 'bold'}}>{travelDistance.toFixed(1)} ft</span></code>
              </div>

              <div className="explanation-section" style={{ background: garageHit ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderLeft: `4px solid ${garageHit ? '#ef4444' : '#10b981'}` }}>
                <h4 style={{ color: garageHit ? '#ef4444' : '#10b981', marginBottom: '0.5rem' }}>Conclusion</h4>
                <p>The water travels {travelDistance.toFixed(1)} feet up the driveway.</p>
                <p>Since the driveway is {drivewayLength} feet long, the water <strong>{garageHit ? 'WILL enter and flood the garage!' : 'will STOP before hitting the garage and roll back down.'}</strong></p>
                <p className="mt-2" style={{ fontSize: '0.9rem', opacity: 0.8 }}>Note: A Factor of Safety of {safetyFactor}x requires the driveway to be at least {(recommendedLength === 'Infinite' ? '∞' : recommendedLength.toFixed(1))} ft long.</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnergyRunoffVisualizer;
