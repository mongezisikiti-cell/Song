import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Sparkles, 
  Clock, 
  ScrollText, 
  MessageSquare, 
  ChevronRight, 
  Printer, 
  Share2,
  Plus,
  ArrowRight,
  Heart,
  Library,
  Info,
  X,
  FileText,
  Search,
  Check,
  Loader2,
  Languages,
  Zap,
  ExternalLink,
  Video,
  Mic,
  Play,
  History,
  MicOff,
  Trash2,
  BookmarkCheck,
  Calendar
} from 'lucide-react';
import Markdown from 'react-markdown';
import { 
  generateSeminarOutline, 
  generateSeminarTitle, 
  decodeScripture, 
  generateFullSermon, 
  generateSpecializedPrayers,
  generatePodcastScript,
  generateVideoTeaser
} from './services/gemini';
import { 
  lookupScripture, 
  lookupAlternativeTranslations, 
  BibleVerse,
  COMMON_TRANSLATIONS 
} from './services/bibleService';
import { getBibleLink, getVersionLink } from './lib/bible-utils';
import { exportToWord } from './lib/export-utils';
import { SeminarOutline, GenerationState, SpecializedPrayerPoint, TalkingPoint, HistoryItem, StudyPlan } from './types';
import { cn } from './lib/utils';
import { TRACTS, Tract } from './data/tracts';
import StudyPlanBuilder from './components/StudyPlanBuilder';

export default function App() {
  const [topic, setTopic] = useState('');
  const [seminarTitle, setSeminarTitle] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [view, setView] = useState<'home' | 'library' | 'archive' | 'plans'>('home');
  const [selectedTract, setSelectedTract] = useState<Tract | null>(null);
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    isGeneratingSermon: false,
    isGeneratingPrayers: false,
    isGeneratingPodcast: false,
    isGeneratingVideo: false,
    isGeneratingStudyPlan: false,
    error: null,
    outline: null,
    studyPlan: null
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('seminar_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyPlans, setHistoryPlans] = useState<StudyPlan[]>(() => {
    const saved = localStorage.getItem('study_plans');
    return saved ? JSON.parse(saved) : [];
  });
  const [isListening, setIsListening] = useState(false);
  const [scriptureSearch, setScriptureSearch] = useState('');
  const [isSearchingScripture, setIsSearchingScripture] = useState(false);
  const [foundVerse, setFoundVerse] = useState<BibleVerse | null>(null);
  const [manualReference, setManualReference] = useState('');
  const [manualText, setManualText] = useState('');
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [alternativeVerses, setAlternativeVerses] = useState<BibleVerse[]>([]);
  const [scriptureDecoding, setScriptureDecoding] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showScriptureModal, setShowScriptureModal] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState('kjv');
  const [pendingScriptures, setPendingScriptures] = useState<string[]>([]);
  const [selectedDeepDive, setSelectedDeepDive] = useState<TalkingPoint | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleLookupScripture = async () => {
    if (!scriptureSearch.trim()) return;
    setIsSearchingScripture(true);
    setFoundVerse(null);
    setAlternativeVerses([]);
    setScriptureDecoding(null);
    try {
      const [verse, alternatives] = await Promise.all([
        lookupScripture(scriptureSearch, selectedTranslation),
        lookupAlternativeTranslations(scriptureSearch)
      ]);
      setFoundVerse(verse);
      setAlternativeVerses(alternatives);
    } catch (err) {
      console.error('Scripture lookup failed:', err);
    } finally {
      setIsSearchingScripture(false);
    }
  };

  const handleDecodeScripture = async () => {
    const ref = isManualEntry ? manualReference : foundVerse?.reference;
    const text = isManualEntry ? manualText : foundVerse?.text;
    
    if (!ref || !text) return;
    
    setIsDecoding(true);
    try {
      const decoding = await decodeScripture(ref, text);
      setScriptureDecoding(decoding);
    } catch (err) {
      console.error('Scripture decoding failed:', err);
    } finally {
      setIsDecoding(false);
    }
  };

  const handleAddScriptureToSession = (sessionId: string, scripture: string) => {
    if (!state.outline) return;

    const updatedOutline = {
      ...state.outline,
      sessions: state.outline.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            keyScriptures: [...s.keyScriptures, scripture]
          };
        }
        return s;
      })
    };

    setState(prev => ({ ...prev, outline: updatedOutline }));
    setShowScriptureModal(false);
    setScriptureSearch('');
    setFoundVerse(null);
    setActiveSessionId(null);
  };

  const handleAddMultipleScripturesToSession = (sessionId: string, references: string[]) => {
    if (!state.outline) return;

    const updatedOutline = {
      ...state.outline,
      sessions: state.outline.sessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            keyScriptures: [...s.keyScriptures, ...references]
          };
        }
        return s;
      })
    };

    setState(prev => ({ ...prev, outline: updatedOutline }));
    setPendingScriptures([]);
    setShowScriptureModal(false);
    setScriptureSearch('');
    setFoundVerse(null);
    setActiveSessionId(null);
  };

  const movePendingScripture = (index: number, direction: 'up' | 'down') => {
    const newList = [...pendingScriptures];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    setPendingScriptures(newList);
  };

  const removePendingScripture = (index: number) => {
    setPendingScriptures(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateTitle = async (tract?: Tract) => {
    const finalTopic = tract ? tract.title : topic;
    if (!finalTopic.trim()) return;

    setIsGeneratingTitle(true);
    try {
      const title = await generateSeminarTitle(finalTopic, tract);
      setSeminarTitle(title);
    } catch (err) {
      console.error('Failed to generate title:', err);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleGenerate = async (e?: React.FormEvent, tract?: Tract) => {
    if (e) e.preventDefault();
    const finalTopic = tract ? tract.title : topic;
    if (!finalTopic.trim()) return;

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      isGeneratingSermon: false, 
      isGeneratingPrayers: false, 
      isGeneratingPodcast: false,
      isGeneratingVideo: false,
      error: null 
    }));
    setView('home');
    setSelectedTract(null);
    setVideoUrl(null);
    try {
      const result = await generateSeminarOutline(finalTopic, tract, seminarTitle);
      
      // Save to history
      const newHistoryItem: HistoryItem = {
        id: crypto.randomUUID(),
        title: result.title,
        topic: finalTopic,
        date: new Date().toISOString(),
        outline: result
      };
      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('seminar_history', JSON.stringify(updatedHistory));

      setState({
        isLoading: false,
        isGeneratingSermon: false,
        isGeneratingPrayers: false,
        isGeneratingPodcast: false,
        isGeneratingVideo: false,
        error: null,
        outline: result
      });
    } catch (err) {
      setState({
        isLoading: false,
        isGeneratingSermon: false,
        isGeneratingPrayers: false,
        isGeneratingPodcast: false,
        isGeneratingVideo: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
        outline: null
      });
    }
  };

  const handleToggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice dictation is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTopic(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.start();
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('seminar_history', JSON.stringify(updated));
  };

  const toggleFinished = (id: string) => {
    const updated = history.map(item => 
      item.id === id ? { ...item, isFinished: !item.isFinished } : item
    );
    setHistory(updated);
    localStorage.setItem('seminar_history', JSON.stringify(updated));
  };

  const loadFromHistory = (item: HistoryItem) => {
    setState(prev => ({
      ...prev,
      outline: item.outline,
      error: null
    }));
    setSeminarTitle(item.title);
    setTopic(item.topic);
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateFullSermon = async () => {
    if (!state.outline) return;
    setState(prev => ({ ...prev, isGeneratingSermon: true }));
    try {
      const sermon = await generateFullSermon(state.outline);
      setState(prev => ({
        ...prev,
        isGeneratingSermon: false,
        outline: prev.outline ? { ...prev.outline, fullSermon: sermon } : null
      }));
    } catch (err) {
      console.error('Failed to generate full sermon:', err);
      setState(prev => ({ ...prev, isGeneratingSermon: false }));
    }
  };

  const handleGenerateSpecializedPrayers = async () => {
    if (!state.outline) return;
    setState(prev => ({ ...prev, isGeneratingPrayers: true }));
    try {
      const prayers = await generateSpecializedPrayers(state.outline);
      setState(prev => ({
        ...prev,
        isGeneratingPrayers: false,
        outline: prev.outline ? { ...prev.outline, specializedPrayers: prayers } : null
      }));
    } catch (err) {
      console.error('Failed to generate specialized prayers:', err);
      setState(prev => ({ ...prev, isGeneratingPrayers: false }));
    }
  };

  const handleGeneratePodcastScript = async () => {
    if (!state.outline) return;
    setState(prev => ({ ...prev, isGeneratingPodcast: true }));
    try {
      const script = await generatePodcastScript(state.outline);
      setState(prev => ({
        ...prev,
        isGeneratingPodcast: false,
        outline: prev.outline ? { ...prev.outline, podcastScript: script } : null
      }));
    } catch (err) {
      console.error('Failed to generate podcast script:', err);
      setState(prev => ({ ...prev, isGeneratingPodcast: false }));
    }
  };

  const handleGenerateVideoTeaser = async () => {
    if (!state.outline) return;

    // Check for API key
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // Proceeding assuming success as per guidelines
      }
    }

    setState(prev => ({ ...prev, isGeneratingVideo: true }));
    try {
      const url = await generateVideoTeaser(state.outline);
      setVideoUrl(url);
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
    } catch (err) {
      console.error('Failed to generate video teaser:', err);
      setState(prev => ({ ...prev, isGeneratingVideo: false }));
      // If requested entity not found, reset key and prompt again
      if (err instanceof Error && err.message.includes("Requested entity was not found")) {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
        }
      }
    }
  };

  const deleteHistoryPlan = (id: string) => {
    const updated = historyPlans.filter(p => p.id !== id);
    setHistoryPlans(updated);
    localStorage.setItem('study_plans', JSON.stringify(updated));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportToWord = async () => {
    if (!state.outline) return;
    try {
      await exportToWord(state.outline, seminarTitle || state.outline.title);
    } catch (err) {
      console.error('Export to Word failed:', err);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: seminarTitle || state.outline?.title || 'Seminar Outline',
        text: state.outline?.description,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen selection:bg-gold/30">
      {/* Header */}
      <header className="border-b border-ink/5 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setView('home');
                setState(prev => ({ ...prev, outline: null }));
                setSelectedTract(null);
                setSeminarTitle('');
              }}
              className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center text-parchment hover:scale-105 transition-transform"
            >
              <BookOpen size={20} />
            </button>
            <div>
              <h1 className="serif text-xl font-bold tracking-tight">Seminar Builder</h1>
              <p className="text-[10px] uppercase tracking-widest text-ink/40 font-semibold">For Bible Teachers</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setView(view === 'archive' ? 'home' : 'archive');
                setSelectedTract(null);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                view === 'archive' ? "bg-ink text-parchment" : "text-ink/60 hover:bg-ink/5"
              )}
            >
              <History size={18} />
              <span className="hidden sm:inline">The Homiletic Archive</span>
            </button>

            <button 
              onClick={() => {
                setView(view === 'library' ? 'home' : 'library');
                setSelectedTract(null);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                view === 'library' ? "bg-gold text-white" : "text-ink/60 hover:bg-ink/5"
              )}
            >
              <Library size={18} />
              <span className="hidden sm:inline">Tract Library</span>
            </button>

            <button 
              onClick={() => {
                setView(view === 'plans' ? 'home' : 'plans');
                setSelectedTract(null);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                view === 'plans' ? "bg-gold text-white shadow-sm" : "text-ink/60 hover:bg-ink/5"
              )}
            >
              <Calendar size={18} />
              <span className="hidden sm:inline">Study Plans</span>
            </button>

            {state.outline && (
              <div className="flex items-center gap-2 border-l border-ink/10 pl-4">
                <button 
                  onClick={() => {
                    const currentItem = history.find(h => h.title === state.outline?.title);
                    if (currentItem) toggleFinished(currentItem.id);
                  }}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    history.find(h => h.title === state.outline?.title)?.isFinished 
                      ? "text-green-500 bg-green-50" 
                      : "text-ink/60 hover:bg-ink/5"
                  )}
                  title="Mark as Finished"
                >
                  <BookmarkCheck size={20} />
                </button>
                <button 
                  onClick={handleExportToWord}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/60"
                  title="Export to Word"
                >
                  <FileText size={20} />
                </button>
                <button 
                  onClick={handlePrint}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/60"
                  title="Print Outline"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={handleShare}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/60"
                  title="Share"
                >
                  <Share2 size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'library' ? (
            <motion.div
              key="library-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="serif text-4xl font-bold">Tract Library</h2>
                <p className="text-ink/60">Select a tract to generate a seminar outline or read the full message.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TRACTS.map((tract) => (
                  <div 
                    key={tract.id}
                    className="bg-white p-6 rounded-3xl border border-ink/5 shadow-sm hover:shadow-md transition-all group flex flex-col"
                  >
                    <div className="space-y-4 flex-grow">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="serif text-2xl font-bold group-hover:text-gold transition-colors">{tract.title}</h3>
                        <a 
                          href={getBibleLink(tract.mainScripture)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-gold/10 text-gold px-2 py-1 rounded-md font-bold whitespace-nowrap hover:bg-gold/20 transition-colors"
                        >
                          {tract.mainScripture}
                        </a>
                      </div>
                      <p className="text-sm text-ink/60 leading-relaxed line-clamp-3">{tract.summary}</p>
                    </div>
                    
                    <div className="pt-6 flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => setSelectedTract(tract)}
                        className="flex items-center gap-2 text-xs font-bold text-ink/40 hover:text-gold transition-colors"
                      >
                        <FileText size={14} /> View Full Message
                      </button>
                      <button
                        onClick={() => {
                          setTopic(tract.title);
                          setView('home');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-ink text-parchment rounded-xl text-xs font-bold hover:bg-ink/90 transition-all"
                      >
                        Select for Seminar <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : view === 'plans' ? (
            <motion.div
              key="plans-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <StudyPlanBuilder 
                initialPlan={state.studyPlan}
                onSave={(newPlan) => {
                  const updated = [newPlan, ...historyPlans.filter(p => p.id !== newPlan.id)];
                  setHistoryPlans(updated);
                  localStorage.setItem('study_plans', JSON.stringify(updated));
                }}
              />
            </motion.div>
          ) : view === 'archive' ? (
            <motion.div 
              key="archive-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12 py-12"
            >
              <div className="text-center space-y-4">
                <h2 className="serif text-4xl font-bold">The Homiletic Archive</h2>
                <p className="text-ink/60 max-w-lg mx-auto">
                  Your journey of spiritual preparation, preserved for reflection and future teaching.
                </p>
              </div>

              {history.length === 0 ? (
                <div className="bg-ink/5 rounded-[3rem] p-20 text-center space-y-6 border-2 border-dashed border-ink/10">
                  <History className="mx-auto text-ink/10" size={64} />
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-ink/40 italic">The archive is currently empty.</p>
                    <p className="text-ink/30 text-sm">Generate your first seminar to begin your collection.</p>
                  </div>
                  <button 
                    onClick={() => setView('home')}
                    className="px-8 py-3 bg-ink text-parchment rounded-2xl font-bold hover:bg-ink/90 transition-all shadow-lg"
                  >
                    Begin a New Journey
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {history.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      className="bg-white rounded-[2rem] border border-ink/5 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-gold/10 transition-colors" />
                      
                      <div className="space-y-4 relative flex-grow">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gold/10 text-gold rounded-2xl">
                              <ScrollText size={24} />
                            </div>
                            {item.isFinished && (
                              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <BookmarkCheck size={12} /> Finished
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => toggleFinished(item.id)}
                              className={cn(
                                "p-2 transition-all rounded-xl",
                                item.isFinished ? "text-green-500 bg-green-50" : "text-ink/20 hover:text-green-500 hover:bg-green-50"
                              )}
                              title={item.isFinished ? "Mark as In-Progress" : "Mark as Finished"}
                            >
                              <BookmarkCheck size={18} />
                            </button>
                            <button 
                              onClick={() => deleteHistoryItem(item.id)}
                              className="p-2 text-ink/20 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                              title="Remove from Archive"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="serif text-xl font-bold leading-tight group-hover:text-gold transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-xs uppercase tracking-widest font-bold text-ink/30">
                            {new Date(item.date).toLocaleDateString(undefined, { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>

                        <p className="text-ink/60 text-sm line-clamp-3 italic">
                          "{item.topic}"
                        </p>
                      </div>

                      <div className="pt-8 mt-auto relative">
                        <button 
                          onClick={() => loadFromHistory(item)}
                          className="w-full py-4 bg-ink text-parchment rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-ink/90 transition-all shadow-md"
                        >
                          Restore to Study <ArrowRight size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {historyPlans.length > 0 && (
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="h-px bg-ink/5 flex-grow" />
                    <h3 className="text-xs uppercase tracking-widest font-black text-ink/20">Archived Study Plans</h3>
                    <div className="h-px bg-ink/5 flex-grow" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {historyPlans.map((plan) => (
                      <motion.div 
                        key={plan.id}
                        layout
                        className="bg-white rounded-[2rem] border border-ink/5 p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-gold/10 transition-colors" />
                        
                        <div className="space-y-4 relative flex-grow">
                          <div className="flex justify-between items-start">
                            <div className="p-3 bg-gold/10 text-gold rounded-2xl">
                              <Calendar size={24} />
                            </div>
                            <button 
                              onClick={() => deleteHistoryPlan(plan.id)}
                              className="p-2 text-ink/20 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <h3 className="serif text-xl font-bold leading-tight group-hover:text-gold transition-colors">
                              {plan.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-ink/30">
                              <Clock size={12} /> {plan.durationDays} Days Plan
                            </div>
                          </div>

                          <p className="text-ink/60 text-sm line-clamp-2 italic">
                            {plan.description}
                          </p>
                        </div>

                        <div className="pt-8 mt-auto relative">
                          <button 
                            onClick={() => {
                              setState(prev => ({ ...prev, studyPlan: plan, outline: null }));
                              setView('plans');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="w-full py-4 bg-gold/10 text-gold rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gold hover:text-white transition-all shadow-sm"
                          >
                            Resume Plan <ChevronRight size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : !state.outline ? (
            <motion.div 
              key="input-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto text-center space-y-8 py-20"
            >
              <div className="space-y-4">
                <h2 className="serif text-5xl md:text-6xl font-light leading-tight">
                  Structure your next <br />
                  <span className="italic text-gold">spiritual journey.</span>
                </h2>
                <p className="text-ink/60 text-lg max-w-md mx-auto">
                  Enter a topic or scripture to generate a comprehensive seminar outline with AI.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="text-left space-y-2">
                    <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Topic or Scripture</label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., The 6 Steps of Prayer, Parables of Grace..."
                        className="w-full bg-white border-2 border-ink/5 rounded-2xl pl-6 pr-14 py-5 text-lg focus:outline-none focus:border-gold/50 transition-all shadow-sm group-hover:shadow-md"
                        disabled={state.isLoading}
                      />
                      <button
                        type="button"
                        onClick={handleToggleListening}
                        className={cn(
                          "absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all",
                          isListening ? "bg-red-500 text-white animate-pulse" : "text-ink/20 hover:text-gold hover:bg-gold/10"
                        )}
                        title={isListening ? "Stop Listening" : "Start Voice Dictation"}
                      >
                        {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="text-left space-y-2">
                    <div className="flex items-center justify-between ml-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ink/40">Seminar Title (Optional)</label>
                      <button
                        type="button"
                        onClick={() => handleGenerateTitle()}
                        disabled={isGeneratingTitle || !topic.trim() || state.isLoading}
                        className="text-[10px] uppercase tracking-widest font-bold text-gold hover:text-gold/80 disabled:opacity-50 flex items-center gap-1 transition-colors"
                      >
                        {isGeneratingTitle ? <Sparkles className="animate-spin" size={12} /> : <Sparkles size={12} />}
                        Generate Title
                      </button>
                    </div>
                    <input
                      type="text"
                      value={seminarTitle}
                      onChange={(e) => setSeminarTitle(e.target.value)}
                      placeholder="Catchy title for your seminar..."
                      className="w-full bg-white border-2 border-ink/5 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-gold/50 transition-all shadow-sm group-hover:shadow-md"
                      disabled={state.isLoading}
                    />
                  </div>
                </div>

                <button
                  onClick={(e) => handleGenerate(e)}
                  disabled={state.isLoading || !topic.trim()}
                  className={cn(
                    "w-full py-5 bg-ink text-parchment rounded-2xl flex items-center justify-center gap-3 text-lg font-bold transition-all hover:bg-ink/90 disabled:opacity-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5",
                    state.isLoading && "animate-pulse"
                  )}
                >
                  {state.isLoading ? (
                    <>
                      <Sparkles className="animate-spin" size={24} />
                      <span>Structuring Seminar...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Seminar Outline</span>
                      <ArrowRight size={24} />
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-4">
                {['Prayer 6', 'Fruit of the Spirit', 'Book of Enoch', 'Book of the Giants', 'Testament of Solomon', 'Gospel of Thomas'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setTopic(suggestion)}
                    className="px-4 py-2 rounded-full border border-ink/10 text-sm hover:bg-ink/5 transition-colors text-ink/60"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="outline-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12"
            >
              {/* Outline Header */}
              <div className="space-y-6 text-center max-w-3xl mx-auto">
                <button 
                  onClick={() => {
                    setState({ ...state, outline: null });
                    setSeminarTitle('');
                  }}
                  className="text-xs uppercase tracking-widest font-bold text-gold hover:text-gold/80 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="rotate-45" size={14} /> Start New Outline
                </button>
                <h2 className="serif text-4xl md:text-6xl font-bold leading-tight">{state.outline.title}</h2>
                <p className="text-ink/60 text-lg italic">{state.outline.description}</p>
              </div>

              {/* Sessions Grid */}
              <div className="grid grid-cols-1 gap-8">
                {state.outline.sessions.map((session, idx) => (
                  <motion.div 
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-3xl border border-ink/5 p-8 md:p-10 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                      <ScrollText size={120} />
                    </div>

                    <div className="relative z-10 space-y-8">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">Session {idx + 1}</span>
                          <h3 className="serif text-3xl font-bold">{session.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-ink/40 bg-ink/5 px-4 py-2 rounded-full w-fit">
                          <Clock size={14} />
                          <span className="text-xs font-semibold">{session.duration}</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 text-ink/40">
                                <BookOpen size={14} /> Key Scriptures
                              </h4>
                              <button
                                onClick={() => {
                                  setActiveSessionId(session.id);
                                  setPendingScriptures([]);
                                  setShowScriptureModal(true);
                                }}
                                className="text-[10px] uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
                              >
                                <Plus size={12} /> Add Scripture
                              </button>
                            </div>
                            <ul className="space-y-2">
                              {session.keyScriptures.map((scripture, sIdx) => (
                                <li key={sIdx} className="text-ink/80 flex items-start gap-3 group/item">
                                  <ChevronRight size={16} className="text-gold mt-1 shrink-0" />
                                  <a 
                                    href={getBibleLink(scripture)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:text-gold hover:underline transition-colors"
                                  >
                                    {scripture}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {session.prayerFocus && (
                            <div className="p-6 bg-gold/5 rounded-2xl border border-gold/10 space-y-2">
                              <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 text-gold">
                                <Heart size={14} /> Prayer Focus
                              </h4>
                              <p className="text-ink/70 italic text-sm leading-relaxed">
                                "{session.prayerFocus}"
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-2 text-ink/40">
                            <MessageSquare size={14} /> Talking Points
                          </h4>
                          <ul className="space-y-4">
                            {session.detailedTalkingPoints ? (
                              session.detailedTalkingPoints.map((tp, pIdx) => (
                                <li key={pIdx} className="text-ink/70 text-sm leading-relaxed flex flex-col gap-1">
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 bg-gold rounded-full mt-1.5 shrink-0" />
                                    <span>{tp.point}</span>
                                  </div>
                                  <button 
                                    onClick={() => setSelectedDeepDive(tp)}
                                    className="ml-4.5 text-[10px] uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-1 transition-colors w-fit"
                                  >
                                    <ExternalLink size={10} /> Deep Dive
                                  </button>
                                </li>
                              ))
                            ) : (
                              session.talkingPoints.map((point, pIdx) => (
                                <li key={pIdx} className="text-ink/70 text-sm leading-relaxed flex items-start gap-3">
                                  <div className="w-1.5 h-1.5 bg-gold rounded-full mt-1.5 shrink-0" />
                                  {point}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Specialized Features Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12">
                {/* Full Sermon Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="serif text-2xl font-bold flex items-center gap-3">
                      <ScrollText className="text-gold" /> The Pulpit Manuscript
                    </h3>
                    {!state.outline.fullSermon && (
                      <button
                        onClick={handleGenerateFullSermon}
                        disabled={state.isGeneratingSermon}
                        className="text-xs uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state.isGeneratingSermon ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                        Generate Manuscript
                      </button>
                    )}
                  </div>
                  
                  {state.outline.fullSermon ? (
                    <div className="bg-white rounded-3xl border border-ink/5 p-8 shadow-sm prose prose-ink max-w-none markdown-body">
                      <Markdown>{state.outline.fullSermon}</Markdown>
                    </div>
                  ) : (
                    <div className="bg-ink/5 rounded-3xl border border-dashed border-ink/10 p-12 text-center space-y-4">
                      <ScrollText className="mx-auto text-ink/20" size={48} />
                      <p className="text-ink/40 italic">Generate a complete sermon text based on your seminar outline.</p>
                    </div>
                  )}
                </div>

                {/* Podcast Script Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="serif text-2xl font-bold flex items-center gap-3">
                      <Mic className="text-gold" /> The Roundtable Dialogue
                    </h3>
                    {!state.outline.podcastScript && (
                      <button
                        onClick={handleGeneratePodcastScript}
                        disabled={state.isGeneratingPodcast}
                        className="text-xs uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state.isGeneratingPodcast ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                        Generate Dialogue Script
                      </button>
                    )}
                  </div>
                  
                  {state.outline.podcastScript ? (
                    <div className="bg-white rounded-3xl border border-ink/5 p-8 shadow-sm prose prose-ink max-w-none markdown-body">
                      <Markdown>{state.outline.podcastScript}</Markdown>
                    </div>
                  ) : (
                    <div className="bg-ink/5 rounded-3xl border border-dashed border-ink/10 p-12 text-center space-y-4">
                      <Mic className="mx-auto text-ink/20" size={48} />
                      <p className="text-ink/40 italic">Generate a dynamic panel discussion script for your podcast.</p>
                    </div>
                  )}
                </div>

                {/* Video Teaser Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="serif text-2xl font-bold flex items-center gap-3">
                      <Video className="text-gold" /> Cinematic Prelude
                    </h3>
                    {!videoUrl && (
                      <button
                        onClick={handleGenerateVideoTeaser}
                        disabled={state.isGeneratingVideo}
                        className="text-xs uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state.isGeneratingVideo ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                        Generate Prelude
                      </button>
                    )}
                  </div>
                  
                  {videoUrl ? (
                    <div className="bg-ink rounded-3xl overflow-hidden shadow-2xl aspect-video relative group">
                      <video 
                        src={videoUrl} 
                        controls 
                        className="w-full h-full object-cover"
                        poster="https://picsum.photos/seed/seminar/1920/1080"
                      />
                      <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Play size={48} className="text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-ink/5 rounded-3xl border border-dashed border-ink/10 p-12 text-center space-y-4">
                      <Video className="mx-auto text-ink/20" size={48} />
                      <p className="text-ink/40 italic">Generate a cinematic video teaser to engage your audience on social media.</p>
                    </div>
                  )}
                </div>

                {/* Specialized Prayers Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="serif text-2xl font-bold flex items-center gap-3">
                      <Heart className="text-gold" /> The Intercessor's Guide
                    </h3>
                    {!state.outline.specializedPrayers && (
                      <button
                        onClick={handleGenerateSpecializedPrayers}
                        disabled={state.isGeneratingPrayers}
                        className="text-xs uppercase tracking-widest font-bold text-gold hover:text-gold/80 flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {state.isGeneratingPrayers ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                        Generate Guide
                      </button>
                    )}
                  </div>

                  {state.outline.specializedPrayers ? (
                    <div className="space-y-4">
                      {state.outline.specializedPrayers.map((prayer, pIdx) => (
                        <motion.div 
                          key={pIdx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: pIdx * 0.1 }}
                          className="bg-white rounded-2xl border border-ink/5 p-6 shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-gold bg-gold/5 px-2 py-1 rounded">
                              {prayer.category}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-ink/40 italic">{prayer.scripture}</p>
                          <p className="text-sm text-ink/80 leading-relaxed">"{prayer.prayer}"</p>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-ink/5 rounded-3xl border border-dashed border-ink/10 p-12 text-center space-y-4">
                      <Heart className="mx-auto text-ink/20" size={48} />
                      <p className="text-ink/40 italic">Generate scripture-based prayer points following the spiritual hierarchy.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Action */}
              <div className="pt-12 pb-20 text-center flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={handleExportToWord}
                  className="px-8 py-4 bg-gold text-white rounded-2xl font-bold hover:bg-gold/90 transition-all flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  <FileText size={20} /> Export to Word (.docx)
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-8 py-4 bg-ink text-parchment rounded-2xl font-bold hover:bg-ink/90 transition-all flex items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  <Printer size={20} /> Print Full Seminar Guide
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {state.error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-6 py-3 rounded-full border border-red-100 shadow-lg text-sm font-medium animate-fade-in">
            {state.error}
          </div>
        )}
      </main>

      {/* Tract Detail Modal */}
      <AnimatePresence>
        {selectedTract && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTract(null)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-parchment rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gold/10 text-gold rounded-lg flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <h3 className="serif text-lg font-bold">Full Message</h3>
                </div>
                <button 
                  onClick={() => setSelectedTract(null)}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                <div className="space-y-4">
                  <h2 className="serif text-3xl font-bold leading-tight">{selectedTract.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <a 
                      href={getBibleLink(selectedTract.mainScripture)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] uppercase tracking-widest font-bold text-gold bg-gold/5 px-3 py-1 rounded-full border border-gold/10 hover:bg-gold/10 transition-colors"
                    >
                      {selectedTract.mainScripture}
                    </a>
                    {seminarTitle && (
                      <span className="text-[10px] uppercase tracking-widest font-bold text-ink/40 bg-ink/5 px-3 py-1 rounded-full border border-ink/10">
                        Title: {seminarTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="prose prose-ink max-w-none">
                  <p className="text-ink/80 leading-relaxed text-lg italic serif">
                    {selectedTract.fullText}
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-ink/5">
                  <h4 className="text-xs uppercase tracking-widest font-bold text-ink/40 flex items-center gap-2">
                    <Sparkles size={14} /> Key Prayer Points
                  </h4>
                  <ul className="space-y-3">
                    {selectedTract.prayerPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-ink/70 bg-white p-4 rounded-2xl border border-ink/5">
                        <div className="w-1.5 h-1.5 bg-gold rounded-full mt-1.5 shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t border-ink/5 bg-white/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => handleGenerateTitle(selectedTract)}
                  disabled={isGeneratingTitle || state.isLoading}
                  className="flex items-center gap-2 px-6 py-3 text-gold font-bold hover:bg-gold/5 rounded-2xl transition-all disabled:opacity-50"
                >
                  {isGeneratingTitle ? <Sparkles className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Generate Catchy Title
                </button>
                <button
                  onClick={() => {
                    setTopic(selectedTract.title);
                    setSelectedTract(null);
                    setView('home');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-ink text-parchment rounded-2xl text-sm font-bold hover:bg-ink/90 transition-all shadow-lg"
                >
                  Select for Seminar <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scripture Lookup Modal */}
      <AnimatePresence>
        {showScriptureModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowScriptureModal(false);
                setScriptureSearch('');
                setFoundVerse(null);
              }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-parchment rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gold/10 text-gold rounded-lg flex items-center justify-center">
                    <Search size={16} />
                  </div>
                  <h3 className="serif text-lg font-bold">Scripture Lookup & Decoding</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowScriptureModal(false);
                    setScriptureSearch('');
                    setFoundVerse(null);
                    setAlternativeVerses([]);
                    setScriptureDecoding(null);
                  }}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-center p-1 bg-ink/5 rounded-xl mb-4">
                  <button 
                    onClick={() => setIsManualEntry(false)}
                    className={cn(
                      "flex-grow py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      !isManualEntry ? "bg-white text-gold shadow-sm" : "text-ink/40 hover:text-ink/60"
                    )}
                  >
                    Search API
                  </button>
                  <button 
                    onClick={() => setIsManualEntry(true)}
                    className={cn(
                      "flex-grow py-2 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                      isManualEntry ? "bg-white text-gold shadow-sm" : "text-ink/40 hover:text-ink/60"
                    )}
                  >
                    Manual Entry
                  </button>
                </div>

                {!isManualEntry ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Translation</label>
                      <div className="relative group">
                        <select
                          value={selectedTranslation}
                          onChange={(e) => setSelectedTranslation(e.target.value)}
                          className="w-full bg-white border-2 border-ink/5 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-gold/50 transition-all appearance-none cursor-pointer"
                        >
                          {COMMON_TRANSLATIONS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.id.toUpperCase()})
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink/40">
                          <Languages size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Bible Reference</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={scriptureSearch}
                          onChange={(e) => setScriptureSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleLookupScripture()}
                          placeholder="e.g., John 3:16, Psalm 23"
                          className="flex-grow bg-white border-2 border-ink/5 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-gold/50 transition-all"
                        />
                        <button
                          onClick={handleLookupScripture}
                          disabled={isSearchingScripture || !scriptureSearch.trim()}
                          className="bg-ink text-parchment px-4 rounded-xl hover:bg-ink/90 transition-all disabled:opacity-50"
                        >
                          {isSearchingScripture ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Reference</label>
                      <input
                        type="text"
                        value={manualReference}
                        onChange={(e) => setManualReference(e.target.value)}
                        placeholder="e.g., Genèse 3:8 LSG"
                        className="w-full bg-white border-2 border-ink/5 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-gold/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Scripture Text</label>
                      <textarea
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        placeholder="Paste the verse text here..."
                        rows={3}
                        className="w-full bg-white border-2 border-ink/5 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-gold/50 transition-all resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (manualReference) {
                            setPendingScriptures(prev => [...prev, manualReference]);
                            setManualReference('');
                            setManualText('');
                          }
                        }}
                        disabled={!manualReference || !manualText}
                        className="flex-grow py-3 bg-ink/5 text-ink/60 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-ink/10 transition-all"
                      >
                        <Plus size={18} /> Add to List
                      </button>
                      <button
                        onClick={handleDecodeScripture}
                        disabled={isDecoding || !manualReference || !manualText}
                        className="px-4 py-3 bg-ink text-parchment rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-ink/90 transition-all shadow-md disabled:opacity-50"
                      >
                        {isDecoding ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                        <span>Decode</span>
                      </button>
                    </div>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {!isManualEntry && foundVerse ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      {/* Main Result */}
                      <div className="bg-white p-6 rounded-2xl border border-gold/10 space-y-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <a 
                            href={getBibleLink(foundVerse.reference, foundVerse.translation_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="serif text-xl font-bold text-gold hover:underline"
                          >
                            {foundVerse.reference}
                          </a>
                          <a 
                            href={getVersionLink(foundVerse.translation_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] uppercase tracking-widest font-bold text-ink/40 hover:text-gold transition-colors"
                          >
                            {foundVerse.translation_name}
                          </a>
                        </div>
                        <p className="text-ink/80 leading-relaxed italic">"{foundVerse.text.trim()}"</p>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setPendingScriptures(prev => [...prev, foundVerse.reference]);
                              setFoundVerse(null);
                              setScriptureSearch('');
                            }}
                            className="flex-grow py-3 bg-ink/5 text-ink/60 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-ink/10 transition-all"
                          >
                            <Plus size={18} /> Add to List
                          </button>
                          <button
                            onClick={handleDecodeScripture}
                            disabled={isDecoding}
                            className="px-4 py-3 bg-ink text-parchment rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-ink/90 transition-all shadow-md disabled:opacity-50"
                            title="Deeper Decoding"
                          >
                            {isDecoding ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                            <span className="hidden sm:inline">Decode</span>
                          </button>
                        </div>
                      </div>

                      {/* Pending List */}
                      {pendingScriptures.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-ink/5">
                          <div className="flex items-center justify-between px-2">
                            <h4 className="text-xs uppercase tracking-widest font-bold text-ink/40 flex items-center gap-2">
                              <FileText size={14} /> Selected Scriptures ({pendingScriptures.length})
                            </h4>
                          </div>
                          <div className="space-y-2">
                            {pendingScriptures.map((ref, i) => (
                              <motion.div 
                                key={`${ref}-${i}`}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 bg-white p-3 rounded-xl border border-ink/5 group"
                              >
                                <div className="flex-grow font-medium text-sm text-ink/80">{ref}</div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => movePendingScripture(i, 'up')}
                                    disabled={i === 0}
                                    className="p-1 hover:bg-ink/5 rounded text-ink/40 hover:text-gold disabled:opacity-20"
                                  >
                                    <ChevronRight size={14} className="-rotate-90" />
                                  </button>
                                  <button 
                                    onClick={() => movePendingScripture(i, 'down')}
                                    disabled={i === pendingScriptures.length - 1}
                                    className="p-1 hover:bg-ink/5 rounded text-ink/40 hover:text-gold disabled:opacity-20"
                                  >
                                    <ChevronRight size={14} className="rotate-90" />
                                  </button>
                                  <button 
                                    onClick={() => removePendingScripture(i)}
                                    className="p-1 hover:bg-ink/5 rounded text-ink/40 hover:text-red-500"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                          <button
                            onClick={() => activeSessionId && handleAddMultipleScripturesToSession(activeSessionId, pendingScriptures)}
                            className="w-full py-4 bg-gold text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gold/90 transition-all shadow-lg mt-4"
                          >
                            <Check size={20} /> Confirm & Add All to Session
                          </button>
                        </div>
                      )}

                      {/* Alternative Translations */}
                      {alternativeVerses.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-ink/40 flex items-center gap-2 ml-2">
                            <Languages size={14} /> Alternative Translations
                          </h4>
                          <div className="grid grid-cols-1 gap-3">
                            {alternativeVerses.map((alt, i) => (
                              <div key={i} className="bg-white/50 p-4 rounded-xl border border-ink/5 text-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-gold text-[10px] uppercase tracking-wider">{alt.translation_name}</span>
                                  <button 
                                    onClick={() => setFoundVerse(alt)}
                                    className="text-[10px] text-ink/40 hover:text-gold font-bold transition-colors"
                                  >
                                    Set as Primary
                                  </button>
                                </div>
                                <p className="text-ink/60 italic line-clamp-2">"{alt.text.trim()}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Decoding Result */}
                      {scriptureDecoding && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-gold/5 p-6 rounded-2xl border border-gold/20 space-y-4"
                        >
                          <h4 className="text-xs uppercase tracking-widest font-bold text-gold flex items-center gap-2">
                            <Sparkles size={14} /> Deeper Decoding
                          </h4>
                          <div className="prose prose-sm prose-ink max-w-none text-ink/80 markdown-body">
                            <Markdown>{scriptureDecoding}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : scriptureSearch && !isSearchingScripture && (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-ink/5 rounded-full flex items-center justify-center mx-auto">
                        <Search size={24} className="text-ink/20" />
                      </div>
                      <p className="text-ink/40 italic">Type a reference and search to explore scripture...</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deep Dive Modal */}
      <AnimatePresence>
        {selectedDeepDive && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDeepDive(null)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-parchment rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-ink/5 flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gold/10 text-gold rounded-lg flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <h3 className="serif text-lg font-bold">Deep Dive</h3>
                </div>
                <button 
                  onClick={() => setSelectedDeepDive(null)}
                  className="p-2 hover:bg-ink/5 rounded-full transition-colors text-ink/40"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-widest font-bold text-gold">Talking Point</h4>
                  <p className="serif text-xl font-bold text-ink">{selectedDeepDive.point}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-bold text-ink/40">Detailed Explanation</h4>
                  <div className="prose prose-sm prose-ink max-w-none text-ink/80 leading-relaxed bg-white/50 p-6 rounded-2xl border border-ink/5">
                    <Markdown>{selectedDeepDive.deepDive}</Markdown>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/50 border-t border-ink/5 flex justify-end">
                <button
                  onClick={() => setSelectedDeepDive(null)}
                  className="px-6 py-2 bg-ink text-parchment rounded-xl font-bold hover:bg-ink/90 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Background Decoration */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
