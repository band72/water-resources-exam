import React from 'react';

const Dashboard = ({ problems, onSelectProblem }) => {
  // Group problems by PE Exam Category
  const categories = problems.reduce((acc, prob) => {
    let cat = prob.category || 'General Engineering';
    
    // Dynamically categorize generic problems based on keywords
    if (cat === 'PE Exam Topic' || cat === 'Uncategorized') {
      const desc = prob.description.toLowerCase();
      if (desc.includes('cost') || desc.includes('budget') || desc.includes('labor') || desc.includes('depreciation') || desc.includes('cpm') || desc.includes('duration')) {
        cat = 'Project Planning & Economics';
      } else if (desc.includes('soil') || desc.includes('footing') || desc.includes('clay') || desc.includes('sand') || desc.includes('consolidation') || desc.includes('settlement') || desc.includes('bearing') || desc.includes('earth pressure')) {
        cat = 'Soil Mechanics & Foundations';
      } else if (desc.includes('beam') || desc.includes('steel') || desc.includes('timber') || desc.includes('concrete') || desc.includes('load') || desc.includes('moment') || desc.includes('tension') || desc.includes('slab')) {
        cat = 'Structural Mechanics';
      } else if (desc.includes('pipe') || desc.includes('flow') || desc.includes('water') || desc.includes('pump') || desc.includes('channel') || desc.includes('runoff') || desc.includes('rainfall') || desc.includes('weir')) {
        cat = 'Hydraulics & Hydrology';
      } else if (desc.includes('wastewater') || desc.includes('bod') || desc.includes('effluent') || desc.includes('sludge') || desc.includes('treatment') || desc.includes('drinking')) {
        cat = 'Water & Wastewater Systems';
      } else if (desc.includes('curve') || desc.includes('sight distance') || desc.includes('station') || desc.includes('highway') || desc.includes('traffic')) {
        cat = 'Transportation & Geometrics';
      } else {
        cat = 'General Engineering';
      }
    }

    // Merge similar hardcoded categories
    if (cat === 'Quantity Estimating' || cat === 'Engineering Economics') cat = 'Project Planning & Economics';
    if (cat === 'Timber Design' || cat === 'Steel Design' || cat === 'Foundation Design') cat = 'Structural Mechanics';

    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(prob);
    return acc;
  }, {});

  const categoryIcons = {
    'Hydraulics & Hydrology': '🌊',
    'Hydraulics': '🌊',
    'Water & Wastewater Systems': '💧',
    'Soil Mechanics & Foundations': '🪨',
    'Structural Mechanics': '🏗️',
    'Project Planning & Economics': '📊',
    'Transportation & Geometrics': '🛣️',
    'General Engineering': '⚙️'
  };

  return (
    <div className="w-full flex flex-col gap-8">
      <header className="glass-panel text-center py-10 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Water Resources PE Exam Guide</h2>
          <p className="text-muted" style={{ fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
            Interactive study dashboard. Select a module below to begin exploring detailed problem sets and interactive graphics.
          </p>
        </div>
        {/* Background decorative elements */}
        <div style={{ position: 'absolute', top: '-50%', left: '-10%', width: '300px', height: '300px', background: 'var(--accent-blue)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '-50%', right: '-10%', width: '300px', height: '300px', background: 'var(--accent-indigo)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>
      </header>

      <div className="glass-panel mb-4" style={{ borderLeft: '4px solid var(--accent-cyan)', marginBottom: '2rem' }}>
        <h3 className="text-gradient mb-2" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>⚡ Quick Tools</h3>
        <p className="text-muted text-sm mb-3">Jump directly to interactive design and analysis modules.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button onClick={() => onSelectProblem(1)} className="solution-btn" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent-cyan)' }}>
            🌊 Open Channel Simulator
          </button>
          <button onClick={() => onSelectProblem(101)} className="solution-btn" style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid var(--accent-indigo)' }}>
            🏗️ Canal Lining Design
          </button>
          <button onClick={() => onSelectProblem(2)} className="solution-btn" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)' }}>
            💰 Economic Analysis
          </button>
          <button onClick={() => onSelectProblem(77)} className="solution-btn" style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid var(--accent-pink)' }}>
            🧪 Primary Clarifier (BOD)
          </button>
          <button onClick={() => onSelectProblem(62)} className="solution-btn" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-blue)' }}>
            🚰 Groundwater Well
          </button>
          <button onClick={() => onSelectProblem(81)} className="solution-btn" style={{ background: 'rgba(251, 146, 60, 0.1)', border: '1px solid #fb923c' }}>
            🏡 Site Grading (FFE)
          </button>
          <button onClick={() => onSelectProblem(82)} className="solution-btn" style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid #f43f5e' }}>
            🌊 Runoff Energy
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
        {Object.entries(categories).map(([category, catProblems]) => (
          <div key={category} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <span style={{ fontSize: '2.5rem' }}>{categoryIcons[category] || '📘'}</span>
              <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{category}</h3>
            </div>
            
            <p className="text-muted text-sm">{catProblems.length} interactive problems available.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {catProblems.map(prob => (
                <button 
                  key={prob.id}
                  className="solution-btn"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', textAlign: 'left', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => onSelectProblem(prob.id)}
                >
                  <span style={{ fontWeight: 500 }}>{prob.title}</span>
                  <span style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        
        {/* Placeholder for future batch extraction */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px dashed var(--accent-indigo)', background: 'rgba(129, 140, 248, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>⏳</span>
            <h3 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-muted)' }}>More Problem Sets</h3>
          </div>
          <p className="text-muted text-sm">Additional 70+ exam problems are currently being extracted from NotebookLM and will appear here shortly.</p>
          <div style={{ height: '40px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse-glow 2s infinite' }}></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
