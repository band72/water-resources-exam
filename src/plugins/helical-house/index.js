import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./HelicalHouseVisualizer.jsx'));

const plugin = {
  id: 'helical-house',
  type: 'tool',
  title: "50'×50' House Slab & Helical Pile Design",
  category: 'Soil Mechanics & Foundations',
  componentName: 'HelicalHouseVisualizer',
  component: Component,
  embedsGenericViewer: true,
  headerLinks: [
    {
      id: 'helical-lab',
      label: '50×50 Helical Pile Lab',
      icon: '🧮',
      color: 'var(--accent-emerald)',
      tint: '16, 185, 129',
      title: "50'×50' House Slab & Helical Pile Interactive Calculator",
      target: 189,
      activeFor: [189],
      order: 10
    }
  ],
  crossLinks: [
    {
      id: 'helical-from-slab',
      showFor: [190, 191],
      icon: '🏗️',
      color: 'var(--accent-emerald)',
      tint: '16, 185, 129',
      title: '50×50 Foundation Deep Helical Pile Lab',
      subtitle: 'Simulate effective overburden soil stress, groundwater pore pressures, and helical bearing plate capacity.',
      links: [{ label: 'Helical Pile Lab (#189) →', target: 189, color: 'var(--accent-emerald)', tint: '16, 185, 129', solid: true }]
    },
    {
      id: 'helical-from-soil',
      showFor: [11, 54],
      icon: '🧪',
      color: 'var(--accent-emerald)',
      tint: '16, 185, 129',
      title: 'Interactive House Load & Helical Pile Lab Available',
      subtitle: 'Simulate effective overburden stress, pore water pressure, and helical foundation safety factor sizing.',
      links: [{ label: 'Launch House Load Lab →', target: 189, color: 'var(--accent-emerald)', tint: '16, 185, 129', solid: true }]
    }
  ],
  toolCards: [
    {
      id: 189,
      title: "50'×50' Slab & Helical Pile Design",
      badge: "Deep Foundations / Geotech",
      icon: "🏗️",
      color: "var(--accent-emerald)",
      bgGlow: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      formula: "Qult = Ah · qult(boring) · SF = Qult / Qallow",
      description: "50×50 ft house slab load modeling, direct geotechnical soil boring report integration (qult), hydrostatic pore pressure, and 4-tier Safety Factor comparison matrix (SF = 1.0, 1.5, 2.0, 3.0)."
    }
  ],
  problems
};

export default plugin;
