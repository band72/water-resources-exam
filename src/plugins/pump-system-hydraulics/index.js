import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./PumpSystemVisualizer.jsx'));

const plugin = {
  id: 'pump-system-hydraulics',
  type: 'tool',
  title: 'Pump Hydraulics & System Operating Point Studio',
  category: 'Hydraulics & Hydrology',
  componentName: 'PumpSystemVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'pump-system-lab',
      label: 'Pump & TDH Lab',
      icon: '⚡',
      color: 'var(--accent-cyan, #06b6d4)',
      tint: '6, 182, 212',
      title: 'Pump Curve, System Head Curve & NPSH Cavitation Analysis Lab',
      target: 209,
      activeFor: [209],
      order: 32
    }
  ],
  crossLinks: [
    {
      id: 'pump-system-studio',
      showFor: [209],
      icon: '🚰',
      color: 'var(--accent-cyan)',
      tint: '6, 182, 212',
      title: 'Pumping Station Design & Cavitation Verification Studio',
      subtitle: 'Analyze Total Dynamic Head (TDH), pump characteristic curves, operating duty points, motor brake horsepower, and NPSHA vs NPSHR cavitation margin.',
      links: [
        { label: 'Pump Duty Point (#209)', target: 209, color: 'var(--accent-cyan)', tint: '6, 182, 212', solid: true }
      ]
    }
  ],
  toolCards: [
    {
      id: 209,
      title: 'Pump Curve & System Operating Point (TDH & NPSH)',
      badge: 'Pumps & TDH / Cavitation',
      icon: '⚡',
      color: 'var(--accent-cyan, #06b6d4)',
      bgGlow: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      formula: 'H_pump(Q) = H_sys(Q)  |  BHP = (Q·H)/(3960·η)  |  NPSHA > NPSHR',
      description: 'System head curve solver (static lift + Hazen-Williams pipe friction + minor losses) with pump characteristic curve intersection, motor brake horsepower, and NPSH cavitation safety check.'
    }
  ],
  problems
};

export default plugin;
