import Component from './WoodRetainingWallVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'wood-retaining-wall',
  type: 'tool',
  title: 'Wood Retaining Wall Simulation',
  category: 'Soil Mechanics & Foundations',
  componentName: 'WoodRetainingWallVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 102,
      title: 'Wood Retaining Wall Simulator',
      badge: 'Timber & Geotech',
      icon: '🪵',
      color: 'var(--accent-amber)',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      formula: "D_req = f(H, S1, P) · fb = (M · 12) / Sx ≤ F'b",
      description: 'Parametric wood post (4×4 to 12×12) cantilever retaining wall with dig depth, spacing, surcharge, pore water pressure, and soil stratification.'
    }
  ],
  problems
};

export default plugin;
