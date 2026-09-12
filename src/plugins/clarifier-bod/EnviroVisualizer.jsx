import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const EnviroVisualizer = ({ initialFlow = 2.5, initialBODIn = 220, initialBODOut = 140 }) => {
  const [flow, setFlow] = useState(initialFlow);
  const [bodIn, setBodIn] = useState(initialBODIn);
  const [bodOut, setBodOut] = useState(initialBODOut);
  
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Environmental Math Calculations
  // Mass (lb/day) = Flow (MGD) * Concentration (mg/L) * 8.34
  const massIn = flow * bodIn * 8.34;
  const massOut = flow * bodOut * 8.34;
  const massRemoved = massIn - massOut;
  const efficiency = ((bodIn - bodOut) / bodIn) * 100;

  // SVG Drawing constants
  const viewBoxWidth = 500;
  const viewBoxHeight = 300;

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">
        <div className="visualizer-controls">
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Primary Clarifier Simulation</h3>
            <p className="text-muted text-sm">Environmental: Water & Wastewater Treatment</p>
          </div>
          
          <div className="control-group mt-4">
            <div className="control-header">
              <label>Influent Flow (MGD)</label>
              <span className="value-display">{flow.toFixed(1)} MGD</span>
            </div>
            <input type="range" min="0.5" max="10" step="0.1" value={flow} onChange={(e) => setFlow(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Influent BOD₅ (mg/L) - "Dirty In"</label>
              <span className="value-display">{bodIn.toFixed(0)}</span>
            </div>
            <input type="range" min="50" max="500" step="10" value={bodIn} onChange={(e) => {
              const val = parseFloat(e.target.value);
              setBodIn(val);
              if (bodOut > val) setBodOut(val);
            }} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Effluent BOD₅ (mg/L) - "Clean Out"</label>
              <span className="value-display">{bodOut.toFixed(0)}</span>
            </div>
            <input type="range" min="10" max={bodIn} step="5" value={bodOut} onChange={(e) => setBodOut(parseFloat(e.target.value))} />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setShowHint(!showHint)} className="solution-btn" style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>
              💡 Hint
            </button>
            <button onClick={() => setShowSolution(true)} className="solution-btn" style={{ flex: 2 }}>
              View 5th Grader Breakdown
            </button>
          </div>

          {showHint && (
            <div className="glass-panel mt-2" style={{ borderLeft: '4px solid var(--accent-cyan)', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.05)' }}>
              <p className="text-sm m-0">Use the famous Mass Flux formula: <strong>Mass (lb/day) = Flow (MGD) × Concentration (mg/L) × 8.34</strong>.</p>
            </div>
          )}
        </div>

        {/* Simplified SVG Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            {/* Background Grid */}
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* INFLUENT PIPE (Left) */}
            <rect x="0" y="80" width="100" height="40" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <path d="M 0 100 L 80 100" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="15" strokeDasharray="10,5" className="animate-pulse" />
            <text x="10" y="70" fill="var(--accent-purple)" fontSize="14" fontWeight="bold">Influent: {bodIn} mg/L</text>

            {/* EFFLUENT PIPE (Right) */}
            <rect x="400" y="100" width="100" height="30" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <path d="M 400 115 L 500 115" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="10" strokeDasharray="10,5" className="animate-pulse" />
            <text x="390" y="90" fill="var(--accent-cyan)" fontSize="14" fontWeight="bold">Effluent: {bodOut} mg/L</text>

            {/* SLUDGE PIPE (Bottom) */}
            <rect x="230" y="250" width="40" height="50" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <text x="260" y="290" fill="var(--accent-green)" fontSize="14" fontWeight="bold">Sludge</text>

            {/* CLARIFIER TANK */}
            <path d="M 100 60 L 400 60 L 400 200 L 270 250 L 230 250 L 100 200 Z" fill="rgba(30, 41, 59, 0.8)" stroke="#94a3b8" strokeWidth="4" />
            
            {/* WATER INSIDE TANK */}
            <path d="M 102 120 L 398 120 L 398 198 L 268 248 L 232 248 L 102 198 Z" fill="rgba(56, 189, 248, 0.3)" />

            {/* PARTICLE SIMULATION BASED ON BOD */}
            {/* Draw 'dots' to represent dirty water settling */}
            {[...Array(Math.floor(bodIn / 10))].map((_, i) => {
              const x = 110 + (i * 13) % 280;
              const y = 130 + (i * 7) % 100;
              return <circle key={`in-${i}`} cx={x} cy={y} r="3" fill="var(--accent-purple)" opacity="0.6" />;
            })}
            
            {/* Clean water at the top right */}
            <text x="310" y="140" fill="var(--accent-cyan)" fontSize="12" opacity="0.8">Clear Water</text>
            <text x="140" y="210" fill="var(--accent-green)" fontSize="12" opacity="0.8">Settled Solids</text>

          </svg>
        </div>
      </div>

      {/* Simplified Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-purple)' }}>
          <span className="stat-label">Mass Entering (Gross)</span>
          <span className="stat-value text-gradient">{massIn.toLocaleString(undefined, {maximumFractionDigits:0})}<span className="text-sm ml-1 text-muted">lbs/day</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-green)' }}>
          <span className="stat-label">Mass Removed (Caught)</span>
          <span className="stat-value" style={{ color: 'var(--accent-green)'}}>{massRemoved.toLocaleString(undefined, {maximumFractionDigits:0})}<span className="text-sm ml-1 text-muted">lbs/day</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-cyan)' }}>
          <span className="stat-label">Removal Efficiency</span>
          <span className="stat-value" style={{ color: 'var(--accent-cyan)'}}>{efficiency.toFixed(1)}<span className="text-sm ml-1 text-muted">%</span></span>
        </div>
      </div>

      {/* Simplified Explanation Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>👦 5th Grader Breakdown: BOD Removal</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section mb-4">
                <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>What is BOD5?</h4>
                <p>Imagine your city's wastewater as a giant river filled with tiny invisible food particles (BOD). If those particles get into a real lake, bacteria will eat them and use up all the oxygen, suffocating the fish!</p>
                <p><strong>BOD</strong> stands for <em>Biochemical Oxygen Demand</em>. It's basically a measure of "how much trash is in the water."</p>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderLeft: '4px solid var(--accent-green)' }}>
                <h4 style={{ color: 'var(--accent-green)', marginBottom: '0.5rem' }}>The Magic Number: 8.34</h4>
                <p>In environmental engineering, we constantly have to convert "milligrams per liter" (concentration) and "million gallons per day" (flow rate) into actual physical pounds of trash.</p>
                <p>To do this easily, we multiply by <strong>8.34</strong> (which is the weight of one gallon of water in pounds). So:</p>
                <code className="math-block text-center mt-2" style={{ display: 'block' }}>Pounds = Flow (MGD) × Concentration (mg/L) × 8.34</code>
              </div>

              <div className="explanation-section">
                <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>The Solution</h4>
                <p>1. Find out how much trash <strong>entered</strong> the tank:<br/>
                <code>{flow.toFixed(1)} MGD × {bodIn.toFixed(0)} mg/L × 8.34 = {massIn.toLocaleString(undefined, {maximumFractionDigits:0})} lbs/day</code>
                </p>
                
                <p>2. Find out how much trash <strong>escaped</strong> the tank:<br/>
                <code>{flow.toFixed(1)} MGD × {bodOut.toFixed(0)} mg/L × 8.34 = {massOut.toLocaleString(undefined, {maximumFractionDigits:0})} lbs/day</code>
                </p>

                <p>3. Subtract to see how much we <strong>caught (removed)</strong>:<br/>
                <code>{massIn.toLocaleString(undefined, {maximumFractionDigits:0})} - {massOut.toLocaleString(undefined, {maximumFractionDigits:0})} = <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>{massRemoved.toLocaleString(undefined, {maximumFractionDigits:0})} lbs/day</span></code>
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

export default EnviroVisualizer;
