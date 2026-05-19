import React from 'react';

const HardnessVisualizer = ({ cations, anions }) => {
  if (!cations || !anions) return null;

  const totalCations = cations.reduce((sum, c) => sum + c.value, 0);
  const totalAnions = anions.reduce((sum, a) => sum + a.value, 0);
  const maxTotal = Math.max(totalCations, totalAnions) || 1;

  const renderBar = (ions, title) => (
    <div style={{ marginBottom: '2rem' }}>
      <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>{title}</h4>
      <div style={{ 
        display: 'flex', 
        width: '100%', 
        height: '60px', 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
      }}>
        {ions.map((ion, idx) => {
          const widthPct = (ion.value / maxTotal) * 100;
          return (
            <div 
              key={idx} 
              style={{ 
                width: `${widthPct}%`, 
                backgroundColor: ion.color || 'var(--accent-indigo)', 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'center', 
                alignItems: 'center',
                color: 'white',
                fontWeight: 'bold',
                borderRight: idx < ions.length - 1 ? '2px solid rgba(255,255,255,0.2)' : 'none',
                position: 'relative',
                minWidth: widthPct > 5 ? 'auto' : '1px'
              }}
              title={`${ion.name}: ${ion.value} mg/L as CaCO3`}
            >
              {widthPct > 10 && (
                <>
                  <span style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{ion.name}</span>
                  <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{ion.value}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem' }}>
        {ions.map((ion, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: ion.color || 'var(--accent-indigo)', borderRadius: '3px' }}></div>
            <span>{ion.name} ({ion.value})</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', padding: '2rem' }}>
        <h3 className="text-gradient mb-4" style={{ textAlign: 'center', fontSize: '1.5rem' }}>Water Chemistry Profile (mg/L as CaCO₃)</h3>
        {renderBar(cations, "Cations (+)")}
        {renderBar(anions, "Anions (-)")}
        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          * Bar width is proportional to concentration in mg/L as CaCO₃
        </div>
      </div>
    </div>
  );
};

export default HardnessVisualizer;
