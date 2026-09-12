import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

const EconVisualizer = ({ 
  initialCost = 75000, 
  initialSalvage = 10000, 
  initialLife = 10,
  initialTargetYear = 8
}) => {
  const [cost, setCost] = useState(initialCost);
  const [salvage, setSalvage] = useState(initialSalvage);
  const [life, setLife] = useState(initialLife);
  const [targetYear, setTargetYear] = useState(initialTargetYear);
  const [showSolution, setShowSolution] = useState(false);
  
  // Math Calculations
  const annualDepreciation = (cost - salvage) / life;
  const currentBookValue = cost - (annualDepreciation * targetYear);

  // Generate chart data
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 0; i <= life; i++) {
      data.push({
        year: i,
        value: cost - (annualDepreciation * i)
      });
    }
    return data;
  }, [cost, salvage, life, annualDepreciation]);

  return (
    <div className="visualizer-wrapper">
      <div className="glass-panel visualizer-panel">
        {/* Controls */}
        <div className="visualizer-controls">
          <div>
            <h3 className="text-gradient" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Engineering Economics</h3>
            <p className="text-muted text-sm">Straight-line equipment depreciation</p>
          </div>
          
          <div className="control-group">
            <div className="control-header">
              <label>Target Year (n)</label>
              <span className="value-display">Year {targetYear}</span>
            </div>
            <input type="range" min="0" max={life} step="1" value={targetYear} onChange={(e) => setTargetYear(parseInt(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Initial Cost ($)</label>
              <span className="value-display">${cost.toLocaleString()}</span>
            </div>
            <input type="range" min="10000" max="200000" step="5000" value={cost} onChange={(e) => setCost(parseInt(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Salvage Value ($)</label>
              <span className="value-display">${salvage.toLocaleString()}</span>
            </div>
            <input type="range" min="0" max={50000} step="1000" value={salvage} onChange={(e) => setSalvage(parseInt(e.target.value))} />
          </div>

          <div className="control-group mt-2">
            <div className="control-header">
              <label>Useful Life (years)</label>
              <span className="value-display">{life}</span>
            </div>
            <input type="range" min="3" max="30" step="1" value={life} onChange={(e) => {
              const newLife = parseInt(e.target.value);
              setLife(newLife);
              if (targetYear > newLife) setTargetYear(newLife);
            }} />
          </div>
          
          <button onClick={() => setShowSolution(true)} className="solution-btn mt-4">
            View Solution & Background
          </button>
        </div>

        {/* SVG Graphic / Chart */}
        <div className="visualizer-graphic animate-float" style={{ minHeight: '300px', width: '100%', padding: '1rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="year" 
                tick={{fill: 'var(--text-muted)'}}
                label={{ value: 'Year', position: 'bottom', fill: 'var(--text-muted)' }}
              />
              <YAxis 
                tick={{fill: 'var(--text-muted)'}}
                tickFormatter={(val) => `$${val/1000}k`}
                domain={[0, 'dataMax + 10000']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                formatter={(val) => [`$${val.toLocaleString()}`, 'Book Value']}
                labelFormatter={(val) => `Year ${val}`}
              />
              <Line type="monotone" dataKey="value" stroke="var(--accent-cyan)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-dark)' }} activeDot={{ r: 8 }} />
              
              {/* Highlight Target Year */}
              <ReferenceDot x={targetYear} y={currentBookValue} r={8} fill="var(--accent-indigo)" stroke="white" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-label">Annual Depreciation (D)</span>
          <span className="stat-value text-gradient">${annualDepreciation.toLocaleString(undefined, {maximumFractionDigits: 0})}<span className="text-sm ml-1 text-muted">/yr</span></span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Book Value at Year {targetYear}</span>
          <span className="stat-value" style={{ color: 'var(--accent-cyan)'}}>${currentBookValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Total Value Lost</span>
          <span className="stat-value text-muted">${(annualDepreciation * targetYear).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
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
                <p>Imagine you buy a brand new bicycle for $100. Over the years, it gets scratched, the tires wear out, and it's not brand new anymore. So, its value goes down. This is called <strong>depreciation</strong>.</p>
                <ul>
                  <li><strong>Straight-Line Depreciation:</strong> This means the bicycle loses the exact same amount of value every single year until it gets to the end of its life.</li>
                  <li><strong>Initial Cost:</strong> How much the equipment costs brand new.</li>
                  <li><strong>Salvage Value:</strong> At the very end of its life, it's not completely worthless; you can usually sell it for parts or scrap metal. This is the salvage value.</li>
                  <li><strong>Book Value:</strong> The amount the equipment is mathematically "worth" right now, on paper, after subtracting all the value it has lost so far.</li>
                </ul>
              </div>

              <div className="explanation-section" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}>Step-by-Step Solution</h4>
                
                <div className="step">
                  <strong>Step 1: Calculate the total value that will be lost.</strong>
                  <p>Subtract the salvage value from the initial cost:</p>
                  <code className="math-block">Total Loss = $75,000 - $10,000 = $65,000</code>
                </div>
                
                <div className="step">
                  <strong>Step 2: Find the Annual Depreciation.</strong>
                  <p>Divide the total loss by the 10-year lifespan to find out how much value is lost every single year:</p>
                  <code className="math-block">Annual Depreciation = $65,000 / 10 years = $6,500 per year</code>
                </div>
                
                <div className="step">
                  <strong>Step 3: Calculate total depreciation at the target year (Year 8).</strong>
                  <p>Multiply the annual depreciation by 8 years:</p>
                  <code className="math-block">Total Lost After 8 Years = $6,500 × 8 = $52,000</code>
                </div>

                <div className="step">
                  <strong>Step 4: Determine Final Book Value.</strong>
                  <p>Subtract the total lost value from the original initial cost:</p>
                  <code className="math-block">Book Value = $75,000 - $52,000 = $23,000</code>
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

export default EconVisualizer;
