import React, { useState } from 'react';

const HydraulicRamVisualizer = ({ problem, initialKn = 1000 }) => {
  const [requiredKn, setRequiredKn] = useState(initialKn);
  const [showSolution, setShowSolution] = useState(false);

  // Math Conversion
  const knToLbs = 224.808943;
  const lbsInTon = 2000;
  
  const totalLbs = requiredKn * knToLbs;
  const totalTons = totalLbs / lbsInTon;

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', borderLeft: '4px solid var(--accent-indigo)' }}>
        <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>{problem.title}</h3>
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{problem.description}</p>
        
        {/* Interactive Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <div>
            <label style={{ color: 'var(--accent-cyan)' }}>Required Capacity (kN): {requiredKn}</label>
            <input type="range" min="100" max="5000" step="100" value={requiredKn} onChange={(e) => setRequiredKn(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        {/* SVG Visualizer */}
        <div className="mt-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
          <svg viewBox="0 0 800 400" width="100%" height="400">
            {/* Grid */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
            <rect width="800" height="400" fill="url(#grid)" />

            {/* Bridge Deck */}
            <rect x="100" y="100" width="600" height="40" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            <text x="400" y="125" fill="white" textAnchor="middle" fontWeight="bold">BRIDGE DECK ({requiredKn} kN Load)</text>

            {/* Ground */}
            <rect x="0" y="350" width="800" height="50" fill="#1e293b" />
            <line x1="0" y1="350" x2="800" y2="350" stroke="#334155" strokeWidth="4" />

            {/* Hydraulic Ram */}
            <g transform="translate(350, 200)">
              {/* Cylinder */}
              <rect x="20" y="0" width="60" height="150" fill="#0284c7" rx="5" />
              <rect x="10" y="140" width="80" height="10" fill="#0369a1" />
              
              {/* Piston (Extends based on force visualization) */}
              <rect x="35" y="-100" width="30" height="100" fill="#cbd5e1" />
              <rect x="25" y="-100" width="50" height="10" fill="#94a3b8" />

              {/* Force Arrow */}
              <path d="M 50 120 L 50 50" stroke="#f43f5e" strokeWidth="4" markerEnd="url(#arrowhead)" />
              <text x="100" y="80" fill="#f43f5e" fontWeight="bold" fontSize="18">{totalTons.toFixed(1)} TONS</text>
            </g>

            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#f43f5e" />
              </marker>
            </defs>
          </svg>
        </div>

        <button 
          className="solution-btn mt-4" 
          style={{ width: '100%', background: showSolution ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)' }}
          onClick={() => setShowSolution(!showSolution)}
        >
          {showSolution ? 'Hide Math Breakdown' : 'View Math Breakdown'}
        </button>
      </div>

      {showSolution && (
        <div className="animate-float glass-panel" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <h4 style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }}>Step-by-Step Calculation</h4>
          <p>1. Convert kiloNewtons (kN) to Pounds (lbs):</p>
          <code>{requiredKn} kN × 224.81 lbs/kN = <strong>{totalLbs.toFixed(1)} lbs</strong></code><br/><br/>
          
          <p>2. Convert Pounds (lbs) to US Tons (2000 lbs/ton):</p>
          <code>{totalLbs.toFixed(1)} lbs ÷ 2000 lbs/ton = <strong>{totalTons.toFixed(2)} Tons</strong></code><br/><br/>
          
          <p>3. Conclusion:</p>
          <p>The contractor must order a ram with a minimum capacity of <strong>{Math.ceil(totalTons)} Tons</strong>.</p>
        </div>
      )}
    </div>
  );
};

export default HydraulicRamVisualizer;
