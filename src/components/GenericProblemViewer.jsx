import React, { useState } from 'react';

const GenericProblemViewer = ({ problem }) => {
  const [showSolution, setShowSolution] = useState(false);
  const [userNotes, setUserNotes] = useState('');

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', borderLeft: '4px solid var(--accent-indigo)' }}>
        <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>Problem Analysis & Scratchpad</h3>
        
        <div className="control-group mt-4">
          <label className="mb-2" style={{ display: 'block', color: 'var(--accent-cyan)' }}>Engineering Notes</label>
          <textarea 
            style={{ 
              width: '100%',
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              color: 'var(--text-main)', 
              padding: '1rem', 
              minHeight: '150px',
              fontFamily: 'monospace',
              fontSize: '1rem'
            }}
            placeholder="Work out your equations here... (e.g. Area = L * W)"
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button 
            className="solution-btn" 
            style={{ flex: 1, background: showSolution ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)' }}
            onClick={() => setShowSolution(!showSolution)}
          >
            {showSolution ? 'Hide Solution Guidance' : 'Request Solution Guidance'}
          </button>
        </div>
      </div>

      {showSolution && (
        <div className="animate-float" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Hint Section */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-blue)', background: 'rgba(56, 189, 248, 0.05)' }}>
            <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💡 Engineering Hint
            </h4>
            <p className="m-0" style={{ lineHeight: '1.5' }}>
              {problem.hint || "Identify the core variables and check the NCEES Reference Handbook for the governing equation. Make sure to double-check unit conversions (e.g., inches to feet) before calculating."}
            </p>
          </div>

          {/* Shortcut Section */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-green)', background: 'rgba(16, 185, 129, 0.05)' }}>
            <h4 style={{ color: 'var(--accent-green)', marginBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ⚡ Exam Shortcut
            </h4>
            <p className="m-0" style={{ lineHeight: '1.5' }}>
              {problem.shortcut || "Look at the multiple-choice answers first! Sometimes you can eliminate two answers immediately just by checking if the expected value should be overwhelmingly large or small based on the magnitude of the inputs."}
            </p>
          </div>

          {/* Fifth Grader Section */}
          <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-purple)', background: 'rgba(168, 85, 247, 0.05)' }}>
            <h4 style={{ color: 'var(--accent-purple)', marginBottom: '0.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👦 5th Grader Explanation
            </h4>
            <p className="m-0" style={{ lineHeight: '1.5' }}>
              {problem.fifthGrader || "Imagine you have a big bucket of water. If you poke a hole in the bottom, the water shoots out fast! This problem is just asking us to measure how fast the water shoots out, or how much the bucket weighs before it breaks. We just use math instead of a real bucket!"}
            </p>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default GenericProblemViewer;
