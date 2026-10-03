import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./DocumentVisualizer.jsx'));

const plugin = {
  id: 'topic-exam-review',
  type: 'topic',
  title: "Exam Review & Engineering Reference",
  category: "General Engineering",
  componentName: 'DocumentVisualizer',
  component: Component,
  embedsGenericViewer: false,
  toolCards: [],
  problems
};

export default plugin;
