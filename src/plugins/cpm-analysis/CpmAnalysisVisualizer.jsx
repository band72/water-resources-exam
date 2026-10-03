import { useState, useMemo } from 'react';

/**
 * Critical Path Method (CPM) Network Analysis Studio
 * Interactive Activity-on-Node (AON) forward/backward pass calculator,
 * student textbox practice mode, duration sensitivity sliders, and Gantt schedule.
 */

// Initial default network matching the user's diagram
const INITIAL_ACTIVITIES = {
  A: { name: 'A', dur: 6, preds: ['START'], col: 1, row: 0 },
  B: { name: 'B', dur: 4, preds: ['START'], col: 1, row: 1 },
  F: { name: 'F', dur: 10, preds: ['START'], col: 1, row: 2 },
  C: { name: 'C', dur: 3, preds: ['A'], col: 2, row: 0 },
  D: { name: 'D', dur: 4, preds: ['B'], col: 2, row: 1 },
  E: { name: 'E', dur: 3, preds: ['B'], col: 2, row: 2 },
  H: { name: 'H', dur: 2, preds: ['C', 'D'], col: 3, row: 0.5 },
  G: { name: 'G', dur: 3, preds: ['E', 'F'], col: 3, row: 1.5 }
};

const CpmAnalysisVisualizer = () => {
  // Mode: 'practice' (student types in textboxes) | 'solver' (auto-computed with sliders)
  const [mode, setMode] = useState('practice');

  // Activity durations (controlled by sliders)
  const [durations, setDurations] = useState({
    A: 6,
    B: 4,
    F: 10,
    C: 3,
    D: 4,
    E: 3,
    H: 2,
    G: 3
  });

  // Student Practice Textbox inputs: { [actId]: { es: '', ef: '', ls: '', lf: '', tf: '' } }
  const [userInputs, setUserInputs] = useState({
    A: { es: '', ef: '', ls: '', lf: '', tf: '' },
    B: { es: '', ef: '', ls: '', lf: '', tf: '' },
    F: { es: '', ef: '', ls: '', lf: '', tf: '' },
    C: { es: '', ef: '', ls: '', lf: '', tf: '' },
    D: { es: '', ef: '', ls: '', lf: '', tf: '' },
    E: { es: '', ef: '', ls: '', lf: '', tf: '' },
    H: { es: '', ef: '', ls: '', lf: '', tf: '' },
    G: { es: '', ef: '', ls: '', lf: '', tf: '' }
  });

  const [hasChecked, setHasChecked] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('F');

  // Compute Ground-Truth CPM Solution (Forward & Backward Pass)
  const solution = useMemo(() => {
    // 1. Successors map
    const succs = { START: [], A: [], B: [], F: [], C: [], D: [], E: [], H: [], G: [], FINISH: [] };
    Object.entries(INITIAL_ACTIVITIES).forEach(([id, act]) => {
      act.preds.forEach(p => {
        if (!succs[p]) succs[p] = [];
        succs[p].push(id);
      });
    });
    // H and G go to FINISH
    succs.H.push('FINISH');
    succs.G.push('FINISH');

    // 2. Forward Pass: Topologically sorted
    // Order: START -> A, B, F -> C, D, E -> H, G -> FINISH
    const res = {};
    const actOrder = ['A', 'B', 'F', 'C', 'D', 'E', 'H', 'G'];

    // Forward pass
    actOrder.forEach(id => {
      const preds = INITIAL_ACTIVITIES[id].preds;
      const dur = durations[id] || 0;
      let es = 0;
      preds.forEach(p => {
        if (p === 'START') {
          es = Math.max(es, 0);
        } else if (res[p]) {
          es = Math.max(es, res[p].ef);
        }
      });
      const ef = es + dur;
      res[id] = { id, dur, es, ef };
    });

    // Project Duration
    const projectDuration = Math.max(res.H.ef, res.G.ef);

    // 3. Backward Pass (Reverse Order)
    const revOrder = ['G', 'H', 'E', 'D', 'C', 'F', 'B', 'A'];
    revOrder.forEach(id => {
      const succList = succs[id];
      const dur = durations[id] || 0;
      let lf = projectDuration;
      if (succList && succList.length > 0) {
        let minSuccLs = Infinity;
        succList.forEach(s => {
          if (s === 'FINISH') {
            minSuccLs = Math.min(minSuccLs, projectDuration);
          } else if (res[s]) {
            minSuccLs = Math.min(minSuccLs, res[s].ls);
          }
        });
        lf = minSuccLs === Infinity ? projectDuration : minSuccLs;
      }
      const ls = lf - dur;
      const tf = ls - res[id].es; // Total Float = LS - ES = LF - EF

      // Free Float: min(ES of successors) - EF
      let minSuccEs = projectDuration;
      if (succList && succList.length > 0) {
        succList.forEach(s => {
          if (s === 'FINISH') minSuccEs = Math.min(minSuccEs, projectDuration);
          else if (res[s]) minSuccEs = Math.min(minSuccEs, res[s].es);
        });
      }
      const ff = Math.max(0, minSuccEs - res[id].ef);
      const isCritical = tf === 0;

      res[id] = {
        ...res[id],
        ls,
        lf,
        tf,
        ff,
        isCritical
      };
    });

    // 4. Critical Paths Identification
    const paths = [
      { name: 'Start → A → C → H → Finish', acts: ['A', 'C', 'H'], dur: (durations.A || 0) + (durations.C || 0) + (durations.H || 0) },
      { name: 'Start → B → D → H → Finish', acts: ['B', 'D', 'H'], dur: (durations.B || 0) + (durations.D || 0) + (durations.H || 0) },
      { name: 'Start → B → E → G → Finish', acts: ['B', 'E', 'G'], dur: (durations.B || 0) + (durations.E || 0) + (durations.G || 0) },
      { name: 'Start → F → G → Finish', acts: ['F', 'G'], dur: (durations.F || 0) + (durations.G || 0) }
    ];

    paths.sort((a, b) => b.dur - a.dur);
    const criticalPath = paths[0];

    return {
      nodes: res,
      projectDuration,
      paths,
      criticalPath,
      succs
    };
  }, [durations]);

  // Handle user typing into practice textboxes
  const handleInputChange = (actId, field, val) => {
    setUserInputs(prev => ({
      ...prev,
      [actId]: {
        ...prev[actId],
        [field]: val
      }
    }));
    setHasChecked(false);
  };

  // Practice Mode: Check student inputs against solution
  const checkResults = useMemo(() => {
    if (!hasChecked) return null;
    let correctCount = 0;
    let totalCount = 0;
    const errors = {};

    Object.keys(INITIAL_ACTIVITIES).forEach(id => {
      const correct = solution.nodes[id];
      const user = userInputs[id];
      const actErrors = {};

      ['es', 'ef', 'ls', 'lf', 'tf'].forEach(field => {
        totalCount++;
        const parsed = parseInt(user[field], 10);
        if (!isNaN(parsed) && parsed === correct[field]) {
          correctCount++;
        } else {
          actErrors[field] = true;
        }
      });
      errors[id] = actErrors;
    });

    return {
      correctCount,
      totalCount,
      percentage: Math.round((correctCount / totalCount) * 100),
      errors
    };
  }, [hasChecked, userInputs, solution]);

  // Auto-fill helpers for practice mode
  const autoFillForward = () => {
    setUserInputs(prev => {
      const next = { ...prev };
      Object.keys(INITIAL_ACTIVITIES).forEach(id => {
        next[id] = {
          ...next[id],
          es: String(solution.nodes[id].es),
          ef: String(solution.nodes[id].ef)
        };
      });
      return next;
    });
    setHasChecked(false);
  };

  const autoFillBackward = () => {
    setUserInputs(prev => {
      const next = { ...prev };
      Object.keys(INITIAL_ACTIVITIES).forEach(id => {
        next[id] = {
          ...next[id],
          ls: String(solution.nodes[id].ls),
          lf: String(solution.nodes[id].lf)
        };
      });
      return next;
    });
    setHasChecked(false);
  };

  const autoFillAll = () => {
    setUserInputs(prev => {
      const next = { ...prev };
      Object.keys(INITIAL_ACTIVITIES).forEach(id => {
        next[id] = {
          es: String(solution.nodes[id].es),
          ef: String(solution.nodes[id].ef),
          ls: String(solution.nodes[id].ls),
          lf: String(solution.nodes[id].lf),
          tf: String(solution.nodes[id].tf)
        };
      });
      return next;
    });
    setHasChecked(true);
  };

  const resetInputs = () => {
    setUserInputs({
      A: { es: '', ef: '', ls: '', lf: '', tf: '' },
      B: { es: '', ef: '', ls: '', lf: '', tf: '' },
      F: { es: '', ef: '', ls: '', lf: '', tf: '' },
      C: { es: '', ef: '', ls: '', lf: '', tf: '' },
      D: { es: '', ef: '', ls: '', lf: '', tf: '' },
      E: { es: '', ef: '', ls: '', lf: '', tf: '' },
      H: { es: '', ef: '', ls: '', lf: '', tf: '' },
      G: { es: '', ef: '', ls: '', lf: '', tf: '' }
    });
    setHasChecked(false);
  };

  // Node Positions on SVG canvas (width: 960, height: 480)
  const nodeLayout = {
    START: { x: 30, y: 200, w: 75, h: 55 },
    A: { x: 180, y: 40, w: 140, h: 90 },
    B: { x: 180, y: 180, w: 140, h: 90 },
    F: { x: 180, y: 320, w: 140, h: 90 },
    C: { x: 400, y: 40, w: 140, h: 90 },
    D: { x: 400, y: 180, w: 140, h: 90 },
    E: { x: 400, y: 320, w: 140, h: 90 },
    H: { x: 620, y: 110, w: 140, h: 90 },
    G: { x: 620, y: 250, w: 140, h: 90 },
    FINISH: { x: 840, y: 200, w: 85, h: 55 }
  };

  // Edges connecting nodes
  const edges = [
    { from: 'START', to: 'A' },
    { from: 'START', to: 'B' },
    { from: 'START', to: 'F' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'B', to: 'E' },
    { from: 'C', to: 'H' },
    { from: 'D', to: 'H' },
    { from: 'E', to: 'G' },
    { from: 'F', to: 'G' },
    { from: 'H', to: 'FINISH' },
    { from: 'G', to: 'FINISH' }
  ];

  // Helper to determine if an edge is critical
  const isEdgeCritical = (from, to) => {
    if (from === 'START' && solution.nodes[to]?.isCritical && solution.nodes[to]?.es === 0) return true;
    if (to === 'FINISH' && solution.nodes[from]?.isCritical && solution.nodes[from]?.ef === solution.projectDuration) return true;
    if (solution.nodes[from]?.isCritical && solution.nodes[to]?.isCritical) {
      return solution.nodes[from].ef === solution.nodes[to].es;
    }
    return false;
  };

  return (
    <div style={{
      background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
      borderRadius: '16px',
      border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
      padding: '1.75rem',
      boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'var(--glass-blur, blur(20px))',
      color: 'var(--text-main, #f1f5f9)'
    }}>
      {/* Visualizer Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
        paddingBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem'
          }}>
            ⏱️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
                CPM Network Analysis &amp; Float Calculator
              </h2>
              <span className="glass-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo, #818cf8)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                AON Interactive Lab
              </span>
            </div>
            <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0 0' }}>
              Standard NCEES Activity-on-Node (AON) 6-box diagram with practice textboxes, forward/backward passes, duration sliders, and critical path highlights.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => setMode('practice')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'practice' ? 'var(--accent-indigo, #6366f1)' : 'transparent',
                color: mode === 'practice' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: mode === 'practice' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              📝 Student Practice Mode (Textboxes)
            </button>
            <button
              onClick={() => setMode('solver')}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'solver' ? 'var(--accent-emerald, #10b981)' : 'transparent',
                color: mode === 'solver' ? '#070a12' : 'var(--text-muted)',
                fontWeight: mode === 'solver' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              ⚡ Live Solver &amp; Sliders
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #f43f5e' }}>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Critical Path (Longest Path)</span>
          <strong style={{ fontSize: '1.15rem', color: '#f43f5e' }}>
            {solution.criticalPath.name}
          </strong>
          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
            Total Float = 0 days across critical activities
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Total Project Duration</span>
          <strong style={{ fontSize: '1.3rem', color: 'var(--accent-emerald)' }}>
            {solution.projectDuration} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>working days</span>
          </strong>
          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
            Governed by path Start → F → G → Finish
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-blue)' }}>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Activity A Float (TF / FF)</span>
          <strong style={{ fontSize: '1.3rem', color: 'var(--accent-blue)' }}>
            TF = {solution.nodes.A.tf} d / FF = {solution.nodes.A.ff} d
          </strong>
          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
            Can be delayed 2 days without delaying project
          </span>
        </div>

        <div className="glass-panel" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--accent-amber)' }}>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Activity B Float (TF / FF)</span>
          <strong style={{ fontSize: '1.3rem', color: 'var(--accent-amber)' }}>
            TF = {solution.nodes.B.tf} d / FF = {solution.nodes.B.ff} d
          </strong>
          <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.2rem' }}>
            Paths B-D-H and B-E-G each take 10 days
          </span>
        </div>
      </div>

      {/* Practice Toolbar (Only visible in Practice Mode) */}
      {mode === 'practice' && (
        <div className="glass-panel" style={{
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'rgba(30, 41, 59, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
              Practice Mode Tools:
            </span>
            <button
              onClick={() => setHasChecked(true)}
              className="btn-primary"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', background: '#6366f1', borderColor: '#4f46e5' }}
            >
              ✅ Check My Answers
            </button>
            <button
              onClick={autoFillForward}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              title="Auto-fill Early Start and Early Finish"
            >
              Forward Pass →
            </button>
            <button
              onClick={autoFillBackward}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              title="Auto-fill Late Start and Late Finish"
            >
              ← Backward Pass
            </button>
            <button
              onClick={autoFillAll}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', borderColor: 'var(--accent-emerald)' }}
              title="Reveal all values"
            >
              Reveal All
            </button>
            <button
              onClick={resetInputs}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
              title="Clear all textboxes"
            >
              Clear
            </button>
          </div>

          {checkResults && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="glass-badge" style={{
                background: checkResults.percentage === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: checkResults.percentage === 100 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                borderColor: checkResults.percentage === 100 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                fontSize: '0.8rem'
              }}>
                Score: {checkResults.correctCount} / {checkResults.totalCount} ({checkResults.percentage}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* INTERACTIVE AON NETWORK SVG DIAGRAM                                   */}
      {/* ===================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>
              Activity-on-Node (AON) Network Diagram
            </strong>
            <span className="text-xs text-muted" style={{ display: 'block' }}>
              Standard 6-box node layout: [ES | Duration | EF] on top, [LS | Float | LF] on bottom. Red border indicates Critical Path.
            </span>
          </div>
          {/* Node Legend */}
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, border: '2px solid #f43f5e', background: 'rgba(244, 63, 94, 0.15)' }} /> Critical (TF = 0)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 12, height: 12, borderRadius: 2, border: '1px solid #38bdf8', background: 'rgba(56, 189, 248, 0.1)' }} /> Non-Critical
            </span>
          </div>
        </div>

        {/* SVG Canvas Container */}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.9) 0%, rgba(7,11,20,0.98) 100%)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '0.5rem'
        }}>
          <svg viewBox="0 0 960 460" style={{ width: '100%', minWidth: '850px', height: 'auto', display: 'block' }}>
            <defs>
              {/* Arrowheads */}
              <marker id="arrow-normal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
              </marker>
              <marker id="arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
              </marker>
            </defs>

            {/* Connecting Dependency Arrows */}
            {edges.map(({ from, to }) => {
              const pFrom = nodeLayout[from];
              const pTo = nodeLayout[to];
              const isCrit = isEdgeCritical(from, to);

              // Calculate start and end coordinates
              const x1 = pFrom.x + pFrom.w;
              const y1 = pFrom.y + pFrom.h / 2;
              const x2 = pTo.x;
              const y2 = pTo.y + pTo.h / 2;

              // Routing path
              let dPath = `M ${x1} ${y1} L ${x2} ${y2}`;

              // Special routing for F -> G to go cleanly around E
              if (from === 'F' && to === 'G') {
                const midX = pFrom.x + pFrom.w + 35;
                const botY = pFrom.y + pFrom.h + 20;
                dPath = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${botY} L ${x2 - 15} ${botY} L ${x2 - 15} ${y2} L ${x2} ${y2}`;
              } else if (Math.abs(y1 - y2) > 30) {
                // Smooth stepped curve for diagonal connections
                const midX = (x1 + x2) / 2;
                dPath = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
              }

              return (
                <path
                  key={`${from}-${to}`}
                  d={dPath}
                  fill="none"
                  stroke={isCrit ? '#f43f5e' : '#475569'}
                  strokeWidth={isCrit ? 2.5 : 1.5}
                  strokeDasharray={isCrit ? 'none' : 'none'}
                  markerEnd={isCrit ? 'url(#arrow-critical)' : 'url(#arrow-normal)'}
                  opacity={isCrit ? 1 : 0.7}
                />
              );
            })}

            {/* Milestone Node: START */}
            <g transform={`translate(${nodeLayout.START.x}, ${nodeLayout.START.y})`}>
              <rect x="0" y="0" width={nodeLayout.START.w} height={nodeLayout.START.h} rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="37" y="32" fill="#38bdf8" fontSize="12" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                START
              </text>
            </g>

            {/* Milestone Node: FINISH */}
            <g transform={`translate(${nodeLayout.FINISH.x}, ${nodeLayout.FINISH.y})`}>
              <rect x="0" y="0" width={nodeLayout.FINISH.w} height={nodeLayout.FINISH.h} rx="8" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
              <text x="42" y="27" fill="#10b981" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                FINISH
              </text>
              <text x="42" y="44" fill="#cbd5e1" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                Day {solution.projectDuration}
              </text>
            </g>

            {/* Activity-on-Node 6-Box Blocks */}
            {Object.entries(INITIAL_ACTIVITIES).map(([id, act]) => {
              const pos = nodeLayout[id];
              const sol = solution.nodes[id];
              const isCrit = sol.isCritical;
              const isSelected = selectedActivity === id;
              const u = userInputs[id];
              const errs = checkResults?.errors?.[id] || {};

              const strokeColor = isCrit ? '#f43f5e' : (isSelected ? '#6366f1' : '#334155');
              const bgColor = isCrit ? 'rgba(244, 63, 94, 0.08)' : 'rgba(15, 23, 42, 0.95)';

              return (
                <g
                  key={id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => setSelectedActivity(id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Node Outer Shell */}
                  <rect
                    x="0"
                    y="0"
                    width={pos.w}
                    height={pos.h}
                    rx="6"
                    fill={bgColor}
                    stroke={strokeColor}
                    strokeWidth={isCrit ? 2.5 : (isSelected ? 2 : 1)}
                  />

                  {/* Internal Grid Lines */}
                  {/* Horizontal Line 1 (separates top row: ES, Dur, EF) */}
                  <line x1="0" y1="28" x2={pos.w} y2="28" stroke="#334155" strokeWidth="1" />
                  {/* Horizontal Line 2 (separates middle row: Activity) */}
                  <line x1="0" y1="58" x2={pos.w} y2="58" stroke="#334155" strokeWidth="1" />

                  {/* Vertical Lines in Top Row */}
                  <line x1={pos.w * 0.32} y1="0" x2={pos.w * 0.32} y2="28" stroke="#334155" strokeWidth="1" />
                  <line x1={pos.w * 0.68} y1="0" x2={pos.w * 0.68} y2="28" stroke="#334155" strokeWidth="1" />

                  {/* Vertical Lines in Bottom Row */}
                  <line x1={pos.w * 0.32} y1="58" x2={pos.w * 0.32} y2={pos.h} stroke="#334155" strokeWidth="1" />
                  <line x1={pos.w * 0.68} y1="58" x2={pos.w * 0.68} y2={pos.h} stroke="#334155" strokeWidth="1" />

                  {/* Top-Middle: Duration (Standard green text as in user drawing) */}
                  <text x={pos.w * 0.5} y="19" fill="#22c55e" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                    {durations[id]}
                  </text>

                  {/* Middle Row: Activity Identifier */}
                  <text x={pos.w * 0.5} y="47" fill={isCrit ? '#f43f5e' : '#f8fafc'} fontSize="15" fontWeight="800" textAnchor="middle" fontFamily="var(--font-heading)">
                    {act.name}
                  </text>

                  {/* ========================================================= */}
                  {/* MODE A: STUDENT PRACTICE TEXTBOXES (HTML Inputs in SVG)   */}
                  {/* ========================================================= */}
                  {mode === 'practice' ? (
                    <>
                      {/* Top-Left: ES Input */}
                      <foreignObject x="2" y="2" width={pos.w * 0.32 - 4} height="24">
                        <input
                          type="text"
                          value={u.es}
                          onChange={(e) => handleInputChange(id, 'es', e.target.value)}
                          placeholder="ES"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: errs.es ? 'rgba(244, 63, 94, 0.35)' : 'transparent',
                            color: '#38bdf8',
                            border: errs.es ? '1px solid #f43f5e' : 'none',
                            borderRadius: '3px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </foreignObject>

                      {/* Top-Right: EF Input */}
                      <foreignObject x={pos.w * 0.68 + 2} y="2" width={pos.w * 0.32 - 4} height="24">
                        <input
                          type="text"
                          value={u.ef}
                          onChange={(e) => handleInputChange(id, 'ef', e.target.value)}
                          placeholder="EF"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: errs.ef ? 'rgba(244, 63, 94, 0.35)' : 'transparent',
                            color: '#38bdf8',
                            border: errs.ef ? '1px solid #f43f5e' : 'none',
                            borderRadius: '3px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </foreignObject>

                      {/* Bottom-Left: LS Input */}
                      <foreignObject x="2" y="62" width={pos.w * 0.32 - 4} height="24">
                        <input
                          type="text"
                          value={u.ls}
                          onChange={(e) => handleInputChange(id, 'ls', e.target.value)}
                          placeholder="LS"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: errs.ls ? 'rgba(244, 63, 94, 0.35)' : 'transparent',
                            color: '#fbbf24',
                            border: errs.ls ? '1px solid #f43f5e' : 'none',
                            borderRadius: '3px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </foreignObject>

                      {/* Bottom-Middle: Total Float Input */}
                      <foreignObject x={pos.w * 0.32 + 2} y="62" width={pos.w * 0.36 - 4} height="24">
                        <input
                          type="text"
                          value={u.tf}
                          onChange={(e) => handleInputChange(id, 'tf', e.target.value)}
                          placeholder="TF"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: errs.tf ? 'rgba(244, 63, 94, 0.35)' : 'transparent',
                            color: '#a855f7',
                            border: errs.tf ? '1px solid #f43f5e' : 'none',
                            borderRadius: '3px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </foreignObject>

                      {/* Bottom-Right: LF Input */}
                      <foreignObject x={pos.w * 0.68 + 2} y="62" width={pos.w * 0.32 - 4} height="24">
                        <input
                          type="text"
                          value={u.lf}
                          onChange={(e) => handleInputChange(id, 'lf', e.target.value)}
                          placeholder="LF"
                          style={{
                            width: '100%',
                            height: '100%',
                            background: errs.lf ? 'rgba(244, 63, 94, 0.35)' : 'transparent',
                            color: '#fbbf24',
                            border: errs.lf ? '1px solid #f43f5e' : 'none',
                            borderRadius: '3px',
                            textAlign: 'center',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            outline: 'none',
                            padding: 0
                          }}
                        />
                      </foreignObject>
                    </>
                  ) : (
                    /* ========================================================= */
                    /* MODE B: LIVE AUTO-SOLVER DISPLAY (Computed text)          */
                    /* ========================================================= */
                    <>
                      {/* Top-Left: Early Start */}
                      <text x={pos.w * 0.16} y="19" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                        {sol.es}
                      </text>
                      {/* Top-Right: Early Finish */}
                      <text x={pos.w * 0.84} y="19" fill="#38bdf8" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                        {sol.ef}
                      </text>
                      {/* Bottom-Left: Late Start */}
                      <text x={pos.w * 0.16} y="78" fill="#fbbf24" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                        {sol.ls}
                      </text>
                      {/* Bottom-Middle: Total Float */}
                      <text x={pos.w * 0.5} y="78" fill={isCrit ? '#f43f5e' : '#a855f7'} fontSize="12" fontWeight="800" textAnchor="middle" fontFamily="var(--font-mono)">
                        {sol.tf}
                      </text>
                      {/* Bottom-Right: Late Finish */}
                      <text x={pos.w * 0.84} y="78" fill="#fbbf24" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="var(--font-mono)">
                        {sol.lf}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DURATION SLIDERS (100% INTERACTIVE WITH SLIDERS)                      */}
      {/* ===================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>
              🎛️ Activity Duration Sliders &amp; Schedule Sensitivity
            </strong>
            <span className="text-xs text-muted" style={{ display: 'block' }}>
              Drag any slider to change working days and observe how the Critical Path and project duration dynamically respond!
            </span>
          </div>
          <button
            onClick={() => setDurations({ A: 6, B: 4, F: 10, C: 3, D: 4, E: 3, H: 2, G: 3 })}
            className="btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
          >
            Reset Durations to Default
          </button>
        </div>

        {/* Sliders Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}>
          {Object.keys(INITIAL_ACTIVITIES).map(id => {
            const sol = solution.nodes[id];
            const isCrit = sol.isCritical;

            return (
              <div
                key={id}
                style={{
                  background: isCrit ? 'rgba(244, 63, 94, 0.08)' : 'rgba(0, 0, 0, 0.25)',
                  border: `1px solid ${isCrit ? 'rgba(244, 63, 94, 0.4)' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  padding: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isCrit ? '#f43f5e' : '#f1f5f9' }}>
                    Activity {id} {isCrit && '★'}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: isCrit ? '#f43f5e' : 'var(--accent-emerald)' }}>
                    {durations[id]} days
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={durations[id]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setDurations(prev => ({ ...prev, [id]: val }));
                  }}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>ES: {sol.es} | EF: {sol.ef}</span>
                  <span style={{ color: isCrit ? '#f43f5e' : '#a855f7' }}>Float: {sol.tf}d</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DETAILED CPM SCHEDULE TABLE & GANTT BAR VISUALIZATION                */}
      {/* ===================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        {/* Activity Calculation Table */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <strong style={{ fontSize: '0.9rem', color: '#f1f5f9', display: 'block', marginBottom: '0.75rem' }}>
            📊 Activity Schedule &amp; Float Summary Table
          </strong>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.4rem 0.2rem' }}>Act</th>
                  <th>Dur</th>
                  <th>Preds</th>
                  <th style={{ color: '#38bdf8' }}>ES</th>
                  <th style={{ color: '#38bdf8' }}>EF</th>
                  <th style={{ color: '#fbbf24' }}>LS</th>
                  <th style={{ color: '#fbbf24' }}>LF</th>
                  <th style={{ color: '#a855f7' }}>TF</th>
                  <th style={{ color: '#06b6d4' }}>FF</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(INITIAL_ACTIVITIES).map(id => {
                  const s = solution.nodes[id];
                  const act = INITIAL_ACTIVITIES[id];
                  return (
                    <tr
                      key={id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: s.isCritical ? 'rgba(244, 63, 94, 0.07)' : 'transparent',
                        fontWeight: s.isCritical ? 700 : 500
                      }}
                    >
                      <td style={{ padding: '0.4rem 0.2rem', color: s.isCritical ? '#f43f5e' : '#fff' }}>{id}</td>
                      <td>{s.dur}d</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{act.preds.join(', ')}</td>
                      <td style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{s.es}</td>
                      <td style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{s.ef}</td>
                      <td style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{s.ls}</td>
                      <td style={{ color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{s.lf}</td>
                      <td style={{ color: s.isCritical ? '#f43f5e' : '#a855f7', fontFamily: 'var(--font-mono)' }}>{s.tf}</td>
                      <td style={{ color: '#06b6d4', fontFamily: 'var(--font-mono)' }}>{s.ff}</td>
                      <td>
                        <span className="glass-badge" style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.35rem',
                          background: s.isCritical ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: s.isCritical ? '#f43f5e' : 'var(--text-muted)',
                          borderColor: s.isCritical ? '#f43f5e' : 'transparent'
                        }}>
                          {s.isCritical ? 'CRITICAL' : `${s.tf}d Float`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gantt Timeline Bar Chart */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <strong style={{ fontSize: '0.9rem', color: '#f1f5f9', display: 'block', marginBottom: '0.75rem' }}>
            📅 Early Start Gantt Timeline &amp; Float Windows
          </strong>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.keys(INITIAL_ACTIVITIES).map(id => {
              const s = solution.nodes[id];
              const totalDays = Math.max(14, solution.projectDuration);
              const leftPct = (s.es / totalDays) * 100;
              const widthPct = (s.dur / totalDays) * 100;
              const floatPct = (s.tf / totalDays) * 100;

              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <span style={{ width: '20px', fontWeight: 700, color: s.isCritical ? '#f43f5e' : '#cbd5e1' }}>
                    {id}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '18px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Active Working Duration Bar */}
                    <div style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '100%',
                      background: s.isCritical ? '#f43f5e' : '#38bdf8',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: 700
                    }}>
                      {s.dur}d
                    </div>

                    {/* Total Float Bar */}
                    {s.tf > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: `${leftPct + widthPct}%`,
                        width: `${floatPct}%`,
                        height: '100%',
                        background: 'repeating-linear-gradient(45deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.2) 4px, rgba(168, 85, 247, 0.05) 4px, rgba(168, 85, 247, 0.05) 8px)',
                        borderRight: '2px solid #a855f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '3px',
                        color: '#d8b4fe',
                        fontSize: '0.6rem'
                      }}>
                        +{s.tf}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Time Axis */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.3rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>Day 0</span>
              <span>Day {Math.round(solution.projectDuration / 2)}</span>
              <span>Day {solution.projectDuration}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP-BY-STEP CPM RULES & CIVIL PE REFERENCE GUIDE                     */}
      {/* ===================================================================== */}
      <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(15, 23, 42, 0.9)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--accent-indigo, #818cf8)' }}>
          📐 CPM Construction Scheduling Governing Equations (NCEES Civil PE Handbook)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #38bdf8' }}>
            <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '0.3rem' }}>
              1. Forward Pass (Early Times)
            </strong>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', display: 'block', lineHeight: 1.6 }}>
              EF = ES + Duration<br />
              ES = max(EF of all immediate predecessors)<br />
              Project Completion = max(EF of terminal activities)
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #fbbf24' }}>
            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '0.3rem' }}>
              2. Backward Pass (Late Times)
            </strong>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', display: 'block', lineHeight: 1.6 }}>
              LF = min(LS of all immediate successors)<br />
              LS = LF − Duration<br />
              Terminal activities start with LF = Project Duration
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #a855f7' }}>
            <strong style={{ color: '#a855f7', display: 'block', marginBottom: '0.3rem' }}>
              3. Total Float &amp; Free Float
            </strong>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', display: 'block', lineHeight: 1.6 }}>
              Total Float (TF) = LS − ES = LF − EF<br />
              Free Float (FF) = min(ES of successors) − EF<br />
              Critical Path = Activities where TF = 0
            </span>
          </div>
        </div>

        {/* 3rd-Grader Intuition Callout */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.85rem 1rem',
          borderRadius: '8px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '1.4rem' }}>👦</span>
          <div>
            <strong style={{ color: 'var(--accent-indigo, #818cf8)', fontSize: '0.85rem', display: 'block' }}>
              3rd-Grader Intuition: The Relay Race Bottleneck
            </strong>
            <span style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              Imagine building a treehouse with 3 teams! Team 1 builds the ladder (11 days), Team 2 builds the floor (10 days), but Team 3 has to saw giant tree beams (Path F-G, 13 days). Even if Team 1 and 2 finish early, nobody can put the roof on until Team 3 finishes sawing! Team 3 is on the &quot;Critical Path&quot;—if they slow down by even 1 day, the whole treehouse is late. But Team 1 has 2 days of &quot;Float&quot; to eat popsicles without slowing anyone down!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CpmAnalysisVisualizer;
