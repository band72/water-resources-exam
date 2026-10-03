import PeriodicNuclearStudio from './PeriodicNuclearStudio.jsx';

/**
 * Standalone visualizer shell for the Periodic Table & Nuclear Studio.
 * The registry's PluginRenderer appends the GenericProblemViewer below it.
 */
const PeriodicNuclearVisualizer = () => (
  <div style={{
    background: 'var(--bg-card, rgba(15, 23, 42, 0.75))',
    borderRadius: '16px',
    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
    padding: '1.75rem',
    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
    backdropFilter: 'var(--glass-blur, blur(20px))',
    color: 'var(--text-main, #f1f5f9)'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem',
      borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))', paddingBottom: '1.25rem'
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, fontSize: '1.5rem',
        background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>⚛️</div>
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
          Interactive Periodic Table &amp; Nuclear Radionuclide Studio
        </h2>
        <p className="text-xs text-muted" style={{ margin: '0.25rem 0 0 0' }}>
          All 118 elements: click any tile for isotopes, decay modes, Q-values, half-lives, decay chains,
          neutron resonance energies and periodic trends.
        </p>
      </div>
    </div>
    <PeriodicNuclearStudio />
  </div>
);

export default PeriodicNuclearVisualizer;
