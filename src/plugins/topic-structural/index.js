import Component from './StructuralVisualizer.jsx';
import problems from './problems.json';

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
