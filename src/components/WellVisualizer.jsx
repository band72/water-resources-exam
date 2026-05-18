import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const WellVisualizer = ({ initialQ = 500, initialT = 1000, initialR = 50 }) => {
  const [q, setQ] = useState(initialQ); // Pumping rate (gpm or ft3/day)
  const [t, setT] = useState(initialT); // Transmissivity (ft2/day)
  const [r, setR] = useState(initialR); // Observation distance (ft)
  
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Constants
  const radiusOfInfluence = 1000; // ft (assumed steady state R)
  
  // Math: Thiem Equation for Steady State Confined Aquifer
  // s = (Q / (2 * PI * T)) * ln(R/r)
  // Converting Q to match T units (assuming Q is ft3/day for simplicity in this simulator)
  let drawdown = 0;
  if (r > 0 && r < radiusOfInfluence) {
    drawdown = (q / (2 * Math.PI * t)) * Math.log(radiusOfInfluence / r);
  }

  // SVG Drawing constants
  const viewBoxWidth = 600;
  const viewBoxHeight = 400;
  
  const drawConeOfDepression = () => {
    let path = `M 0,200 `;
    
    // Calculate the curve
    for (let x = 0; x <= viewBoxWidth; x += 5) {
      // Map screen X to actual distance from well (well is at center x=300)
      const distFromWell = Math.abs(x - 300) * 3; // Scale 1 screen unit = 3 ft
      
      let s = 0;
      if (distFromWell > 5 && distFromWell < radiusOfInfluence) {
         s = (q / (2 * Math.PI * t)) * Math.log(radiusOfInfluence / distFromWell);
      }
      
      // Screen Y (base water level is 200)
      // Visual exaggeration factor for the SVG
      const screenY = 200 + (s * 15);
      path += `L ${x},${Math.min(screenY, 320)} `; // Cap at aquifer top
    }
    
    // Close the path to fill water
    path += `L ${viewBoxWidth},200 L ${viewBoxWidth},400 L 0,400 Z`;
    return path;
  };

  const observationX = 300 + (r / 3);

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">
        <div className="visualizer-controls">
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Groundwater Well Simulator</h3>
            <p className="text-muted text-sm">Environmental: Aquifer Drawdown</p>
          </div>
          
          <div className="control-group mt-4">
            <div className="control-header">
              <label>Pumping Rate, Q (ft³/day)</label>
              <span className="value-display">{q.toFixed(0)}</span>
            </div>
            <input type="range" min="100" max="5000" step="100" value={q} onChange={(e) => setQ(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Aquifer Transmissivity, T (ft²/day)</label>
              <span className="value-display">{t.toFixed(0)}</span>
            </div>
            <input type="range" min="200" max="5000" step="100" value={t} onChange={(e) => setT(parseFloat(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Observation Well Distance, r (ft)</label>
              <span className="value-display">{r.toFixed(0)}</span>
            </div>
            <input type="range" min="10" max="500" step="10" value={r} onChange={(e) => setR(parseFloat(e.target.value))} />
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
              <p className="text-sm m-0">Use the Thiem Equation for a steady-state confined aquifer: <strong>s = [Q / (2πT)] × ln(R/r)</strong></p>
            </div>
          )}
        </div>

        {/* Simplified SVG Graphic */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '350px', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="water-svg">
            
            {/* Layers */}
            {/* Ground / Upper Confining Layer (Clay) */}
            <rect x="0" y="0" width={viewBoxWidth} height="200" fill="#78716c" opacity="0.8" />
            <text x="10" y="30" fill="#d6d3d1" fontSize="14" fontWeight="bold">Upper Confining Layer (Impermeable Clay)</text>
            
            {/* Aquifer Layer (Sand/Gravel) */}
            <rect x="0" y="200" width={viewBoxWidth} height="120" fill="#b45309" opacity="0.6" />
            <text x="10" y="230" fill="#fcd34d" fontSize="14" fontWeight="bold">Confined Aquifer (Sand/Gravel)</text>

            {/* Lower Bedrock */}
            <rect x="0" y="320" width={viewBoxWidth} height="80" fill="#292524" opacity="0.9" />
            <text x="10" y="350" fill="#a8a29e" fontSize="14" fontWeight="bold">Lower Bedrock</text>

            {/* Water / Cone of Depression */}
            <path d={drawConeOfDepression()} fill="var(--accent-blue)" opacity="0.5" />
            
            {/* Static Piezometric Surface (Dashed Line) */}
            <line x1="0" y1="200" x2={viewBoxWidth} y2="200" stroke="var(--accent-cyan)" strokeWidth="2" strokeDasharray="10,5" />
            <text x="400" y="190" fill="var(--accent-cyan)" fontSize="12">Original Water Pressure Level</text>

            {/* Main Pumping Well */}
            <rect x="290" y="0" width="20" height="300" fill="#94a3b8" />
            <path d="M 290 300 L 310 300" stroke="#38bdf8" strokeWidth="6" />
            <text x="315" y="100" fill="#f8fafc" fontSize="16" fontWeight="bold">Pumping Well</text>
            
            {/* Arrow indicating pumping up */}
            <path d="M 300 150 L 300 50 M 290 70 L 300 50 L 310 70" stroke="var(--accent-green)" strokeWidth="4" fill="none" className="animate-bounce" />

            {/* Observation Well */}
            <rect x={observationX - 5} y="0" width="10" height="300" fill="#cbd5e1" opacity="0.7" />
            <text x={observationX + 10} y="150" fill="#f8fafc" fontSize="12">Obs. Well</text>
            
            {/* Drawdown Measurement Line */}
            {drawdown > 0 && (
              <>
                <line x1={observationX} y1="200" x2={observationX} y2={200 + Math.min(drawdown * 15, 120)} stroke="var(--accent-purple)" strokeWidth="3" />
                <text x={observationX + 10} y={200 + (drawdown * 15) / 2} fill="var(--accent-purple)" fontSize="14" fontWeight="bold">s = {drawdown.toFixed(2)} ft</text>
              </>
            )}

          </svg>
        </div>
      </div>

      {/* Simplified Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-green)' }}>
          <span className="stat-label">Pumping Rate (Q)</span>
          <span className="stat-value text-gradient">{q}<span className="text-sm ml-1 text-muted">ft³/day</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-blue)' }}>
          <span className="stat-label">Transmissivity (T)</span>
          <span className="stat-value" style={{ color: 'var(--accent-blue)'}}>{t}<span className="text-sm ml-1 text-muted">ft²/day</span></span>
        </div>
        <div className="glass-panel stat-card" style={{ borderTop: '3px solid var(--accent-purple)' }}>
          <span className="stat-label">Drawdown (s) at {r}ft</span>
          <span className="stat-value" style={{ color: 'var(--accent-purple)'}}>{drawdown.toFixed(2)}<span className="text-sm ml-1 text-muted">ft</span></span>
        </div>
      </div>

      {/* Simplified Explanation Modal */}
      {showSolution && createPortal(
        <div className="modal-overlay" onClick={() => setShowSolution(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-gradient" style={{ fontSize: '1.5rem' }}>👦 5th Grader Breakdown: Aquifer Drawdown</h3>
              <button className="close-btn" onClick={() => setShowSolution(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="explanation-section mb-4">
                <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>What is an Aquifer?</h4>
                <p>Imagine a giant underground sponge filled with water, trapped between two hard rocks. When we stick a straw (a well) into the sponge and suck water out really fast, the water around the straw dips down like a funnel.</p>
                <p>This funnel shape is called the <strong>Cone of Depression</strong>, and the distance the water drops is called the <strong>Drawdown (s)</strong>.</p>
              </div>

              <div className="explanation-section mb-4" style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Transmissivity (T)</h4>
                <p><strong>Transmissivity</strong> is just a fancy word for "how easily water slides through the sponge."</p>
                <ul>
                  <li>If <strong>T is HUGE</strong> (like gravel), water slides in instantly to replace what you pumped out. The water level barely drops (small drawdown).</li>
                  <li>If <strong>T is TINY</strong> (like tight sand), the water struggles to move. You suck it out faster than it can slide in, so the water level plummets (massive drawdown funnel).</li>
                </ul>
              </div>

              <div className="explanation-section">
                <h4 style={{ color: 'var(--accent-green)', marginBottom: '0.5rem' }}>The Math (Thiem Equation)</h4>
                <p>Engineers use a formula that balances how fast you pump (Q) against how easily the water moves (T):</p>
                
                <code className="math-block text-center mt-2" style={{ display: 'block' }}>Drawdown (s) = [ Q ÷ (2 × π × T) ] × ln(R ÷ r)</code>
                
                <p className="mt-3">Look at the math: Since Transmissivity (T) is on the <em>bottom</em> of the fraction, making T bigger makes the Drawdown smaller! Try moving the T slider to the right and watch the purple drawdown line shrink!</p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default WellVisualizer;
