import Component from './SPTVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'spt-test',
  type: 'tool',
  title: 'Standard Penetration Test (SPT)',
  category: 'Soil Mechanics & Foundations',
  componentName: 'SPTVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 112,
      title: 'Standard Penetration Test (SPT)',
      badge: 'ASTM D1586 / AASHTO',
      icon: '🔨',
      color: 'var(--accent-cyan)',
      bgGlow: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      formula: 'N60 = N · (ER/60) · CB · CS · CR · (N1)60 = N60 · CN',
      description: 'Split-barrel sampler driving sequence, energy ratio corrections, effective overburden stress normalization, and soil density correlations.'
    }
  ],
  problems
};

export default plugin;
