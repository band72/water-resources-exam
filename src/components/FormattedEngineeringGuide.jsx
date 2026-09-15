/**
 * FormattedEngineeringGuide
 * Transforms engineering hints, exam shortcuts, and intuition explanations
 * into beautifully structured, modern step cards with equation highlights.
 */
const FormattedEngineeringGuide = ({ text }) => {
  if (!text) return null;

  // Normalize text symbols and line breaks
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/->/g, '→')
    .trim();

  // Function to detect and parse numbered steps
  const parseSteps = (raw) => {
    // Check if text has numbered items like "1. ", "2. ", or "Step 1:"
    // Supports both multiline ("\n1. ") and inline ("... 2. Compute...")
    const stepRegex = /(?:^|\n|(?<=[.!?])\s+)(?:Step\s+)?(\d+)[.):]\s+/gi;
    const matches = [...raw.matchAll(stepRegex)];

    if (matches.length >= 2 || (matches.length === 1 && matches[0][1] === '1' && raw.includes('='))) {
      const parsedSteps = [];
      for (let i = 0; i < matches.length; i++) {
        const num = matches[i][1];
        const startIndex = matches[i].index + matches[i][0].length;
        const endIndex = i + 1 < matches.length ? matches[i + 1].index : raw.length;
        const content = raw.substring(startIndex, endIndex).trim();
        parsedSteps.push({ num, content });
      }
      return parsedSteps;
    }
    return null;
  };

  const steps = parseSteps(normalized);

  // Render structured numbered steps
  if (steps && steps.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
        {steps.map((step, idx) => {
          const isFinal = idx === steps.length - 1 || /FS\s*=|safety|factor/i.test(step.content);
          
          // Separate narrative text from calculation/math lines
          const rawLines = step.content.split('\n').map(l => l.trim()).filter(Boolean);
          
          const proseLines = [];
          const mathLines = [];

          rawLines.forEach((line) => {
            // Check if line is an equation or bulleted calculation
            const isMath = /^(W\d|Σ|Ka|Pa|MOT|FS|MR\d|arm|Area|Volume|Slope|Drawdown|Pounds|Total|Annual|Book|•|-|\d+\s*[*×])/.test(line) ||
                           (line.includes('=') && !line.startsWith('Divide') && !line.startsWith('Sum') && !line.startsWith('Calculate'));
            
            if (isMath) {
              mathLines.push(line);
            } else {
              proseLines.push(line);
            }
          });

          return (
            <div 
              key={step.num}
              className={`guide-step-card ${isFinal ? 'final-step' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="guide-step-badge">
                  {isFinal ? 'FINAL RESULT' : `STEP ${step.num.padStart(2, '0')}`}
                </span>

                {proseLines.length > 0 && (
                  <div style={{ flex: 1, minWidth: '240px', fontSize: '0.95rem', lineHeight: '1.65', color: '#f1f5f9' }}>
                    {proseLines.map((p, pIdx) => (
                      <p key={pIdx} style={{ margin: pIdx > 0 ? '0.35rem 0 0 0' : 0 }}>
                        {p}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Monospace Math / Formula Callout */}
              {mathLines.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: proseLines.length ? '0.25rem' : '0' }}>
                  {mathLines.map((m, mIdx) => (
                    <div key={mIdx} className="guide-math-line">
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Render general narrative paragraphs (for Exam Shortcut, Intuition, etc.)
  const paragraphs = normalized
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
      {paragraphs.map((para, idx) => {
        // Warning or Distractor Trap Callout
        if (para.includes('⚠️') || /trap|warning|caution/i.test(para.substring(0, 30))) {
          return (
            <div key={idx} className="guide-alert-box">
              {para}
            </div>
          );
        }

        // Check if paragraph contains bullet points
        const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
        const hasBullets = lines.some(l => l.startsWith('•') || l.startsWith('- ') || l.startsWith('* '));

        if (hasBullets) {
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {lines.map((line, lIdx) => {
                const isBullet = line.startsWith('•') || line.startsWith('- ') || line.startsWith('* ');
                const cleanLine = isBullet ? line.replace(/^[•\-*]\s*/, '') : line;
                
                return (
                  <div 
                    key={lIdx}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: isBullet ? '0.6rem' : '0',
                      fontSize: '0.95rem',
                      lineHeight: '1.65',
                      color: isBullet ? '#f1f5f9' : '#e2e8f0',
                      background: isBullet ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
                      padding: isBullet ? '0.5rem 0.85rem' : '0',
                      borderRadius: isBullet ? '8px' : '0',
                      border: isBullet ? '1px solid rgba(56, 189, 248, 0.12)' : 'none'
                    }}
                  >
                    {isBullet && (
                      <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>•</span>
                    )}
                    <span style={{ flex: 1 }}>{cleanLine}</span>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <p key={idx} style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#e2e8f0', margin: 0 }}>
            {para}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedEngineeringGuide;
