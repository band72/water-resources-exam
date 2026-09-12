import Component from './DocumentVisualizer.jsx';
import problems from './problems.json';

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
