import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./BeamShearMomentVisualizer.jsx'));

const plugin = {
  id: 'beam-shear-moment',
  type: 'tool',
  title: 'Everyday Beam Shear, Moment & Deflection Analyzer',
  category: 'Structural Mechanics',
  componentName: 'BeamShearMomentVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'beam-moment-lab',
      label: 'Beam & SFD Lab',
      icon: '🏗️',
      color: 'var(--accent-cyan, #06b6d4)',
      tint: '6, 182, 212',
      title: 'Beam Shear Force Diagram (SFD), Bending Moment (BMD) & Section Sizing Lab',
      target: 210,
      activeFor: [210],
      order: 35
    }
  ],
  crossLinks: [
    {
      id: 'beam-moment-studio',
      showFor: [210],
      icon: '🏗️',
      color: 'var(--accent-cyan)',
      tint: '6, 182, 212',
      title: 'Structural Mechanics & Everyday Beam Sizing Studio',
      subtitle: 'Analyze simply supported and cantilever beams under point and distributed loads, generate interactive SFD and BMD diagrams, and size standard steel W-shapes or timber joists.',
      links: [
        { label: 'Beam Shear & Moment (#210)', target: 210, color: 'var(--accent-cyan)', tint: '6, 182, 212', solid: true }
      ]
    }
  ],
  toolCards: [
    {
      id: 210,
      title: 'Beam Shear, Moment & Sizing Analyzer',
      badge: 'Structural / SFD & BMD',
      icon: '🏗️',
      color: 'var(--accent-cyan, #06b6d4)',
      bgGlow: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      formula: 'V(x) = R1 - wx - ΣP  |  M(x) = ∫V dx  |  S_req = M_max / F_b',
      description: 'Interactive beam solver for civil breadth engineering: point and uniform loading, live Shear Force Diagram (SFD) & Bending Moment Diagram (BMD) canvas, maximum deflection, and AISC W-shape selection.'
    }
  ],
  problems
};

export default plugin;
