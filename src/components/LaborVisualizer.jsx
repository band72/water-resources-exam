import React, { useState } from 'react';

const LaborVisualizer = ({ problem, initialBudget = 4000, initialHourly = 50, initialWorkers = 2 }) => {
  const [budget, setBudget] = useState(initialBudget);
  const [hourlyRate, setHourlyRate] = useState(initialHourly);
  const [workers, setWorkers] = useState(initialWorkers);
  const [showSolution, setShowSolution] = useState(false);

  const hoursPerDay = 8;
  const dailyCostPerWorker = hourlyRate * hoursPerDay;
  const totalDailyCost = dailyCostPerWorker * workers;
  const daysAvailable = budget / totalDailyCost;

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', borderLeft: '4px solid var(--accent-indigo)' }}>
        <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>{problem.title}</h3>
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{problem.description}</p>
        
        {/* Interactive Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <div>
            <label style={{ color: 'var(--accent-cyan)' }}>Total Budget ($): {budget}</label>
            <input type="range" min="1000" max="10000" step="500" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label style={{ color: 'var(--accent-blue)' }}>Hourly Rate ($/hr): {hourlyRate}</label>
            <input type="range" min="10" max="100" step="5" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label style={{ color: 'var(--accent-green)' }}>Number of Workers: {workers}</label>
            <input type="range" min="1" max="10" step="1" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        {/* Visualizer output */}
        <div className="mt-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', padding: '2rem', borderRadius: '8px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-purple)' }}>{daysAvailable.toFixed(1)} Days</div>
            <p style={{ color: 'var(--text-muted)' }}>Available to complete task</p>
          </div>
        </div>

        {/* Visual Workers */}
        <div className="mt-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: workers }).map((_, i) => (
            <div key={i} style={{ padding: '1rem', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--accent-green)' }}>
              👷
            </div>
          ))}
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
          <p>1. Calculate daily cost per worker: <code>{hourlyRate} $/hr × {hoursPerDay} hrs/day = ${dailyCostPerWorker}/day</code></p>
          <p>2. Calculate total daily crew cost: <code>${dailyCostPerWorker}/day × {workers} workers = ${totalDailyCost}/day</code></p>
          <p>3. Calculate days available: <code>${budget} budget ÷ ${totalDailyCost}/day = <strong>{daysAvailable.toFixed(1)} days</strong></code></p>
        </div>
      )}
    </div>
  );
};

export default LaborVisualizer;
