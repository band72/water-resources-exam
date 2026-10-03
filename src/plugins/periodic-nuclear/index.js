import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./PeriodicNuclearVisualizer.jsx'));

const plugin = {
  id: 'periodic-nuclear',
  type: 'tool',
  title: 'Periodic Table & Nuclear Studio',
  category: 'Water & Wastewater Systems',
  componentName: 'PeriodicNuclearVisualizer',
  component: Component,
  embedsGenericViewer: false,

  // Quick-launch button in the app header
  headerLinks: [
    {
      id: 'periodic-table',
      label: 'Periodic Table',
      icon: '⚛️',
      color: 'var(--accent-purple, #a855f7)',
      tint: '168, 85, 247',
      title: 'Interactive Periodic Table, Nuclear Radionuclides & Elemental Trends',
      target: 194,
      activeFor: [194],
      order: 50
    }
  ],

  toolCards: [
    {
      id: 194,
      title: 'Interactive Periodic Table & Nuclear Radionuclides',
      badge: 'Nuclear Engineering / Periodic Trends',
      icon: '⚛️',
      color: '#a855f7',
      bgGlow: 'rgba(168, 85, 247, 0.12)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      formula: 'N(t) = N_0 · e^(-λt), Q-value MeV, σ resonances (eV)',
      description: 'All 118 elements with 3,200+ IAEA nuclide ground states: decay modes, Q-values, half-lives, decay chains, neutron resonance energies and their applications, plus graphical periodic family trends.'
    }
  ],
  problems
};

export default plugin;
