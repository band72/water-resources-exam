import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./WaterVisualizer.jsx'));

const plugin = {
  id: 'topic-water-resources',
  type: 'topic',
  title: "Water Resources & Hydraulics",
  category: "Hydraulics & Hydrology",
  componentName: 'WaterVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
