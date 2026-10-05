import { lazy } from 'react';
import problems from './problems.json';

const Component = lazy(() => import('./TraverseCogoVisualizer.jsx'));

const plugin = {
  id: 'traverse-cogo',
  type: 'tool',
  title: 'Traverse Closure & Bowditch Compass Rule Studio',
  category: 'General Engineering',
  componentName: 'TraverseCogoVisualizer',
  component: Component,
  embedsGenericViewer: false,
  headerLinks: [
    {
      id: 'traverse-cogo-lab',
      label: 'Traverse COGO Lab',
      icon: '📐',
      color: 'var(--accent-emerald, #10b981)',
      tint: '16, 185, 129',
      title: 'Traverse Closure, Bowditch Compass Rule & Boundary Parcel Area Lab',
      target: 211,
      activeFor: [211],
      order: 36
    }
  ],
  crossLinks: [
    {
      id: 'traverse-cogo-studio',
      showFor: [211],
      icon: '📐',
      color: 'var(--accent-emerald)',
      tint: '16, 185, 129',
      title: 'Boundary Surveying & Coordinate Geometry (COGO) Studio',
      subtitle: 'Balance multi-sided boundary traverses using the Bowditch Compass Rule, calculate precision ratios, and compute exact parcel area in square feet and acres.',
      links: [
        { label: 'Traverse Balancing (#211)', target: 211, color: 'var(--accent-emerald)', tint: '16, 185, 129', solid: true }
      ]
    }
  ],
  toolCards: [
    {
      id: 211,
      title: 'Traverse Closure & Bowditch Compass Rule',
      badge: 'Surveying / COGO & Area',
      icon: '📐',
      color: 'var(--accent-emerald, #10b981)',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      formula: 'C_lat = -ΣLat·(L/P)  |  E_L = √(ΔLat² + ΔDep²)  |  Area Shoelace',
      description: 'Closed boundary traverse balancer with raw latitudes/departures, Bowditch error distribution, linear misclosure vector, precision ratio specification check, and coordinate shoelace parcel acreage.'
    }
  ],
  problems
};

export default plugin;
