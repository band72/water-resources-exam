import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./HardnessVisualizer.jsx'));

const plugin = {
  id: 'water-hardness',
  type: 'tool',
  title: 'Water Hardness & Chemistry Studio',
  category: 'Water & Wastewater Systems',
  componentName: 'HardnessVisualizer',
  component: Component,
  embedsGenericViewer: true,

  // Quick-launch button in the app header
  headerLinks: [
    {
      id: 'hardness-lab',
      label: '3D Hardness Lab',
      icon: '🧪',
      color: 'var(--accent-blue, #38bdf8)',
      tint: '56, 189, 248',
      title: '3D Water Hardness & 3rd-Grader Softening Lab',
      target: 86,
      activeFor: [86, 87, 88, 89, 90, 91, 92, 93, 94, 95],
      order: 40
    }
  ],

  // "Related lab" banner shown beneath the problem statement
  crossLinks: [
    {
      id: 'hardness-studio',
      showFor: [86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 194],
      icon: '🧪',
      color: 'var(--accent-purple)',
      tint: '168, 85, 247',
      title: 'Water Hardness, Chemistry & Nuclear Radionuclides Studio',
      subtitle: 'Switch between 3D Beaker & 3rd-Grader Hardness (#86), meq Chemistry & Equation Balancer (#87), and Nuclear Periodic Table (#194).',
      links: [
        { label: '3D Hardness (#86)', target: 86, color: 'var(--accent-blue)', tint: '56, 189, 248' },
        { label: 'Meq Balancer (#87)', target: 87, color: 'var(--accent-emerald)', tint: '16, 185, 129' },
        { label: 'Nuclear Periodic (#194) →', target: 194, color: 'var(--accent-purple)', tint: '168, 85, 247' }
      ]
    }
  ],
  toolCards: [
    {
      id: 86,
      title: '3D Water Hardness & 3rd-Grader Molecular Lab',
      badge: 'Water Chemistry / 3D Simulation',
      icon: '🧊',
      color: '#38bdf8',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.3)',
      formula: 'TH = Ca Hardness + Mg Hardness, meq/L × 50.04',
      description: 'Interactive 3D water beaker with floating Ca2+ and Mg2+ mineral magnets, soap scum curd formation, boiling kettle scale precipitation, ion-exchange resin beads, and 3rd-grader intuition guides.'
    },
    {
      id: 87,
      title: 'Meq Converter & Softening Equation Balancer',
      badge: 'Chemistry / Neutrality Balance',
      icon: '⚗️',
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'meq/L = mg/L / EW, Lime: CO_2 + Alk + Mg, Soda: NCH',
      description: 'Cation and anion milliequivalent bar charts, electroneutrality validator, and step-by-step stoichiometric balancing for lime-soda ash water softening precipitation reactions.'
    }
  ],
  problems
};

export default plugin;
