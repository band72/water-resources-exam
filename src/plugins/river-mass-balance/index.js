import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./RiverMassBalanceVisualizer.jsx'));

const plugin = {
  id: 'river-mass-balance',
  type: 'tool',
  title: 'River Mass Balance & Positional Effluent Studio',
  category: 'Water Resources & Environmental',
  componentName: 'RiverMassBalanceVisualizer',
  component: Component,
  embedsGenericViewer: false,

  // Quick-launch button in the app header
  headerLinks: [
    {
      id: 'river-mass-balance-lab',
      label: 'River Mass Balance',
      icon: '🌊',
      color: 'var(--accent-blue, #38bdf8)',
      tint: '56, 189, 248',
      title: 'River Mass Balance, Positional Effluent & DO Dilution Studio',
      target: 195,
      activeFor: [195, 196],
      order: 35
    }
  ],

  // Related lab banner beneath problem statements
  crossLinks: [
    {
      id: 'river-mass-balance-studio',
      showFor: [195, 196],
      icon: '🌊',
      color: 'var(--accent-blue)',
      tint: '56, 189, 248',
      title: 'River Mass Balance & Positional Effluent Studio',
      subtitle: 'Simulate river reach dilution, positional effluent outfall placement, 1st-order decay, and dissolved oxygen mixing.',
      links: [
        { label: 'Pollutant Dilution (#195)', target: 195, color: 'var(--accent-blue)', tint: '56, 189, 248' },
        { label: 'Dissolved Oxygen (#196) →', target: 196, color: 'var(--accent-emerald)', tint: '16, 185, 129' }
      ]
    }
  ],

  toolCards: [
    {
      id: 195,
      title: 'River Mass Balance & Positional Effluent Dilution',
      badge: 'River Mixing / NPDES Permitting',
      icon: '🌊',
      color: 'var(--accent-blue, #38bdf8)',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.3)',
      formula: 'Q_r·C_r + Q_e·C_e = Q_mix·C_mix, C(x) = C_mix · e^(-k·t)',
      description: 'Interactive river corridor simulator with draggable positional outfall pipe, Gaussian transverse plume dispersion, longitudinal concentration profile C(x), first-order decay, and maximum allowable NPDES discharge limit solver.'
    },
    {
      id: 196,
      title: 'River Dissolved Oxygen & Thermal Mass Balance',
      badge: 'Water Quality / DO Saturation',
      icon: '🐟',
      color: 'var(--accent-emerald, #10b981)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'Q_e·DO_e + Q_r·DO_r = Q_mix·DO_mix, DO_sat(T)',
      description: 'Stream thermal mixing and dissolved oxygen mass balance calculator using NCEES Civil PE Reference Handbook saturation tables, solving for industrial discharge DO and river oxygen deficit.'
    }
  ],
  problems
};

export default plugin;
