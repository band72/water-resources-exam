import React, { useState, useMemo } from 'react';
import Dashboard from './components/Dashboard';
import { pluginRegistry, PluginRenderer } from './plugins';

// Standardized Category Resolver
export function getProblemCategory(prob) {
  let cat = prob.category || 'General Engineering';
  if (cat === 'PE Exam Topic' || cat === 'Uncategorized' || !prob.category) {
    const desc = (prob.description || '').toLowerCase();
    if (desc.includes('cost') || desc.includes('budget') || desc.includes('labor') || desc.includes('depreciation') || desc.includes('cpm') || desc.includes('duration')) {
      return 'Project Planning & Economics';
    } else if (desc.includes('soil') || desc.includes('footing') || desc.includes('clay') || desc.includes('sand') || desc.includes('consolidation') || desc.includes('settlement') || desc.includes('bearing') || desc.includes('earth pressure')) {
      return 'Soil Mechanics & Foundations';
    } else if (desc.includes('beam') || desc.includes('steel') || desc.includes('timber') || desc.includes('concrete') || desc.includes('load') || desc.includes('moment') || desc.includes('tension') || desc.includes('slab')) {
      return 'Structural Mechanics';
    } else if (desc.includes('pipe') || desc.includes('flow') || desc.includes('water') || desc.includes('pump') || desc.includes('channel') || desc.includes('runoff') || desc.includes('rainfall') || desc.includes('weir')) {
      return 'Hydraulics & Hydrology';
    } else if (desc.includes('wastewater') || desc.includes('bod') || desc.includes('effluent') || desc.includes('sludge') || desc.includes('treatment') || desc.includes('drinking')) {
      return 'Water & Wastewater Systems';
    } else if (desc.includes('curve') || desc.includes('sight distance') || desc.includes('station') || desc.includes('highway') || desc.includes('traffic')) {
      return 'Transportation & Geometrics';
    }
    return 'General Engineering';
  }

  if (cat === 'Quantity Estimating' || cat === 'Engineering Economics' || cat === 'Project Planning') return 'Project Planning & Economics';
  if (cat === 'Timber Design' || cat === 'Steel Design' || cat === 'Foundation Design') return 'Structural Mechanics';
  if (cat === 'Hydraulics') return 'Hydraulics & Hydrology';
  return cat;
}

function App() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('problem')) return 'problem';
      if (params.get('view')) return params.get('view');
    }
    return 'dashboard';
  });
  const [activeProblem, setActiveProblem] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get('problem'), 10);
      if (!isNaN(p)) return p;
    }
    return 1;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);

  const problems = useMemo(() => pluginRegistry.getAllProblems(), []);

  const currentProblem = useMemo(() => {
    return problems.find(p => p.id === activeProblem) || problems[0];
  }, [problems, activeProblem]);

  const currentIndex = useMemo(() => {
    return problems.findIndex(p => p.id === currentProblem.id);
  }, [problems, currentProblem]);

  const categories = useMemo(() => {
    const set = new Set();
    problems.forEach(p => set.add(getProblemCategory(p)));
    return ['All', ...Array.from(set)];
  }, [problems]);

  const filteredProblems = useMemo(() => {
    return problems.filter(p => {
      const cat = getProblemCategory(p);
      const matchesCategory = selectedCategory === 'All' || cat === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery = !query || 
        p.title.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query)) ||
        cat.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [problems, selectedCategory, searchQuery]);

  const handleSelectProblem = (id) => {
    setActiveProblem(id);
    setActiveView('problem');
    setSelectedOption(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.set('problem', id);
      url.searchParams.set('view', 'problem');
      window.history.pushState({}, '', url);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSelectProblem(problems[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      handleSelectProblem(problems[currentIndex + 1].id);
    }
  };

  const handleRandom = () => {
    const rand = problems[Math.floor(Math.random() * problems.length)];
    handleSelectProblem(rand.id);
  };

  const handleGoDashboard = () => {
    setActiveView('dashboard');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.delete('problem');
      url.searchParams.set('view', 'dashboard');
      window.history.pushState({}, '', url);
    }
  };

  return (
    <div className="app-container" style={{ gridTemplateColumns: sidebarOpen ? '360px 1fr' : '0px 1fr' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ display: sidebarOpen ? 'flex' : 'none' }}>
        <div className="sidebar-header">
          <div className="sidebar-brand" onClick={handleGoDashboard}>
            <div className="brand-icon">🌊</div>
            <div>
              <h1 style={{ fontSize: '1.25rem', lineHeight: 1.2 }}>Water Resources</h1>
              <p className="text-xs text-muted" style={{ fontWeight: 500 }}>PE Exam Interactive Studio</p>
            </div>
          </div>

          <button 
            className="btn-secondary" 
            style={{ 
              width: '100%', 
              padding: '0.6rem 1rem', 
              background: activeView === 'dashboard' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: activeView === 'dashboard' ? 'var(--accent-blue)' : 'var(--border-color)',
              color: activeView === 'dashboard' ? 'var(--accent-blue)' : 'var(--text-main)'
            }}
            onClick={handleGoDashboard}
          >
            <span>🧭</span> Examination Dashboard
          </button>

          {/* Search Box */}
          <div className="sidebar-search-box">
            <span className="sidebar-search-icon">🔍</span>
            <input 
              type="text" 
              className="sidebar-search-input"
              placeholder="Search 80+ exam problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="sidebar-categories">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'All' ? 'All Modules' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Problem List */}
        <div className="sidebar-problem-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem 0.5rem 0.25rem' }}>
            <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Problems ({filteredProblems.length})
            </span>
            {selectedCategory !== 'All' && (
              <button 
                onClick={() => setSelectedCategory('All')} 
                className="text-xs" 
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer' }}
              >
                Reset Filter
              </button>
            )}
          </div>

          {filteredProblems.map((prob) => {
            const isSim = Boolean(prob.component && prob.component !== 'GenericProblemViewer');
            const probCat = getProblemCategory(prob);
            const isActive = activeView === 'problem' && activeProblem === prob.id;

            return (
              <div 
                key={prob.id}
                className={`problem-card ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectProblem(prob.id)}
              >
                <div className="problem-card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontFamily: 'var(--font-mono)', 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: '4px',
                      background: isActive ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                      color: isActive ? '#000' : 'var(--text-muted)',
                      fontWeight: 700
                    }}>
                      #{prob.id}
                    </span>
                    <span style={{ fontSize: '0.875rem' }}>{prob.title}</span>
                  </span>
                  {isSim && (
                    <span title="Interactive Visualizer Available" style={{ fontSize: '0.85rem' }}>⚡</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem' }}>
                  <span className="glass-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
                    {probCat}
                  </span>
                </div>
                <p className="problem-card-desc">{prob.description}</p>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Sticky Top Navigation Bar */}
        <header className="main-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn-icon" 
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>

            {/* Breadcrumbs */}
            <div className="breadcrumbs">
              <span className="breadcrumb-item" onClick={() => setActiveView('dashboard')}>Dashboard</span>
              <span>/</span>
              {activeView === 'dashboard' ? (
                <span className="breadcrumb-active">Exam Hub</span>
              ) : (
                <>
                  <span className="breadcrumb-item" onClick={() => { setSelectedCategory(getProblemCategory(currentProblem)); setActiveView('dashboard'); }}>
                    {getProblemCategory(currentProblem)}
                  </span>
                  <span>/</span>
                  <span className="breadcrumb-active" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{currentProblem.id} {currentProblem.title}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Problem Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeView === 'problem' && (
              <>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                >
                  ← Prev
                </button>
                <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                  {currentIndex + 1} / {problems.length}
                </span>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  onClick={handleNext}
                  disabled={currentIndex >= problems.length - 1}
                >
                  Next →
                </button>
              </>
            )}

            <button 
              className="btn-secondary" 
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              onClick={handleRandom}
              title="Jump to a random PE problem"
            >
              🎲 Random
            </button>
          </div>
        </header>

        {/* Main Body */}
        <div className="main-body">
          {activeView === 'dashboard' ? (
            <Dashboard 
              problems={problems} 
              tools={pluginRegistry.getSimulatorTools()}
              onSelectProblem={handleSelectProblem} 
              onFilterCategory={(cat) => { setSelectedCategory(cat); }}
            />
          ) : (
            <>
              {/* Problem Statement Header */}
              <section className="glass-panel" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: (currentProblem.diagramUrl || currentProblem.photoUrl) ? 'minmax(320px, 1.3fr) minmax(280px, 1fr)' : '1fr', gap: '2rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span className="glass-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                        PE Exam #{currentProblem.id}
                      </span>
                      <span className="glass-badge">
                        {getProblemCategory(currentProblem)}
                      </span>
                      {currentProblem.component && currentProblem.component !== 'GenericProblemViewer' && (
                        <span className="glass-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                          ⚡ Interactive Simulator
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>{currentProblem.title}</h2>
                    
                    {/* Paragraph-formatted description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {currentProblem.description.split(/\n\s*\n/).map((para, idx) => (
                        <p key={idx} style={{ lineHeight: '1.7', fontSize: '1.05rem', color: '#cbd5e1', margin: 0 }}>
                          {para.trim()}
                        </p>
                      ))}
                    </div>

                    {/* Multiple-Choice Practice Quiz Options */}
                    {currentProblem.options && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                        <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.65rem' }}>
                          Select Multiple-Choice Answer:
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                          {currentProblem.options.map((opt) => {
                            const isSelected = selectedOption === opt.label;
                            return (
                              <button
                                key={opt.label}
                                onClick={() => setSelectedOption(opt.label)}
                                className="btn-secondary"
                                style={{
                                  justifyContent: 'flex-start',
                                  padding: '0.65rem 1rem',
                                  background: isSelected 
                                    ? (opt.correct ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)')
                                    : 'rgba(255, 255, 255, 0.04)',
                                  borderColor: isSelected
                                    ? (opt.correct ? 'var(--accent-emerald)' : 'var(--accent-rose)')
                                    : 'var(--border-color)',
                                  color: isSelected
                                    ? (opt.correct ? 'var(--accent-emerald)' : 'var(--accent-rose)')
                                    : 'var(--text-main)',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>({opt.label})</span>
                                <span style={{ fontWeight: 600 }}>{opt.text}</span>
                              </button>
                            );
                          })}
                        </div>

                        {selectedOption && (
                          <div style={{ 
                            marginTop: '0.75rem', 
                            fontSize: '0.9rem', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '10px', 
                            background: currentProblem.options.find(o => o.label === selectedOption)?.correct ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)', 
                            border: `1px solid ${currentProblem.options.find(o => o.label === selectedOption)?.correct ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
                            color: currentProblem.options.find(o => o.label === selectedOption)?.correct ? '#34d399' : '#f87171',
                            animation: 'modalEnter 0.2s ease'
                          }}>
                            {currentProblem.options.find(o => o.label === selectedOption)?.feedback}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Technical Vector Diagram Column */}
                  {currentProblem.diagramUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: '100%', maxWidth: '400px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', background: '#0b1120' }}>
                        <img 
                          src={currentProblem.diagramUrl} 
                          alt="Exam Technical Figure" 
                          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '320px', objectFit: 'contain' }} 
                        />
                      </div>
                      <span className="text-xs text-muted" style={{ fontStyle: 'italic', letterSpacing: '0.02em' }}>
                        Figure 1: Cross-Section & Boundary Conditions
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Dedicated Plugin Visualizer Rendering */}
              <PluginRenderer problem={currentProblem} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
