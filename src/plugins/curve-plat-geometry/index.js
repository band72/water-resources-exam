import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./CurvePlatVisualizer.jsx'));

const plugin = {
  id: 'curve-plat-geometry',
  type: 'tool',
  title: 'Roadway & Subdivision Plat Curve Designer',
  category: 'Transportation & Geometrics',
  componentName: 'CurvePlatVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'curve-plat-lab',
      label: 'Curve & Plat Lab',
      icon: '📐',
      color: 'var(--accent-amber, #f59e0b)',
      tint: '245, 158, 11',
      title: 'Subdivision Plat P.I. Angle Bar & Highway Curve Lab (Rule 2 Compliant)',
      target: 203,
      activeFor: [203, 204],
      order: 25
    }
  ],
  crossLinks: [
    {
      id: 'curve-plat-studio',
      showFor: [203, 204],
      icon: '🛣️',
      color: 'var(--accent-amber)',
      tint: '245, 158, 11',
      title: 'Roadway Geometrics & Subdivision Plat Engineering Lab',
      subtitle: 'Switch between Rule 2 subdivision plat corner return curves (P.I. tick glyphs, dynamic T, cutback length, fillet area) and AASHTO highway vertical curves (crest/sag, SSD, K-values).',
      links: [
        { label: 'Plat Corner Return (#203)', target: 203, color: 'var(--accent-amber)', tint: '245, 158, 11', solid: true },
        { label: 'Vertical Curve SSD (#204) →', target: 204, color: 'var(--accent-cyan)', tint: '6, 182, 212' }
      ]
    }
  ],
  toolCards: [
    {
      id: 203,
      title: 'Subdivision Plat Corner Return (Rule 2 P.I. Derivation)',
      badge: 'Plats & COGO / Rule 2',
      icon: '📐',
      color: 'var(--accent-amber, #f59e0b)',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      formula: 'T = R·tan(Δ/2)  |  L_cutback = Stated - T  |  A_fillet = R·T - ½R²Δ',
      description: 'Dynamic surveyor tangent solver for subdivision plat corner returns with P.I. angle bar tick glyphs (┌). Computes deflection Δ from bearings, boundary cut-back to P.C., and net parcel area adjustment.'
    },
    {
      id: 204,
      title: 'Highway Crest & Sag Vertical Curve Designer',
      badge: 'Highway Geometrics / AASHTO',
      icon: '🛣️',
      color: 'var(--accent-cyan, #06b6d4)',
      bgGlow: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
      formula: 'K = L / |g2 - g1|  |  x_turn = -g1·L / (g2 - g1)  |  y(x) Parabola',
      description: 'Highway profile grade transitions with AASHTO stopping sight distance (SSD) verification, crest and sag K-value rating, turning high/low point stationing, and drainage inlet elevation solvers.'
    }
  ],
  problems
};

export default plugin;
