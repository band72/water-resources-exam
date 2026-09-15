import GenericProblemViewer from '../components/GenericProblemViewer';
import { pluginRegistry } from './registry';

/**
 * Unified, decoupled Problem Renderer component
 * Replaces hardcoded switch / nested ternaries in App.jsx
 */
export const PluginRenderer = ({ problem }) => {
  if (!problem) return null;

  const plugin = pluginRegistry.getPluginByComponent(problem.component);
  // Component is a stable reference from the module-level plugin registry
  // (built once from import.meta.glob), so it never changes across renders
  // for a given problem.component.
  const Component = plugin?.component || pluginRegistry.getComponent(problem.component);

  if (!Component) {
    return <GenericProblemViewer problem={problem} key={problem.id} />;
  }

  // If the visualizer already embeds GenericProblemViewer internally (e.g. RetainingWall, OpenChannel)
  if (plugin?.embedsGenericViewer) {
    // eslint-disable-next-line react-hooks/static-components
    return <Component problem={problem} {...problem} />;
  }

  // Otherwise, render the dedicated visualizer along with the generic problem viewer
  return (
    <>
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Component problem={problem} {...problem} />
      <GenericProblemViewer problem={problem} key={problem.id} />
    </>
  );
};
