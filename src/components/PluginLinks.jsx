/**
 * Plugin-driven navigation UI.
 * Header quick-launch buttons and "related lab" banners are declared by each plugin
 * (headerLinks / crossLinks in src/plugins/<name>/index.js), so App.jsx stays generic.
 */
import { pluginRegistry } from '../plugins/registry';

const BTN = { padding: '0.45rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 };

/** Quick-launch buttons rendered in the app header */
export const PluginHeaderLinks = ({ activeProblemId, onSelectProblem }) => (
  <>
    {pluginRegistry.getHeaderLinks().map((link) => {
      const active = activeProblemId != null && (link.activeFor || [link.target]).includes(activeProblemId);
      return (
        <button
          key={`${link.pluginId}-${link.id}`}
          id={`header-link-${link.id}`}
          className="btn-secondary"
          style={{
            ...BTN,
            background: `rgba(${link.tint}, ${active ? 0.25 : 0.08})`,
            borderColor: active ? link.color : `rgba(${link.tint}, 0.3)`,
            color: link.color,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
          onClick={() => onSelectProblem(link.target)}
          title={link.title}
        >
          <span>{link.icon}</span> {link.label}
        </button>
      );
    })}
  </>
);

/** "Related lab" banners for the current problem */
export const PluginCrossLinks = ({ problemId, onSelectProblem }) => {
  const banners = pluginRegistry.getCrossLinksFor(problemId);
  if (!banners.length) return null;

  return (
    <>
      {banners.map((b) => (
        <div
          key={`${b.pluginId}-${b.id}`}
          id={`crosslink-${b.id}`}
          style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1.15rem',
            borderRadius: '10px',
            background: `rgba(${b.tint}, 0.1)`,
            border: `1px solid rgba(${b.tint}, 0.3)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.25rem' }}>{b.icon}</span>
            <div>
              <strong style={{ color: b.color, fontSize: '0.9rem', display: 'block' }}>{b.title}</strong>
              {b.subtitle && <span className="text-xs text-muted">{b.subtitle}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(b.links || []).map((l) => {
              const current = l.target === problemId;
              return (
                <button
                  key={l.target}
                  className="btn-secondary"
                  style={{
                    ...BTN,
                    background: l.solid || current ? `rgba(${l.tint}, ${current ? 0.25 : 0.2})` : 'rgba(255, 255, 255, 0.05)',
                    borderColor: l.color,
                    color: l.color,
                    whiteSpace: 'nowrap'
                  }}
                  onClick={() => onSelectProblem(l.target)}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};
