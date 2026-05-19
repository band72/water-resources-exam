import React from 'react';

const DocumentVisualizer = () => {
  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 className="text-gradient mb-4" style={{ fontSize: '1.5rem' }}>Reference Material</h3>
        
        {/* Stylized Document */}
        <div style={{ width: '150px', height: '200px', background: '#f8fafc', borderRadius: '8px', padding: '20px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px' }}></div>
          <div style={{ width: '80%', height: '8px', background: '#cbd5e1', borderRadius: '4px' }}></div>
          <div style={{ width: '90%', height: '8px', background: '#cbd5e1', borderRadius: '4px' }}></div>
          
          {/* Graph/Chart abstract */}
          <div style={{ marginTop: '10px', width: '100%', height: '60px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #93c5fd', borderRadius: '4px', display: 'flex', alignItems: 'flex-end', padding: '5px', gap: '5px' }}>
            <div style={{ flex: 1, height: '40%', background: '#60a5fa', borderRadius: '2px' }}></div>
            <div style={{ flex: 1, height: '70%', background: '#3b82f6', borderRadius: '2px' }}></div>
            <div style={{ flex: 1, height: '50%', background: '#2563eb', borderRadius: '2px' }}></div>
          </div>
          
          <div style={{ width: '100%', height: '8px', background: '#cbd5e1', borderRadius: '4px', marginTop: 'auto' }}></div>
        </div>
        
        <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>* General PE Exam topic or theoretical concept</p>
      </div>
    </div>
  );
};
export default DocumentVisualizer;
