import React from 'react';

const SoilVisualizer = () => {
  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 className="text-gradient mb-4" style={{ fontSize: '1.5rem' }}>Geotechnical Profile</h3>
        
        <div style={{ width: '80%', maxWidth: '400px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border-color)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
          {/* Topsoil */}
          <div style={{ height: '40px', background: '#4d2c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', borderBottom: '2px dashed rgba(255,255,255,0.2)' }}>
            Organic Topsoil
          </div>
          {/* Clay/Silt */}
          <div style={{ height: '70px', background: '#785b3a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', borderBottom: '2px dashed rgba(255,255,255,0.2)' }}>
            Silty Clay (Low Permeability)
          </div>
          {/* Sand */}
          <div style={{ height: '60px', background: '#a68a56', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.5)', borderBottom: '2px dashed rgba(0,0,0,0.1)' }}>
            Dense Sand (Aquifer)
          </div>
          {/* Bedrock */}
          <div style={{ height: '50px', background: '#5e636b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.8)' }}>
            Weathered Bedrock
          </div>
        </div>
        
        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>* Thematic representation of soil strata and foundation conditions</p>
      </div>
    </div>
  );
};
export default SoilVisualizer;
