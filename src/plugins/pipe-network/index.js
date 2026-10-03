import { lazy } from 'react';
import problems from './problems.json';

// Visualizer is code-split: its bundle loads only when one of this plugin's problems is opened
const Component = lazy(() => import('./PipeNetworkVisualizer.jsx'));

const plugin = {
  id: 'pipe-network',
  type: 'tool',
  title: 'Pipe Network & Conduit Hydraulics Studio',
  category: 'Water Resources & Environmental',
  componentName: 'PipeNetworkVisualizer',
  component: Component,
  embedsGenericViewer: true,
  headerLinks: [
    {
      id: 'pipe-network-lab',
      label: 'Pipe Network Lab',
      icon: '🔄',
      color: 'var(--accent-blue, #38bdf8)',
      tint: '56, 189, 248',
      title: 'Hardy Cross Looped Network & Parallel Pipes Hydraulics Lab',
      target: 192,
      activeFor: [192, 193],
      order: 30
    }
  ],
  crossLinks: [
    {
      id: 'pipe-network-studio',
      showFor: [192, 193],
      icon: '🌊',
      color: 'var(--accent-blue)',
      tint: '56, 189, 248',
      title: 'Closed Conduit & Pipe Distribution Hydraulics Studio',
      subtitle: 'Switch between Hardy Cross loop balancing (Hazen-Williams) and Parallel conduit friction factor & equivalent pipe sizing (Darcy-Weisbach).',
      links: [
        { label: 'Hardy Cross Loop (#192)', target: 192, color: 'var(--accent-blue)', tint: '56, 189, 248' },
        { label: 'Parallel Pipes (#193) →', target: 193, color: 'var(--accent-cyan)', tint: '6, 182, 212' }
      ]
    }
  ],
  toolCards: [
    {
      id: 192,
      title: "Hardy Cross Looped Network (Hazen-Williams)",
      badge: "Pipe Networks / Hardy Cross",
      icon: "🔄",
      color: "var(--accent-blue, #38bdf8)",
      bgGlow: "rgba(56, 189, 248, 0.12)",
      borderColor: "rgba(56, 189, 248, 0.3)",
      formula: "ΔQ = -Σ hf / (n · Σ |hf/Q|), hf = 4.727·L·Q^1.852 / (C^1.852·D^4.87)",
      description: "Interactive municipal looped water distribution network with real-time Hardy Cross iteration stepper, Hazen-Williams head loss, nodal continuity validation, and HGL pressure profiles."
    },
    {
      id: 193,
      title: "Parallel Pipes Friction Factor & Equivalent Sizing",
      badge: "Parallel Conduits / Darcy-Weisbach",
      icon: "⚡",
      color: "var(--accent-cyan, #06b6d4)",
      bgGlow: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      formula: "hf,1 = hf,2, Q1/Q2 = √[(f2·L2·D1⁵) / (f1·L1·D2⁵)], Deq Sizing",
      description: "Parallel conduit flow split simulator with live Darcy-Weisbach friction factor calculations (Swamee-Jain / Colebrook-White), pressure gauges, HGL/EGL drop visualization, and equivalent pipe sizing solver."
    }
  ],
  problems
};

export default plugin;
