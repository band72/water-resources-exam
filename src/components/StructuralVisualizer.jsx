import React from 'react';

const StructuralVisualizer = () => {
  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '250px' }}>
        <h3 className="text-gradient mb-4" style={{ fontSize: '1.5rem' }}>Structural Analysis</h3>
        
        {/* Simple I-Beam Graphic */}
        <div style={{ position: 'relative', width: '200px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', height: '20px', background: 'var(--accent-indigo)', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}></div>
          <div style={{ width: '30px', height: '80px', background: 'var(--accent-indigo)', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}></div>
          <div style={{ width: '100%', height: '20px', background: 'var(--accent-indigo)', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}></div>
          
          {/* Load Arrows */}
          <div style={{ position: 'absolute', top: '-30px', display: 'flex', gap: '40px', justifyContent: 'center', width: '100%' }}>
             <div style={{ width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '15px solid #ef4444' }}></div>
             <div style={{ width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '25px solid #ef4444' }}></div>
             <div style={{ width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '15px solid #ef4444' }}></div>
          </div>
        </div>
        
        <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>* Thematic representation of structural loading and mechanics</p>
      </div>
    </div>
  );
};
export default StructuralVisualizer;
