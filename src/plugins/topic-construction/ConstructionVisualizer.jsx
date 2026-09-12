import React from 'react';

const ConstructionVisualizer = () => {
  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '250px' }}>
        <h3 className="text-gradient mb-4" style={{ fontSize: '1.5rem' }}>Means, Methods & Planning</h3>
        
        {/* Simple Crane Graphic */}
        <div style={{ position: 'relative', width: '200px', height: '160px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Crane Tower */}
          <div style={{ width: '20px', height: '150px', background: '#f59e0b', border: '2px solid #b45309' }}></div>
          {/* Crane Jib (Arm) */}
          <div style={{ position: 'absolute', top: '10px', left: '40px', width: '150px', height: '15px', background: '#f59e0b', border: '2px solid #b45309', transformOrigin: 'left center', transform: 'rotate(-10deg)' }}></div>
          {/* Crane Cable */}
          <div style={{ position: 'absolute', top: '0', right: '0px', width: '2px', height: '80px', background: '#94a3b8' }}></div>
          {/* Load */}
          <div style={{ position: 'absolute', bottom: '80px', right: '-15px', width: '30px', height: '30px', background: 'var(--accent-indigo)', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}></div>
          {/* Base */}
          <div style={{ position: 'absolute', bottom: '0', width: '80px', height: '15px', background: '#475569', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}></div>
        </div>
        
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>* Thematic representation of construction operations and scheduling</p>
      </div>
    </div>
  );
};
export default ConstructionVisualizer;
