import React, { useState, useEffect } from 'react';
import hydraulicsImg from '../assets/blueprints/hydraulics.png';
import structuralImg from '../assets/blueprints/structural.png';
import environmentalImg from '../assets/blueprints/environmental.png';
import geotechnicalImg from '../assets/blueprints/geotechnical.png';

const GenericProblemViewer = ({ problem }) => {
  const [showSolution, setShowSolution] = useState(false);
  const [userNotes, setUserNotes] = useState('');

  // Load saved notes when the problem changes
  useEffect(() => {
    const savedNotes = localStorage.getItem(`scratchpad_${problem.id}`);
    setUserNotes(savedNotes || '');
    setShowSolution(false); // Reset solution visibility on problem change
  }, [problem.id]);

  // Save notes automatically as the user types
  const handleNotesChange = (e) => {
    const newNotes = e.target.value;
    setUserNotes(newNotes);
    localStorage.setItem(`scratchpad_${problem.id}`, newNotes);
  };

  // Map the correct blueprint visual based on category
  const getBlueprintGraphic = (category = '') => {
    const cat = category.toLowerCase();
    if (cat.includes('hydraulic') || cat.includes('water')) return hydraulicsImg;
    if (cat.includes('soil') || cat.includes('foundation') || cat.includes('site') || cat.includes('geotech') || cat.includes('transportation')) return geotechnicalImg;
    if (cat.includes('enviro') || cat.includes('wastewater')) return environmentalImg;
    return structuralImg; // Default to structural/construction for econ/methods/etc
  };

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ width: '100%', borderLeft: '4px solid var(--accent-indigo)' }}>
        
        {/* Dynamic Graphic Header */}
        <div style={{ width: '100%', height: '200px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem', position: 'relative' }}>
          <img 
            src={getBlueprintGraphic(problem.category)} 
            alt="Engineering Blueprint"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
            <span style={{ background: 'var(--accent-indigo)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {problem.category || 'General Engineering'} Reference
            </span>
          </div>
        </div>

        <h3 className="text-gradient mb-2" style={{ fontSize: '1.5rem' }}>Problem Analysis</h3>
        <p style={{ fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{problem.description}</p>
        
        <div className="control-group mt-4">
          <label className="mb-2" style={{ display: 'block', color: 'var(--accent-cyan)' }}>Engineering Scratchpad (Auto-saved)</label>
          <textarea 
            className="w-full"
            style={{ 
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
            onChange={handleNotesChange}
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
