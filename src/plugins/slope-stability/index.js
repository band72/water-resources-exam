import Component from './SlopeVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'slope-stability',
  type: 'tool',
  title: 'Planar Slope Stability',
  category: 'Soil Mechanics & Foundations',
  componentName: 'SlopeVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 98,
      title: 'Planar Slope Stability',
      badge: 'Limit Equilibrium',
      icon: '⛰️',
      color: 'var(--accent-emerald)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'FS = T_FF / T_MOB = (c·Ls + W·cosα·tanφ) / (W·sinα)',
      description: 'Mohr-Coulomb shear resistance vs. mobilized gravity shear force along an assumed planar slip surface.'
    }
  ],
  problems
};

export default plugin;
