import React from 'react';

const WaterVisualizer = () => {
  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 className="text-gradient mb-4" style={{ fontSize: '1.5rem' }}>Hydraulics & Flow</h3>
        
        {/* Pipe Flow Graphic */}
        <div style={{ width: '80%', maxWidth: '350px', height: '100px', border: '4px solid #64748b', borderRadius: '50px', overflow: 'hidden', position: 'relative', background: '#1e293b', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.5), 0 10px 15px -3px rgba(0,0,0,0.3)' }}>
          {/* Water level */}
          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '60%', background: 'linear-gradient(90deg, #0ea5e9, #3b82f6)', opacity: 0.8 }}></div>
          
          {/* Flow Arrows */}
          <div style={{ position: 'absolute', top: '50%', left: '25%', display: 'flex', gap: '40px', transform: 'translateY(-50%)' }}>
             <div style={{ width: '0', height: '0', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '20px solid rgba(255,255,255,0.8)' }}></div>
             <div style={{ width: '0', height: '0', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '20px solid rgba(255,255,255,0.8)' }}></div>
             <div style={{ width: '0', height: '0', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '20px solid rgba(255,255,255,0.8)' }}></div>
          </div>
        </div>
        
        <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>* Thematic representation of fluid mechanics and hydrology</p>
      </div>
    </div>
  );
};
export default WaterVisualizer;
