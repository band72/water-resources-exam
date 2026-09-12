import React, { useState, useEffect } from 'react';
import FormattedEngineeringGuide from './FormattedEngineeringGuide';

const GenericProblemViewer = ({ problem }) => {
  const [activeTab, setActiveTab] = useState('hint'); // 'hint' | 'shortcut' | 'intuition' | 'scratchpad'
  const [userNotes, setUserNotes] = useState('');
  const [isMastered, setIsMastered] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);
  const [answerInput, setAnswerInput] = useState('');
  const [checkStatus, setCheckStatus] = useState(null); // 'correct' | 'attempted' | null

  // Load saved state from localStorage for problem persistence
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem(`pe_notes_${problem.id}`);
      if (savedNotes) setUserNotes(savedNotes);

      const masteredList = JSON.parse(localStorage.getItem('pe_mastered_problems') || '[]');
      setIsMastered(masteredList.includes(problem.id));

      const flaggedList = JSON.parse(localStorage.getItem('pe_flagged_problems') || '[]');
      setIsFlagged(flaggedList.includes(problem.id));

      setAnswerInput('');
      setCheckStatus(null);
    } catch (e) {
      console.warn("Storage access issue", e);
    }
  }, [problem.id]);

  // Save notes
  const handleNoteChange = (text) => {
    setUserNotes(text);
    try {
      localStorage.setItem(`pe_notes_${problem.id}`, text);
    } catch (e) {
      // ignore
    }
  };

  // Toggle Mastered
  const toggleMastered = () => {
    try {
      const masteredList = JSON.parse(localStorage.getItem('pe_mastered_problems') || '[]');
      let updated;
      if (masteredList.includes(problem.id)) {
        updated = masteredList.filter(id => id !== problem.id);
        setIsMastered(false);
      } else {
        updated = [...masteredList, problem.id];
        setIsMastered(true);
      }
      localStorage.setItem('pe_mastered_problems', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  // Toggle Flagged
  const toggleFlagged = () => {
    try {
      const flaggedList = JSON.parse(localStorage.getItem('pe_flagged_problems') || '[]');
      let updated;
      if (flaggedList.includes(problem.id)) {
        updated = flaggedList.filter(id => id !== problem.id);
        setIsFlagged(false);
      } else {
        updated = [...flaggedList, problem.id];
        setIsFlagged(true);
      }
      localStorage.setItem('pe_flagged_problems', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const insertSymbol = (sym) => {
    const nextNotes = (userNotes ? userNotes + ' ' : '') + sym;
    handleNoteChange(nextNotes);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
      {/* Practice Toolbar & Mastery Tracker */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={toggleMastered}
            className="btn-secondary"
            style={{ 
              background: isMastered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isMastered ? 'var(--accent-emerald)' : 'var(--border-color)',
              color: isMastered ? 'var(--accent-emerald)' : 'var(--text-main)',
              fontSize: '0.825rem'
            }}
          >
            {isMastered ? '✅ Problem Mastered' : '○ Mark as Mastered'}
          </button>

          <button 
            onClick={toggleFlagged}
            className="btn-secondary"
            style={{ 
              background: isFlagged ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: isFlagged ? 'var(--accent-amber)' : 'var(--border-color)',
              color: isFlagged ? 'var(--accent-amber)' : 'var(--text-main)',
              fontSize: '0.825rem'
            }}
          >
            {isFlagged ? '🚩 Flagged for Review' : '⚐ Flag for Review'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="text-xs text-muted">NCEES Reference Spec:</span>
          <span className="glass-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            Civil PE v2.0
          </span>
        </div>
      </div>

      {/* Interactive Guidance & Study Tabs */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div className="tabs-container" style={{ marginBottom: '1.25rem' }}>
          <button 
            className={`tab-btn ${activeTab === 'hint' ? 'active' : ''}`}
            onClick={() => setActiveTab('hint')}
          >
            💡 Engineering Hint
          </button>
          <button 
            className={`tab-btn ${activeTab === 'shortcut' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcut')}
          >
            ⚡ Exam Shortcut
          </button>
          <button 
            className={`tab-btn ${activeTab === 'intuition' ? 'active' : ''}`}
            onClick={() => setActiveTab('intuition')}
          >
            👦 Physical Intuition
          </button>
          <button 
            className={`tab-btn ${activeTab === 'scratchpad' ? 'active' : ''}`}
            onClick={() => setActiveTab('scratchpad')}
          >
            📝 Calculation Scratchpad
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'hint' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'modalEnter 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="glass-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-blue)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                Governing Equation & Reference
              </span>
            </div>
            <FormattedEngineeringGuide 
              text={problem.hint || "Identify the core governing variables and locate the relevant formula in the NCEES Civil PE Reference Handbook. Verify unit consistency (e.g., converting inches to feet or psi to psf) before calculating."} 
              type="hint" 
            />
          </div>
        )}

        {activeTab === 'shortcut' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'modalEnter 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="glass-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                Timed Exam Elimination Tactic
              </span>
            </div>
            <FormattedEngineeringGuide 
              text={problem.shortcut || "Inspect the multiple-choice options first. Often two answers can be rapidly eliminated by an order-of-magnitude bounds check before performing the precise numerical integration or substitution."} 
              type="shortcut" 
            />
          </div>
        )}

        {activeTab === 'intuition' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'modalEnter 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="glass-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                Plain-English Physical Analogy
              </span>
            </div>
            <FormattedEngineeringGuide 
              text={problem.fifthGrader || "Imagine fluid in a pipe like cars traveling down a highway. If the road is smooth and wide, flow is effortless; if the walls are rough or narrow, friction builds up and slows the entire system down."} 
              type="intuition" 
            />
          </div>
        )}

        {activeTab === 'scratchpad' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'modalEnter 0.2s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="text-xs text-muted">Quick Engineering Symbols:</span>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {['π', '√', 'θ', 'Δ', 'γ', 'Rh', 'Q', 'V', 'Σ'].map(sym => (
                  <button 
                    key={sym} 
                    onClick={() => insertSymbol(sym)}
                    className="btn-secondary" 
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            <textarea 
              value={userNotes}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Work through your calculations and note handbook page numbers here... (Notes are saved automatically)"
              style={{ 
                width: '100%',
                minHeight: '140px',
                background: 'rgba(6, 11, 22, 0.8)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '1rem',
                color: '#f8fafc',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GenericProblemViewer;
