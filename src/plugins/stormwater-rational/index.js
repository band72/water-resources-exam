import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./StormwaterVisualizer.jsx'));

const plugin = {
  id: 'stormwater-rational',
  type: 'tool',
  title: 'Stormwater Runoff & Detention Basin Designer',
  category: 'Hydraulics & Hydrology',
  componentName: 'StormwaterVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'stormwater-lab',
      label: 'Stormwater Lab',
      icon: '🌧️',
      color: 'var(--accent-blue, #38bdf8)',
      tint: '56, 189, 248',
      title: 'Rational Method Runoff, Pipe Sizing & Detention Basin Sizing',
      target: 205,
      activeFor: [205, 206],
      order: 22
    }
  ],
  crossLinks: [
    {
      id: 'stormwater-studio',
      showFor: [205, 206],
      icon: '🌊',
      color: 'var(--accent-blue)',
      tint: '56, 189, 248',
      title: 'Site Stormwater & Drainage Engineering Studio',
      subtitle: 'Switch between Rational Method peak discharge Q = C·I·A with Manning full-pipe sizing and Modified Rational detention basin storage routing.',
      links: [
        { label: 'Rational Runoff & Pipe (#205)', target: 205, color: 'var(--accent-blue)', tint: '56, 189, 248', solid: true },
        { label: 'Detention Basin Routing (#206) →', target: 206, color: 'var(--accent-cyan)', tint: '6, 182, 212' }
      ]
    }
  ],
  toolCards: [
    {
      id: 205,
      title: 'Rational Stormwater Runoff & Pipe Sizer',
      badge: 'Hydrology / Q = C·I·A',
      icon: '🌧️',
      color: 'var(--accent-blue, #38bdf8)',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.3)',
      formula: 'Q = C·I·A  |  tc Kirpich  |  D = [(2.16·Q·n)/S^(½)]^(⅜)',
      description: 'Site runoff calculator with multi-surface composite C weighting, Kirpich overland flow time of concentration, IDF curves, and Manning circular concrete storm sewer sizing.'
    },
    {
      id: 206,
      title: 'Detention Basin Storage & Hydrograph Sizer',
      badge: 'Stormwater / Flood Routing',
      icon: '🏊',
      color: 'var(--accent-cyan, #06b6d4)',
      bgGlow: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      formula: 'V_req = (Q_in - Q_allow) · td · 60  |  Q = Cd·Ao·√(2gH)',
      description: 'Modified Rational method triangular flood hydrograph routing, peak attenuation storage volume (Acre-Feet / Cubic Yards), pond footprint area, and bottom orifice sizing.'
    }
  ],
  problems
};

export default plugin;
