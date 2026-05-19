import React, { useState } from 'react';
import OpenChannelVisualizer from './components/ProblemVisualizer';
import CanalVisualizer from './components/CanalVisualizer';
import EconVisualizer from './components/EconVisualizer';
import EnviroVisualizer from './components/EnviroVisualizer';
import WellVisualizer from './components/WellVisualizer';
import GradingVisualizer from './components/GradingVisualizer';
import EnergyRunoffVisualizer from './components/EnergyRunoffVisualizer';
import GenericProblemViewer from './components/GenericProblemViewer';
import LaborVisualizer from './components/LaborVisualizer';
import HydraulicRamVisualizer from './components/HydraulicRamVisualizer';
import Dashboard from './components/Dashboard';
import problemsData from './data/problems.json';

function App() {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'problem'
  const [activeProblem, setActiveProblem] = useState(1);

  const problems = problemsData;

  const currentProblem = problems.find(p => p.id === activeProblem) || problems[0];

  const handleSelectProblem = (id) => {
    setActiveProblem(id);
    setActiveView('problem');
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem', cursor: 'pointer' }} onClick={() => setActiveView('dashboard')}>Water Resources</h1>
          <p className="text-muted text-sm">Interactive PE Exam Prep</p>
        </div>

        <button 
          className="solution-btn" 
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', background: activeView === 'dashboard' ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)', color: 'white' }}
          onClick={() => setActiveView('dashboard')}
        >
          🏠 Guide Dashboard
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {problems.map((prob) => (
            <div 
              key={prob.id}
              className={`problem-card ${activeView === 'problem' && activeProblem === prob.id ? 'active' : ''}`}
              onClick={() => handleSelectProblem(prob.id)}
            >
              <h4>{prob.title}</h4>
              <p>{prob.description.substring(0, 60)}...</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeView === 'dashboard' ? (
          <Dashboard problems={problems} onSelectProblem={handleSelectProblem} />
        ) : (
          <>
            <header className="glass-panel" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{currentProblem.title}</h2>
              <p style={{ lineHeight: '1.6', fontSize: '1.1rem' }}>{currentProblem.description}</p>
            </header>

            {(() => {
              const VisualizerMap = {
                'ProblemVisualizer': OpenChannelVisualizer,
                'CanalVisualizer': CanalVisualizer,
                'EconVisualizer': EconVisualizer,
                'EnviroVisualizer': EnviroVisualizer,
                'WellVisualizer': WellVisualizer,
                'GradingVisualizer': GradingVisualizer,
                'EnergyRunoffVisualizer': EnergyRunoffVisualizer,
                'LaborVisualizer': LaborVisualizer,
                'HydraulicRamVisualizer': HydraulicRamVisualizer
              };
              
              const ActiveComponent = VisualizerMap[currentProblem.component] || GenericProblemViewer;
              
              return (
                <ActiveComponent 
                  problem={currentProblem} 
                  diameter={currentProblem.diameter}
                  slope={currentProblem.slope}
                  n={currentProblem.n}
                  initialDepth={currentProblem.depth}
                  initialLength={currentProblem.length}
                  initialWaste={currentProblem.waste}
                  initialThickness={currentProblem.thickness}
                  initialBottomWidth={currentProblem.bottomWidth}
                  initialCost={currentProblem.initialCost}
                  initialSalvage={currentProblem.initialSalvage}
                  initialLife={currentProblem.initialLife}
                  initialTargetYear={currentProblem.initialTargetYear}
                />
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
