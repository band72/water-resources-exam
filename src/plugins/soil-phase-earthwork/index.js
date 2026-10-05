import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./SoilPhaseEarthworkVisualizer.jsx'));

const plugin = {
  id: 'soil-phase-earthwork',
  type: 'tool',
  title: 'Soil Phase Relations & Earthwork Compaction Converter',
  category: 'Soil Mechanics & Foundations',
  componentName: 'SoilPhaseEarthworkVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'soil-phase-lab',
      label: 'Soil Phase Lab',
      icon: '🪨',
      color: 'var(--accent-amber, #f59e0b)',
      tint: '245, 158, 11',
      title: '3-Phase Soil Diagram, Void Ratio & Earthwork Swell/Compaction Lab',
      target: 207,
      activeFor: [207, 208],
      order: 28
    }
  ],
  crossLinks: [
    {
      id: 'soil-phase-studio',
      showFor: [207, 208],
      icon: '⛰️',
      color: 'var(--accent-amber)',
      tint: '245, 158, 11',
      title: 'Geotechnical Soil Mechanics & Earthwork Compaction Studio',
      subtitle: 'Switch between 3-phase soil weight-volume relationships (void ratio, porosity, saturation, densities) and earthwork cut/fill volume bulkage conversions (BCY, LCY, CCY, haul truck cycles).',
      links: [
        { label: '3-Phase Soil Diagram (#207)', target: 207, color: 'var(--accent-amber)', tint: '245, 158, 11', solid: true },
        { label: 'Earthwork Bulkage (#208) →', target: 208, color: 'var(--accent-emerald)', tint: '16, 185, 129' }
      ]
    }
  ],
  toolCards: [
    {
      id: 207,
      title: 'Soil 3-Phase Relations & Void Ratio Calculator',
      badge: 'Geotechnical / Phase Diagrams',
      icon: '🪨',
      color: 'var(--accent-amber, #f59e0b)',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      formula: 'e = Vv / Vs  |  n = e / (1+e)  |  S = (w·Gs) / e  |  γd = Ws / V',
      description: 'Interactive proportional 3-phase soil block with live weight-volume conversions: moisture content, void ratio, degree of saturation, dry unit weight, and buoyant densities.'
    },
    {
      id: 208,
      title: 'Earthwork Cut/Fill & Haul Cycle Estimator',
      badge: 'Earthwork / Swell & Shrink',
      icon: '🚜',
      color: 'var(--accent-emerald, #10b981)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'BCY = CCY·(γ_compact / γ_bank)  |  LCY = BCY·(1+Sw)  |  Trips = LCY / Cap',
      description: 'Conservation-of-mass earthwork volume conversion between Bank (BCY), Loose (LCY), and Compacted (CCY), dump truck haul cycles, and compaction water truck gallon requirements.'
    }
  ],
  problems
};

export default plugin;
