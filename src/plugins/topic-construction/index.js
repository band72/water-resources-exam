import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./ConstructionVisualizer.jsx'));

const plugin = {
  id: 'topic-construction',
  type: 'topic',
  title: "Construction Management",
  category: "Project Planning & Economics",
  componentName: 'ConstructionVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
