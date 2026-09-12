import React from 'react';
import GenericProblemViewer from '../components/GenericProblemViewer';

// Eagerly import all plugin definitions
const pluginModules = import.meta.glob('./*/index.js', { eager: true });

// Extract and initialize all plugins
const plugins = Object.values(pluginModules).map((mod) => mod.default || mod);

// Build component and lookup maps
const componentMap = {};
const pluginByComponentMap = {};
const pluginByIdMap = {};
let allProblems = [];
let allSimulatorTools = [];

plugins.forEach((plugin) => {
  if (!plugin) return;
  pluginByIdMap[plugin.id] = plugin;

  if (plugin.componentName && plugin.component) {
    componentMap[plugin.componentName] = plugin.component;
    pluginByComponentMap[plugin.componentName] = plugin;
  }

  if (Array.isArray(plugin.problems)) {
    allProblems.push(...plugin.problems);
  }

  if (Array.isArray(plugin.toolCards)) {
    allSimulatorTools.push(...plugin.toolCards);
  }
});

// Sort all problems by ID
allProblems.sort((a, b) => (a.id || 0) - (b.id || 0));

// Sort simulator tools by ID (or problem id)
allSimulatorTools.sort((a, b) => (a.id || 0) - (b.id || 0));

export const pluginRegistry = {
  plugins,
  getPlugins: () => plugins,
  getPlugin: (id) => pluginByIdMap[id],
  getPluginByComponent: (componentName) => pluginByComponentMap[componentName],
  getComponent: (componentName) => componentMap[componentName],
  getAllProblems: () => allProblems,
  getSimulatorTools: () => allSimulatorTools
};

/**
 * Unified, decoupled Problem Renderer component
 * Replaces hardcoded switch / nested ternaries in App.jsx
 */
export const PluginRenderer = ({ problem }) => {
  if (!problem) return null;

  const plugin = pluginRegistry.getPluginByComponent(problem.component);
  const Component = plugin?.component || pluginRegistry.getComponent(problem.component);

  if (!Component) {
    return <GenericProblemViewer problem={problem} />;
  }

  // If the visualizer already embeds GenericProblemViewer internally (e.g. RetainingWall, OpenChannel)
  if (plugin?.embedsGenericViewer) {
    return <Component problem={problem} {...problem} />;
  }

  // Otherwise, render the dedicated visualizer along with the generic problem viewer
  return (
    <>
      <Component problem={problem} {...problem} />
      <GenericProblemViewer problem={problem} />
    </>
  );
};

export default pluginRegistry;
