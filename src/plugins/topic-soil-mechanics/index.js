import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./SoilVisualizer.jsx'));

const plugin = {
  id: 'topic-soil-mechanics',
  type: 'topic',
  title: "Soil Mechanics & Foundations",
  category: "Soil Mechanics & Foundations",
  componentName: 'SoilVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
