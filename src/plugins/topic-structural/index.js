import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./StructuralVisualizer.jsx'));

const plugin = {
  id: 'topic-structural',
  type: 'topic',
  title: "Structural Mechanics",
  category: "Structural Mechanics",
  componentName: 'StructuralVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
