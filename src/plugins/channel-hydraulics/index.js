import Component from './ChannelHydraulicsVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'channel-hydraulics',
  type: 'tool',
  title: 'Channel Hydraulics & Hydraulic Jump Simulator',
  category: 'Hydraulics & Hydrology',
  componentName: 'ChannelHydraulicsVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 108,
      title: 'Channel Hydraulics Simulator',
      badge: 'Manning · Froude · Jump',
      icon: '🌊',
      color: 'var(--accent-blue)',
      bgGlow: 'rgba(59, 130, 246, 0.12)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      formula: 'Q = (1.49/n)·A·R^(2/3)·S₀^(1/2)  |  Fr = V/√(g·Dh)  |  y₂ = y₁/2·(-1+√(1+8Fr₁²))',
      description: 'Interactive open channel design: normal depth (Manning\'s iteration), critical depth, Froude number, hydraulic jump conjugate depth & energy dissipation. Rectangular, trapezoidal, and triangular cross-sections.'
    }
  ],
  problems
};

export default plugin;
