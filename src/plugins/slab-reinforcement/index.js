import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./SlabReinforcementVisualizer.jsx'));

const plugin = {
  id: 'slab-reinforcement',
  type: 'tool',
  title: 'Concrete Slab Shear & Punching Design',
  category: 'Structural Mechanics',
  componentName: 'SlabReinforcementVisualizer',
  component: Component,
  embedsGenericViewer: true,
  headerLinks: [
    {
      id: 'slab-shear-lab',
      label: 'Slab Shear Lab',
      icon: '🧱',
      color: 'var(--accent-amber, #f59e0b)',
      tint: '245, 158, 11',
      title: 'Concrete Slab Shear & Punching Reinforcement Lab',
      target: 190,
      activeFor: [190, 191],
      order: 20
    }
  ],
  crossLinks: [
    {
      id: 'slab-from-helical',
      showFor: [189],
      icon: '🧱',
      color: 'var(--accent-amber, #f59e0b)',
      tint: '245, 158, 11',
      title: 'Concrete Slab Shear & Punching Reinforcement Lab',
      subtitle: 'Configure ASTM iron rebar diameter & spacing to prevent one-way shear cracking and punching shear around pile caps.',
      links: [
        { label: 'One-Way Shear (#190) →', target: 190, color: 'var(--accent-amber, #f59e0b)', tint: '245, 158, 11', solid: true },
        { label: 'Punching Shear (#191) →', target: 191, color: 'var(--accent-cyan)', tint: '6, 182, 212', solid: true }
      ]
    }
  ],
  toolCards: [
    {
      id: 190,
      title: "50'×50' Slab One-Way Shear Cracking & Rebar",
      badge: "One-Way Shear / ACI 318",
      icon: "🧱",
      color: "var(--accent-amber, #f59e0b)",
      bgGlow: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      formula: "Vu ≤ φ(Vc + Vs), Vc = 2λ√f'c bw d",
      description: "Interactive one-way beam-action shear cracking analysis under house superstructure + live surcharge loads. Real-time ASTM rebar sizing (#3-#10), on-center spacing, slab thickness, and diagonal tension crack visualization."
    },
    {
      id: 191,
      title: "50'×50' Slab Two-Way Punching Shear & Pile Cap",
      badge: "Punching Shear / Helical Piles",
      icon: "📐",
      color: "var(--accent-cyan, #06b6d4)",
      bgGlow: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      formula: "b0 = 4(c + d), vc = 4λ√f'c, Vu ≤ φVn",
      description: "Two-way punching shear analysis around concentrated helical pile head reactions. Dynamic critical perimeter b0 at d/2, shear stud reinforcement rails, pile cap size adjustment, and 3D truncated cone failure simulation."
    }
  ],
  problems
};

export default plugin;
