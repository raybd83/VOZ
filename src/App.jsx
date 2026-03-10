import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, List, Book, Copy, Share2, Plus, Edit2, Trash2, CheckSquare, Square, X, Edit3, Download, Upload } from 'lucide-react';
import { loadRules, saveRules, loadGlossary, saveGlossary } from './store';
import { applyCorrections } from './engine';
import './index.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function App() {
  const [activeTab, setActiveTab] = useState('dictation');
  const [rules, setRules] = useState([]);
  const [glossary, setGlossary] = useState([]);

  // Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [applyAuto, setApplyAuto] = useState(true);

  // Correction Modal State
  const [selectedWord, setSelectedWord] = useState('');
  const [correctionTarget, setCorrectionTarget] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [ruleMode, setRuleMode] = useState('always'); // 'always' | 'once'

  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Refs for callbacks
  const rulesRef = useRef(rules);
  const applyAutoRef = useRef(applyAuto);
  useEffect(() => { rulesRef.current = rules; }, [rules]);
  useEffect(() => { applyAutoRef.current = applyAuto; }, [applyAuto]);

  // Load Data
  useEffect(() => {
    loadRules().then(r => setRules(r || []));
    loadGlossary().then(g => setGlossary(g || []));
  }, []);

  // Save Data
  useEffect(() => {
    if (rules.length > 0) saveRules(rules);
  }, [rules]);
  useEffect(() => {
    if (glossary.length > 0) saveGlossary(glossary);
  }, [glossary]);

  // STT Setup
  useEffect(() => {
    if (!SpeechRecognition) return;

    const sr = new SpeechRecognition();
    sr.continuous = true;
    sr.interimResults = true;
    sr.lang = 'pt-BR';

    sr.onresult = (e) => {
      let currentInterim = '';
      let newFinalChunks = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          // Applies correction engine immediately before appending to textarea
          let correctedChunk = applyCorrections(transcript, rulesRef.current, applyAutoRef.current);

          correctedChunk = correctedChunk.replace(/^[ \t]+|[ \t]+$/g, '');
          correctedChunk = correctedChunk.replace(/[ \t]*(?:novo\s+)?par[aá]grafo[ \t]*/gi, '\n\n');

          if (correctedChunk) {
            if (newFinalChunks && !newFinalChunks.endsWith('\n') && !correctedChunk.startsWith('\n')) {
              newFinalChunks += ' ';
            }
            newFinalChunks += correctedChunk;
          }
        } else {
          currentInterim += transcript;
        }
      }

      let interimCorrected = applyCorrections(currentInterim, rulesRef.current, applyAutoRef.current);
      interimCorrected = interimCorrected.replace(/[ \t]*(?:novo\s+)?par[aá]grafo[ \t]*/gi, '\n\n');
      setInterimText(interimCorrected);

      if (newFinalChunks) {
        setFinalText(prev => {
          let sep = '';
          if (prev && !prev.endsWith(' ') && !prev.endsWith('\n') && !newFinalChunks.startsWith('\n')) {
            sep = ' ';
          }
          return prev + sep + newFinalChunks;
        });
      }
    };

    sr.onerror = (e) => {
      console.error('STT erro', e);
      if (e.error === 'not-allowed') setIsRecording(false);
    };

    sr.onend = () => {
      // Re-start automatically if supposed to be recording
      if (isRecording) {
        try { sr.start(); } catch (e) { }
      }
    };

    recognitionRef.current = sr;
  }, [isRecording]); // Effect depends on isRecording to loop properly

  useEffect(() => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      setInterimText('');
      try { recognitionRef.current.start(); } catch { }
    } else {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Add grammar hints manually
    if (!isRecording && SpeechRecognition && window.SpeechGrammarList) {
      const gl = new window.SpeechGrammarList();
      const grammar = `#JSGF V1.0; grammar dictado; public <term> = ${glossary.map(g => g.term).join(' | ')};`;
      try {
        gl.addFromString(grammar, 1);
        recognitionRef.current.grammars = gl;
      } catch (e) { }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(finalText);
    alert('Copiado!');
  };

  const handleSelection = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;

    if (start !== end) {
      const selected = finalText.substring(start, end).trim();
      setSelectedWord(selected);
    } else {
      setSelectedWord('');
    }
  };

  const handleApplyCorrection = () => {
    if (!selectedWord || !correctionTarget) return;

    if (ruleMode === 'always') {
      const newRule = {
        id: Date.now(),
        x: selectedWord,
        y: correctionTarget,
        active: true,
        wholeWord: true,
        usageCount: 0
      };
      setRules([...rules, newRule]);

      // Replace instantly in the current text as well
      setFinalText(prev => applyCorrections(prev, [newRule], true));
    } else {
      // 'once' mode: replace the exact selection logically
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = finalText.substring(0, start);
        const after = finalText.substring(end);
        setFinalText(before + correctionTarget + after);
      } else {
        // Fallback backward replace
        const index = finalText.lastIndexOf(selectedWord);
        if (index >= 0) {
          const newText = finalText.substring(0, index) + correctionTarget + finalText.substring(index + selectedWord.length);
          setFinalText(newText);
        }
      }
    }

    setShowModal(false);
    setCorrectionTarget('');
  };

  const handleExportData = () => {
    const data = JSON.stringify({ rules, glossary }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-voz-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.rules && Array.isArray(json.rules)) {
          setRules(json.rules);
        }
        if (json.glossary && Array.isArray(json.glossary)) {
          setGlossary(json.glossary);
        }
        alert('Dados importados com sucesso!');
      } catch (error) {
        alert('Erro ao importar arquivo. Certifique-se de que é um backup válido.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <button className={`nav-btn ${activeTab === 'dictation' ? 'active' : ''}`} onClick={() => setActiveTab('dictation')}>
          <Mic size={18} /> Ditado
        </button>
        <button className={`nav-btn ${activeTab === 'corrections' ? 'active' : ''}`} onClick={() => setActiveTab('corrections')}>
          <List size={18} /> Correções
        </button>
        <button className={`nav-btn ${activeTab === 'glossary' ? 'active' : ''}`} onClick={() => setActiveTab('glossary')}>
          <Book size={18} /> Glossário
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'dictation' && (
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h1 className="title">Ditado Médico</h1>
            <p className="subtitle">Linguagem: Português (Brasil). Fale ou digite no campo abaixo.</p>

            <div className="toggle-wrapper" style={{ marginBottom: '1rem' }} onClick={() => setApplyAuto(!applyAuto)}>
              <div className={`toggle-switch ${applyAuto ? 'toggle-active' : ''}`}></div>
              <span className="input-label" style={{ margin: 0 }}>Aplicar correções automaticamente</span>
            </div>

            <textarea
              ref={textareaRef}
              className="dictation-textarea"
              placeholder="Sua transcrição aparecerá aqui. Você também pode digitar..."
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              onSelect={handleSelection}
            />
            {interimText && (
              <div className="dictation-interim" style={{ marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                {interimText}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={handleCopy}><Copy size={16} /> Copiar</button>
              <button className="btn btn-ghost" onClick={() => setFinalText('')}><Trash2 size={16} /> Limpar</button>
              <button
                className={`btn ${selectedWord ? 'btn-primary' : 'btn-ghost'}`}
                disabled={!selectedWord}
                onClick={() => {
                  setCorrectionTarget('');
                  setRuleMode('always');
                  setShowModal(true);
                }}
              >
                <Edit3 size={16} /> Corrigir Seleção {selectedWord ? `("${selectedWord}")` : ''}
              </button>
            </div>

            <button className={`mic-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording}>
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isRecording ? 'Ouvindo... Clique para parar' : 'Clique no microfone para falar'}
            </div>

            {!SpeechRecognition && (
              <div style={{ color: 'var(--danger)', marginTop: '1rem', textAlign: 'center' }}>
                Seu navegador não suporta a transcrição Web Speech API (use Chrome ou Edge).
              </div>
            )}
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h1 className="title" style={{ marginBottom: '0.2rem' }}>Regras de Correção</h1>
                <p className="subtitle" style={{ margin: 0 }}>Edite como as palavras devem ser corrigidas.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={handleExportData} title="Exportar Backup">
                  <Download size={18} /> Exportar
                </button>
                <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} title="Importar Backup">
                  <Upload size={18} /> Importar
                </button>
                <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImportData} />
              </div>
            </div>

            <div className="input-group" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
              <input id="newRuleX" placeholder="Palavra errada (X)" className="input-field" style={{ flex: 1 }} />
              <input id="newRuleY" placeholder="Correta (Y)" className="input-field" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => {
                const xInp = document.getElementById('newRuleX');
                const yInp = document.getElementById('newRuleY');
                if (xInp.value && yInp.value) {
                  setRules([...rules, { id: Date.now(), x: xInp.value, y: yInp.value, active: true, usageCount: 0 }]);
                  xInp.value = ''; yInp.value = '';
                }
              }}> <Plus size={16} /> Add </button>
            </div>

            <div className="scrollable-list">
              {rules.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Nenhuma regra castrada.</div>}
              {rules.map(rule => (
                <div key={rule.id} className="list-item">
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div onClick={() => {
                      setRules(rules.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
                    }} style={{ cursor: 'pointer', color: rule.active ? 'var(--success)' : 'var(--text-muted)' }}>
                      {rule.active ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div>
                      <strong>{rule.x}</strong> &rarr; <span style={{ color: 'var(--primary)' }}>{rule.y}</span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uso: {rule.usageCount || 0} vezes</div>
                    </div>
                  </div>
                  <button className="btn btn-icon-only btn-danger" onClick={() => {
                    setRules(rules.filter(r => r.id !== rule.id));
                  }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'glossary' && (
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h1 className="title" style={{ marginBottom: '0.2rem' }}>Glossário Médico</h1>
                <p className="subtitle" style={{ margin: 0 }}>Termos frequentes para otimizar detecção e autocorreção.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={handleExportData} title="Exportar Backup">
                  <Download size={18} /> Exportar
                </button>
                <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} title="Importar Backup">
                  <Upload size={18} /> Importar
                </button>
              </div>
            </div>

            <div className="input-group" style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
              <input id="newTerm" placeholder="Novo termo (ex. Colédoco)" className="input-field" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={() => {
                const trm = document.getElementById('newTerm');
                if (trm.value) {
                  setGlossary([...glossary, { id: Date.now(), term: trm.value }]);
                  trm.value = '';
                }
              }}> <Plus size={16} /> Add </button>
            </div>

            <div className="scrollable-list">
              {glossary.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Glossário vazio.</div>}
              {glossary.map(item => (
                <div key={item.id} className="list-item">
                  <span style={{ fontWeight: 500 }}>{item.term}</span>
                  <button className="btn btn-icon-only btn-danger" onClick={() => {
                    setGlossary(glossary.filter(g => g.id !== item.id));
                  }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target.className === 'modal-overlay') setShowModal(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="title" style={{ margin: 0 }}>Corrigir Palavra / Expressão</h2>
              <button className="btn btn-icon-only btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <div className="input-group">
              <label className="input-label">Identificado (Seleção)</label>
              <input className="input-field" value={selectedWord} onChange={e => setSelectedWord(e.target.value)} disabled style={{ opacity: 0.7 }} />
            </div>

            <div className="input-group">
              <label className="input-label">Forma correta</label>
              <input className="input-field" value={correctionTarget} onChange={e => setCorrectionTarget(e.target.value)} autoFocus placeholder="Digite a correção..." />
              {glossary.length > 0 && correctionTarget && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {glossary.filter(g => g.term.toLowerCase().includes(correctionTarget.toLowerCase())).map(s => (
                    <div key={s.id} className="btn btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }} onClick={() => setCorrectionTarget(s.term)}>
                      {s.term}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                className={`btn ${ruleMode === 'always' ? 'btn-primary' : 'btn-ghost'}`}
                style={ruleMode !== 'always' ? { background: 'var(--surface-hover)' } : {}}
                onClick={() => setRuleMode('always')}
              >
                Corrigir sempre (criar regra)
              </button>
              <button
                className={`btn ${ruleMode === 'once' ? 'btn-primary' : 'btn-ghost'}`}
                style={ruleMode !== 'once' ? { background: 'var(--surface-hover)' } : {}}
                onClick={() => setRuleMode('once')}
              >
                Só desta vez (na seleção)
              </button>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} onClick={handleApplyCorrection} disabled={!correctionTarget}>
              Aplicar & Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
