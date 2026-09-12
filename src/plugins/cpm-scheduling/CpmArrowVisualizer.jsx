import React from 'react';

const CpmArrowVisualizer = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="visualizer-wrapper" style={{ flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-panel" style={{ width: '100%', overflowX: 'auto', padding: '3rem 1rem' }}>
        <h3 className="text-gradient mb-4" style={{ textAlign: 'center', fontSize: '1.5rem' }}>Arrow Way Diagram</h3>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          minWidth: 'max-content', 
          gap: '1rem',
          margin: '0 auto',
          padding: '1rem 2rem'
        }}>
          
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              {/* Arrow and Operation (only if not the first step) */}
              {idx > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px', flex: 1 }}>
                  <span style={{ 
                    fontWeight: 'bold', 
                    color: 'var(--accent-cyan)', 
                    marginBottom: '0.5rem',
                    fontSize: '1.2rem'
                  }}>
                    {step.op}
                  </span>
                  <div style={{ 
                    width: '100%', 
                    height: '4px', 
                    background: 'var(--accent-indigo)', 
                    position: 'relative'
                  }}>
                    {/* Arrowhead */}
                    <div style={{
                      position: 'absolute',
                      right: '-2px',
                      top: '-4px',
                      width: '0',
                      height: '0',
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      borderLeft: '10px solid var(--accent-indigo)'
                    }} />
                  </div>
                </div>
              )}

              {/* Node (Circle) */}
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '50%',
                background: idx === 0 ? 'rgba(239, 68, 68, 0.2)' : (idx === steps.length - 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.1)'),
                border: `3px solid ${idx === 0 ? '#ef4444' : (idx === steps.length - 1 ? '#10b981' : 'var(--accent-indigo)')}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                color: 'white',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                position: 'relative',
                zIndex: 2
              }}>
                {step.val}
              </div>
            </React.Fragment>
          ))}
          
        </div>
      </div>
    </div>
  );
};

export default CpmArrowVisualizer;
