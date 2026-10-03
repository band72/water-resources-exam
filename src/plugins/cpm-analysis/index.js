import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./CpmAnalysisVisualizer.jsx'));

const plugin = {
  id: 'cpm-analysis',
  type: 'tool',
  title: 'CPM Network Analysis & Scheduling Studio',
  category: 'Construction & Project Management',
  componentName: 'CpmAnalysisVisualizer',
  component: Component,
  embedsGenericViewer: false,

  // Quick-launch button in the app header
  headerLinks: [
    {
      id: 'cpm-analysis-lab',
      label: 'CPM Network Lab',
      icon: '⏱️',
      color: 'var(--accent-indigo, #818cf8)',
      tint: '99, 102, 241',
      title: 'Activity-on-Node (AON) CPM Forward/Backward Pass & Float Simulator',
      target: 197,
      activeFor: [197],
      order: 38
    }
  ],

  // Related lab banner beneath problem statements
  crossLinks: [
    {
      id: 'cpm-analysis-studio',
      showFor: [197],
      icon: '⏱️',
      color: 'var(--accent-indigo, #818cf8)',
      tint: '99, 102, 241',
      title: 'Critical Path Method (CPM) Network Analysis Studio',
      subtitle: 'Practice Activity-on-Node (AON) forward/backward passes with interactive textboxes, duration sliders, and critical path highlights.',
      links: [
        { label: 'CPM Network (#197)', target: 197, color: 'var(--accent-indigo, #818cf8)', tint: '99, 102, 241', solid: true }
      ]
    }
  ],

  toolCards: [
    {
      id: 197,
      title: 'Critical Path Method (CPM) Network Analysis',
      badge: 'Project Scheduling / AON',
      icon: '⏱️',
      color: 'var(--accent-indigo, #818cf8)',
      bgGlow: 'rgba(99, 102, 241, 0.12)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      formula: 'ES = max(EF_preds), LF = min(LS_succs), TF = LS − ES = LF − EF',
      description: 'Interactive Activity-on-Node (AON) 6-box network diagram simulator with practice textboxes for students to compute Early Start (ES), Early Finish (EF), Late Start (LS), Late Finish (LF), and Total Float (TF), plus dynamic duration sliders for sensitivity analysis.'
    }
  ],
  problems
};

export default plugin;
