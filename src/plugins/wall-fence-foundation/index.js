import Component from './WallFenceFoundationVisualizer.jsx';
import problems from './problems.json';

const plugin = {
  id: 'wall-fence-foundation',
  type: 'tool',
  title: 'Wall / Fence & Helical Pile Foundation Designer',
  category: 'Soil Mechanics & Foundations',
  componentName: 'WallFenceFoundationVisualizer',
  component: Component,
  embedsGenericViewer: true,
  toolCards: [
    {
      id: 200,
      title: 'Wall/Fence Helical Pile Designer',
      badge: 'Concrete · Wood · FRP',
      icon: '🧱',
      color: 'var(--accent-emerald)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: "Ka=(1-sinφ)/(1+sinφ)  |  Qult=Ahelix·(c·Nc+σ'v·Nq)  |  FS: 1.5 / 2.0 / 3.0",
      description: 'Parametric concrete, wood, or fiberglass wall/fence with Rankine active pressure, pore water pressure, surcharge, and a helical pile foundation (varying diameter, 1-3 piles per support) sized to sliding, overturning, and pile bearing/pullout safety factors.'
    }
  ],
  problems
};

export default plugin;
