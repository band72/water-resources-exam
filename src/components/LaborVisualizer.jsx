import React, { useState, useEffect } from 'react';

const LaborVisualizer = ({ problem, initialBudget = 4000, initialHourly = 50, initialWorkers = 2 }) => {
  const [budget, setBudget] = useState(initialBudget);
  const [hourlyRate, setHourlyRate] = useState(initialHourly);
  const [workers, setWorkers] = useState(initialWorkers);
  const [showSolution, setShowSolution] = useState(false);
  
  // Animation states
  const [currentDay, setCurrentDay] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const hoursPerDay = 8;
  const dailyCostPerWorker = hourlyRate * hoursPerDay;
  const totalDailyCost = dailyCostPerWorker * workers;
  const daysAvailable = budget / totalDailyCost;

  // Animation effect
  useEffect(() => {
    let intervalId;
    if (isSimulating) {
      intervalId = setInterval(() => {
        setCurrentDay(prev => {
          const next = prev + 0.1;
          if (next >= daysAvailable) {
            setIsSimulating(false);
            return daysAvailable;
          }
          return next;
        });
      }, 50);
    }
    return () => clearInterval(intervalId);
  }, [isSimulating, daysAvailable]);

  // Handle parameters change
  useEffect(() => {
    setCurrentDay(0);
    setIsSimulating(false);
  }, [budget, hourlyRate, workers]);

  const progressPercent = daysAvailable > 0 ? (currentDay / daysAvailable) * 100 : 0;

  const handleStartSim = () => {
    if (currentDay >= daysAvailable) {
      setCurrentDay(0);
    }
    setIsSimulating(true);
  };

  return (
    <div className="visualizer-wrapper" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', width: '100%' }}>
      
      {/* LEFT: Controls Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '4px solid var(--accent-indigo)' }}>
        <div>
          <span className="text-muted text-sm" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>PE Exam: Project Scheduling</span>
          <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>Excavation Labor Simulator</h3>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-muted)' }}>
            Adjust the project budget, hourly labor rates, and crew size to calculate the number of workdays available to complete the excavation.
          </p>
        </div>

        {/* Interactive Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          <div>
            <div className="control-header">
              <label style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>Labor Budget: ${budget.toLocaleString()}</label>
            </div>
            <input 
              type="range" 
              min="1000" 
              max="10000" 
              step="500" 
              value={budget} 
              onChange={(e) => setBudget(Number(e.target.value))} 
              className="w-full" 
            />
          </div>

          <div>
            <div className="control-header">
              <label style={{ color: 'var(--accent-blue)', fontSize: '0.9rem' }}>Hourly Rate: ${hourlyRate}/hr</label>
            </div>
            <input 
              type="range" 
              min="20" 
              max="100" 
              step="5" 
              value={hourlyRate} 
              onChange={(e) => setHourlyRate(Number(e.target.value))} 
              className="w-full" 
            />
          </div>

          <div>
            <div className="control-header">
              <label style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>Crew Size: {workers} Workers</label>
            </div>
            <input 
              type="range" 
              min="1" 
              max="8" 
              step="1" 
              value={workers} 
              onChange={(e) => setWorkers(Number(e.target.value))} 
              className="w-full" 
            />
          </div>
        </div>

        {/* Animation Controls */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="solution-btn" 
            style={{ 
              flex: 2, 
              background: isSimulating ? 'var(--accent-cyan)' : 'var(--gradient-primary)',
              color: isSimulating ? '#000' : '#fff'
            }}
            onClick={handleStartSim}
          >
            {isSimulating ? '🚧 Excavating...' : currentDay >= daysAvailable ? '🔄 Restart Excavation' : '🚜 Run Simulation'}
          </button>
          
          <button 
            className="solution-btn" 
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}
            onClick={() => setIsSimulating(false)}
            disabled={!isSimulating}
          >
            ⏸️ Pause
          </button>
        </div>

        {/* Live Status Screen */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1rem', 
            background: 'rgba(5, 5, 10, 0.6)', 
            border: isSimulating ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
            borderRadius: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-muted text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>CREW DAILY COST</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent-green)' }}>${totalDailyCost}/day</strong>
            </div>
            <div>
              <span className="text-muted text-xs" style={{ display: 'block', fontSize: '0.75rem' }}>TIME ALLOTTED</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--accent-purple)' }}>{daysAvailable.toFixed(1)} Days</strong>
            </div>
          </div>
          {isSimulating && (
            <div className="mt-2 text-sm" style={{ color: 'var(--accent-cyan)' }}>
              Working Day: {currentDay.toFixed(1)} of {daysAvailable.toFixed(1)}
            </div>
          )}
        </div>

        <button 
          className="solution-btn" 
          style={{ width: '100%', background: showSolution ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)' }}
          onClick={() => setShowSolution(!showSolution)}
        >
          {showSolution ? 'Hide Math Breakdown' : 'View Math Breakdown'}
        </button>
      </div>

      {/* RIGHT: SVG Animation Panel */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          background: '#090d16', 
          padding: '1rem',
          minHeight: '380px',
          overflow: 'hidden'
        }}
      >
        <svg 
          viewBox="0 0 600 350" 
          width="100%" 
          height="100%"
          style={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}
        >
          {/* Sky Gradient and Ground Grid */}
          <defs>
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <pattern id="laborGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
            </pattern>
          </defs>
          
          <rect width="600" height="350" fill="url(#skyGrad)" />
          <rect width="600" height="350" fill="url(#laborGrid)" />

          {/* Background Text */}
          <text x="580" y="30" fill="rgba(255,255,255,0.05)" fontSize="16" textAnchor="end" fontWeight="bold">EXCAVATION PROGRESS TIMELINE</text>

          {/* Baseline Ground Level */}
          <rect x="0" y="240" width="600" height="110" fill="#292524" />
          <line x1="0" y1="240" x2="600" y2="240" stroke="#44403c" strokeWidth="4" />

          {/* Excavated Hole (grows with progress) */}
          <path 
            d={`M 150 240 
                L 180 ${240 + 50 * (progressPercent / 100)} 
                L 420 ${240 + 50 * (progressPercent / 100)} 
                L 450 240 Z`} 
            fill="#1c1917" 
            stroke="#b45309" 
            strokeWidth="2" 
          />

          {/* Dirt Pile (shrinks as progress increases) */}
          {progressPercent < 100 && (
            <path 
              d={`M 460 240 
                  Q 520 ${240 - 70 * (1 - progressPercent / 100)} 
                  580 240 Z`} 
              fill="#78350f" 
              opacity="0.85" 
            />
          )}
          {progressPercent < 100 && (
            <text x="520" y={230 - 30 * (1 - progressPercent / 100)} fill="#d97706" fontSize="10" textAnchor="middle" fontWeight="bold">
              DIRT PILE
            </text>
          )}

          {/* Foundation Concrete Slab appearing when 100% complete */}
          {progressPercent >= 95 && (
            <g opacity={(progressPercent - 95) / 5}>
              <rect x="195" y="260" width="210" height="30" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="2" />
              <line x1="220" y1="260" x2="220" y2="290" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <line x1="270" y1="260" x2="270" y2="290" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <line x1="320" y1="260" x2="320" y2="290" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <line x1="370" y1="260" x2="370" y2="290" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
              <text x="300" y="280" fill="#0f172a" fontSize="11" textAnchor="middle" fontWeight="bold">FOUNDATION LAB READY</text>
            </g>
          )}

          {/* Animated Workers (👷) based on crew count */}
          {Array.from({ length: workers }).map((_, i) => {
            // Distribute workers along the excavation line
            const workerX = 180 + i * ((420 - 180) / Math.max(1, workers - 1));
            // Standing depth changes as hole goes down
            const workerY = 240 + 50 * (progressPercent / 100) - 2;

            return (
              <g 
                key={i} 
                transform={`translate(${workerX}, ${workerY})`}
                className={isSimulating ? 'animate-dig-sway' : ''}
              >
                {/* Worker body silhouette */}
                <ellipse cx="0" cy="-10" rx="10" ry="12" fill="#d97706" />
                {/* Yellow Hardhat */}
                <path d="M -12 -23 C -12 -33, 12 -33, 12 -23 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
                <rect x="-14" y="-23" width="28" height="3" fill="#fbbf24" rx="1" />
                {/* Face dot */}
                <circle cx="0" cy="-15" r="7" fill="#fed7aa" />
                <circle cx="3" cy="-16" r="1.2" fill="#000" />
                {/* Shovel tool in hand, animating if simulating */}
                <g transform={isSimulating ? `rotate(${Math.sin(currentDay * 10 + i) * 20})` : 'rotate(0)'} transform-origin="0 -5">
                  <line x1="0" y1="-5" x2="15" y2="8" stroke="#78716c" strokeWidth="3" />
                  <path d="M 12 5 L 18 10 L 22 6 L 16 1 Z" fill="#94a3b8" />
                </g>
                <text x="0" y="8" fill="#fbbf24" fontSize="10" fontWeight="bold" textAnchor="middle">Crew #{i+1}</text>
              </g>
            );
          })}

          {/* Timeline / Progress bar overlay */}
          <g transform="translate(100, 60)">
            <text x="0" y="-12" fill="var(--text-muted)" fontSize="11" fontWeight="bold">PROJECT SCHEDULE TIMELINE</text>
            <text x="400" y="-12" fill="var(--accent-cyan)" fontSize="11" fontWeight="bold" textAnchor="end">
              Day {currentDay.toFixed(1)} / {daysAvailable.toFixed(1)}
            </text>
            
            {/* Timeline track */}
            <rect x="0" y="0" width="400" height="12" fill="rgba(255,255,255,0.05)" rx="6" />
            <rect x="0" y="0" width={400 * (progressPercent / 100)} height="12" fill="var(--gradient-primary)" rx="6" />

            {/* Checkpoints */}
            <circle cx="0" cy="6" r="3" fill="white" />
            <text x="0" y="26" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Start</text>

            <circle cx="200" cy="6" r="3" fill="white" />
            <text x="200" y="26" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Halfway</text>

            <circle cx="400" cy="6" r={progressPercent >= 100 ? 5 : 3} fill={progressPercent >= 100 ? "var(--accent-green)" : "white"} />
            <text x="400" y="26" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Complete</text>
          </g>

          {/* Complete Status Light */}
          {progressPercent >= 100 && (
            <g transform="translate(300, 160)" className="animate-float-subtle">
              <rect x="-80" y="-15" width="160" height="30" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1.5" rx="6" />
              <text x="0" y="4" fill="#10b981" fontSize="12" fontWeight="bold" textAnchor="middle">EXCAVATION COMPLETED</text>
            </g>
          )}
        </svg>
      </div>

      {/* BOTTOM Breakdown Card */}
      {showSolution && (
        <div className="animate-float-subtle glass-panel" style={{ gridColumn: '1 / -1', borderLeft: '4px solid var(--accent-purple)', background: 'rgba(129, 140, 248, 0.05)' }}>
          <h4 style={{ color: 'var(--accent-purple)', marginBottom: '1rem', fontSize: '1.25rem' }}>Excavation Labor Scheduling Math Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <p className="mb-2"><strong>1. Crew Daily Cost:</strong></p>
              <p className="text-muted text-sm">Calculate how much the entire labor crew costs for a single 8-hour workday:</p>
              <code>Rate (${hourlyRate}/hr) × Hours ({hoursPerDay} hrs) × Crew ({workers} workers) = <strong>${totalDailyCost}/day</strong></code>
            </div>
            
            <div>
              <p className="mb-2"><strong>2. Project Time Available:</strong></p>
              <p className="text-muted text-sm">Divide the total budgeted labor amount by the crew's daily cost to find the number of days the budget will last:</p>
              <code>Budget (${budget.toLocaleString()}) ÷ Daily Cost (${totalDailyCost}/day) = <strong>{daysAvailable.toFixed(2)} days</strong></code>
            </div>

            <div>
              <p className="mb-2"><strong>3. Scheduling Heuristics:</strong></p>
              <p className="text-muted text-sm">Adding more workers increases the daily cost and reduces the days available, but completes the physical work faster. In PE exams, ensure the calculated days match or exceed the duration required to dig the physical volume of soil.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborVisualizer;
