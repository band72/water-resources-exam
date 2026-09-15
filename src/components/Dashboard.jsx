import { useState } from 'react';
import { getProblemCategory } from '../utils/categorize';

const Dashboard = ({ problems, tools, onSelectProblem, onFilterCategory }) => {
  const [activeTab, setActiveTab] = useState('All');

  // Group problems by standardized PE Exam Category
  const categories = problems.reduce((acc, prob) => {
    const cat = getProblemCategory(prob);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(prob);
    return acc;
  }, {});

  const categoryIcons = {
    'Hydraulics & Hydrology': '🌊',
    'Water & Wastewater Systems': '🧪',
    'Soil Mechanics & Foundations': '🪨',
    'Structural Mechanics': '🏗️',
    'Project Planning & Economics': '📊',
    'Transportation & Geometrics': '🛣️',
    'General Engineering': '⚙️'
  };

  const defaultTools = [
    {
      id: 1,
      title: "Open Channel Hydraulics",
      badge: "Manning's Flow",
      icon: "🌊",
      color: "var(--accent-blue)",
      bgGlow: "rgba(56, 189, 248, 0.12)",
      borderColor: "rgba(56, 189, 248, 0.3)",
      formula: "Q = (1.49/n) · A · R^(2/3) · S^(1/2)",
      description: "Interactive pipe & channel depth slider with real-time wetted perimeter and hydraulic radius calculations."
    },
    {
      id: 2,
      title: "Canal Lining Estimator",
      badge: "Earthwork & Volume",
      icon: "🏗️",
      color: "var(--accent-amber)",
      bgGlow: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      formula: "V = Length · Perimeter · t · (1 + Waste)",
      description: "Parametric trapezoidal cross-section estimator with overexcavation and concrete waste factor modeling."
    },
    {
      id: 3,
      title: "Engineering Economics",
      badge: "Depreciation & PV",
      icon: "📈",
      color: "var(--accent-emerald)",
      bgGlow: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      formula: "BV_t = Cost - t · [(Cost - Salvage) / Life]",
      description: "Straight-line depreciation calculator and cash-flow timeline for construction equipment valuation."
    },
    {
      id: 77,
      title: "Primary Clarifier (BOD)",
      badge: "Wastewater Treatment",
      icon: "🧪",
      color: "var(--accent-purple)",
      bgGlow: "rgba(168, 85, 247, 0.12)",
      borderColor: "rgba(168, 85, 247, 0.3)",
      formula: "SOR = Q / A_surface · η = 1 - (BOD_e / BOD_i)",
      description: "Surface overflow rate (SOR), hydraulic detention time, and BOD removal efficiency analysis."
    },
    {
      id: 62,
      title: "Groundwater Well Hydraulics",
      badge: "Aquifer Drawdown",
      icon: "🚰",
      color: "var(--accent-cyan)",
      bgGlow: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      formula: "s = (Q / 2πT) · ln(R / r)",
      description: "Theis and Dupuit equilibrium drawdown cones for steady radial flow in confined and unconfined aquifers."
    },
    {
      id: 81,
      title: "Site Grading & Drainage",
      badge: "Earthwork & Elevations",
      icon: "🏡",
      color: "#fb923c",
      bgGlow: "rgba(251, 146, 60, 0.12)",
      borderColor: "rgba(251, 146, 60, 0.3)",
      formula: "Slope = ΔElevation / Horizontal Distance",
      description: "Finished Floor Elevation (FFE), cut/fill slopes, and surface runoff swale grading slopes."
    },
    {
      id: 82,
      title: "Runoff Specific Energy",
      badge: "Hydraulic Jumps",
      icon: "⛈️",
      color: "var(--accent-rose)",
      bgGlow: "rgba(244, 63, 94, 0.12)",
      borderColor: "rgba(244, 63, 94, 0.3)",
      formula: "E = y + V² / (2g) · Fr = V / √(g · y)",
      description: "Specific energy curves, critical depth (yc), Froude number regimes, and hydraulic jump energy loss."
    },
    {
      id: 80,
      title: "Critical Path Method (CPM)",
      badge: "Project Scheduling",
      icon: "⏱️",
      color: "var(--accent-indigo)",
      bgGlow: "rgba(99, 102, 241, 0.12)",
      borderColor: "rgba(99, 102, 241, 0.3)",
      formula: "Total Float = LF - EF = LS - ES",
      description: "Interactive activity-on-arrow network diagram, forward/backward pass computations, and critical path highlights."
    },
    {
      id: 96,
      title: "Retaining Wall Stability",
      badge: "Soil Mechanics",
      icon: "🧱",
      color: "var(--accent-cyan)",
      bgGlow: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      formula: "FS_OT = ΣM_R / M_OT · Ka = tan²(45° - φ/2)",
      description: "Rankine active lateral pressure, concrete gravity wall weight decomposition, and overturning factor of safety."
    },
    {
      id: 97,
      title: "Submerged Wall & Pore Pressure",
      badge: "Soil Mechanics",
      icon: "💧",
      color: "#38bdf8",
      bgGlow: "rgba(56, 189, 248, 0.12)",
      borderColor: "rgba(56, 189, 248, 0.3)",
      formula: "P_w = ½ · γ_w · h_w² · σ'_a = Ka · σ'_v",
      description: "Partially submerged backfill with hydrostatic pore water pressure, buoyant unit weight, and overturning stability."
    }
  ];
  const simulatorTools = tools && tools.length > 0 ? tools : defaultTools;

  const categoryKeys = Object.keys(categories);
  const displayedCategories = activeTab === 'All' ? categoryKeys : [activeTab];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%' }}>
      {/* Hero Studio Banner */}
      <section className="glass-panel" style={{ padding: '3rem 2.5rem', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient Gradient Blobs */}
        <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '850px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.85rem', borderRadius: '9999px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem' }}>⚡</span>
            <span className="text-xs" style={{ color: 'var(--accent-blue)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Civil PE Exam: Water Resources & Environmental Studio
            </span>
          </div>

          <h2 style={{ fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1rem' }}>
            Master Engineering Concepts with <span className="text-gradient">Interactive Simulators</span>
          </h2>

          <p style={{ fontSize: '1.15rem', lineHeight: 1.6, color: '#94a3b8', marginBottom: '2rem' }}>
            Explore 80+ rigorous PE exam practice problems. Adjust hydraulic parameters in real time, visualize fluid flows and open channels, inspect step-by-step NCEES handbook derivations, and master the exam shortcuts.
          </p>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.75rem' }}>
            <div>
              <div className="stat-value text-gradient-cyan" style={{ fontSize: '2rem' }}>82+</div>
              <div className="stat-label">Exam Problems</div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '2rem', color: 'var(--accent-indigo)' }}>12</div>
              <div className="stat-label">Interactive Simulators</div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '2rem', color: 'var(--accent-emerald)' }}>100%</div>
              <div className="stat-label">Step-by-Step Solutions</div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: '2rem', color: 'var(--accent-amber)' }}>v2.0</div>
              <div className="stat-label">NCEES Handbook Aligned</div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Quick Interactive Tools */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>✦</span>
              <span className="text-xs" style={{ color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Interactive Design Labs
              </span>
            </div>
            <h3 style={{ fontSize: '1.75rem' }}>Parametric Simulation Modules</h3>
          </div>
          <span className="text-xs text-muted">Click any module to launch simulation</span>
        </div>

        <div className="bento-grid">
          {simulatorTools.map((tool) => (
            <div 
              key={tool.id} 
              className="bento-card bento-col-3"
              style={{ background: tool.bgGlow, borderColor: tool.borderColor }}
              onClick={() => onSelectProblem(tool.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div className="bento-icon-badge" style={{ background: 'rgba(255, 255, 255, 0.08)', border: `1px solid ${tool.borderColor}` }}>
                    {tool.icon}
                  </div>
                  <span className="glass-badge" style={{ fontSize: '0.65rem', color: tool.color }}>
                    {tool.badge}
                  </span>
                </div>

                <h4 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: '#ffffff' }}>
                  {tool.title}
                </h4>

                <p style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.45, marginBottom: '1rem' }}>
                  {tool.description}
                </p>
              </div>

              <div>
                <div className="math-block" style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', marginBottom: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tool.formula}
                </div>

                <button 
                  className="solution-btn" 
                  style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.8rem', background: `linear-gradient(135deg, ${tool.color} 0%, rgba(255,255,255,0.2) 100%)` }}
                  onClick={(e) => { e.stopPropagation(); onSelectProblem(tool.id); }}
                >
                  Launch Module →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categorized Problem Catalog */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--accent-blue)' }}>✦</span>
              <span className="text-xs" style={{ color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Comprehensive Question Bank
              </span>
            </div>
            <h3 style={{ fontSize: '1.75rem' }}>Examination Problem Library</h3>
          </div>

          {/* Category Tabs */}
          <div className="tabs-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <button
              className={`tab-btn ${activeTab === 'All' ? 'active' : ''}`}
              onClick={() => { setActiveTab('All'); onFilterCategory('All'); }}
            >
              All Topics ({problems.length})
            </button>
            {categoryKeys.map(cat => (
              <button
                key={cat}
                className={`tab-btn ${activeTab === cat ? 'active' : ''}`}
                onClick={() => { setActiveTab(cat); onFilterCategory(cat); }}
              >
                {categoryIcons[cat] || '📘'} {cat} ({categories[cat].length})
              </button>
            ))}
          </div>
        </div>

        {/* Category Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {displayedCategories.map(category => {
            const catProblems = categories[category] || [];
            return (
              <div key={category} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '3px solid var(--accent-blue)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.75rem' }}>{categoryIcons[category] || '📘'}</span>
                    <div>
                      <h4 style={{ fontSize: '1.15rem', margin: 0 }}>{category}</h4>
                      <span className="text-xs text-muted">{catProblems.length} questions available</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {catProblems.map(prob => {
                    const hasSimulator = Boolean(prob.component && prob.component !== 'GenericProblemViewer');
                    return (
                      <div 
                        key={prob.id}
                        className="problem-card"
                        style={{ padding: '0.75rem 0.9rem' }}
                        onClick={() => onSelectProblem(prob.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            #{prob.id} {prob.title}
                          </span>
                          {hasSimulator && (
                            <span className="glass-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', color: 'var(--accent-cyan)', borderColor: 'rgba(6,182,212,0.3)' }}>
                              ⚡ Sim
                            </span>
                          )}
                        </div>
                        <p className="problem-card-desc" style={{ fontSize: '0.775rem', marginTop: '0.25rem' }}>
                          {prob.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
