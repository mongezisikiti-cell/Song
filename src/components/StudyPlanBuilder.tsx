import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Sparkles, 
  Loader2, 
  ChevronRight, 
  BookMarked, 
  MessageSquare, 
  Save, 
  Download,
  Trash2,
  Clock,
  ArrowRight,
  Plus,
  X,
  Edit2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { generateStudyPlan } from '../services/gemini';
import { StudyPlan, StudyDay } from '../types';
import { cn } from '../lib/utils';
import { exportToWord } from '../lib/export-utils';

interface StudyPlanBuilderProps {
  onSave: (plan: StudyPlan) => void;
  initialPlan?: StudyPlan | null;
}

export default function StudyPlanBuilder({ onSave, initialPlan }: StudyPlanBuilderProps) {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(initialPlan || null);
  const [editingDay, setEditingDay] = useState<number | null>(null);

  React.useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
    }
  }, [initialPlan]);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    try {
      const generated = await generateStudyPlan(topic, duration);
      const fullPlan: StudyPlan = {
        id: crypto.randomUUID(),
        title: generated.title || `Study Plan: ${topic}`,
        description: generated.description || '',
        durationDays: duration,
        days: generated.days || [],
        createdAt: new Date().toISOString()
      };
      setPlan(fullPlan);
    } catch (err) {
      console.error('Failed to generate study plan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateNotes = (dayNumber: number, notes: string) => {
    if (!plan) return;
    const updatedDays = plan.days.map(d => 
      d.day === dayNumber ? { ...d, personalNotes: notes } : d
    );
    setPlan({ ...plan, days: updatedDays });
  };

  const handleExport = () => {
    if (!plan) return;
    // We can reuse the export utility or create a specific one
    // For now, let's just trigger a download of a JSON or similar, 
    // or try to adapt the Word export if possible.
    // The current exportToWord expects SeminarOutline. 
    // I'll stick to a simple print/save for now or implement a specific export later if needed.
    alert('Study plan saved to local storage!');
    onSave(plan);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white p-8 rounded-[2.5rem] border border-ink/5 shadow-sm space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="serif text-3xl font-bold italic">Create a Study Plan</h2>
            <p className="text-ink/60">Structured spiritual journeys for daily growth.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Topic or Book of the Bible</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Fruit of the Spirit, Ephesians, Dealing with Anxiety"
              className="w-full bg-parchment/50 border-2 border-ink/5 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-gold/30 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest font-bold text-ink/40 ml-2">Duration (Days)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="3"
                max="30"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="flex-grow accent-gold h-2 bg-ink/5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-12 text-center font-bold text-lg text-gold">{duration}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isLoading || !topic.trim()}
          className="w-full py-5 bg-ink text-parchment rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gold transition-all shadow-xl disabled:opacity-50 group"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <Sparkles className="group-hover:rotate-12 transition-transform" size={24} />
              <span>Generate Study Plan</span>
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="serif text-4xl font-bold italic">{plan.title}</h2>
              <p className="text-ink/60 max-w-2xl mx-auto">{plan.description}</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-ink/5 rounded-xl text-sm font-bold hover:bg-gold hover:text-white transition-all shadow-sm"
                >
                  <Save size={18} /> Save Plan
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {plan.days.map((day) => (
                <div key={day.day} className="bg-white rounded-[2rem] border border-ink/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                    <div className="md:w-1/4">
                      <div className="bg-gold/10 text-gold px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest inline-block mb-3">
                        Day {day.day}
                      </div>
                      <h3 className="serif text-2xl font-bold mb-4">{day.title}</h3>
                      <div className="bg-parchment p-4 rounded-xl border border-ink/5">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-ink/40 mb-1">Daily Passage</div>
                        <div className="text-gold font-bold flex items-center gap-2">
                          <BookMarked size={16} />
                          {day.passage}
                        </div>
                      </div>
                    </div>

                    <div className="md:w-3/4 space-y-6">
                      <div className="prose prose-sm max-w-none">
                        <h4 className="text-xs uppercase tracking-widest font-black text-ink/20 mb-4">Summary & Insights</h4>
                        <div className="text-ink/80 leading-relaxed italic border-l-4 border-gold/20 pl-6 text-lg">
                          {day.summary}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-xs uppercase tracking-widest font-black text-ink/20">Reflection Questions</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {day.reflectionQuestions.map((q, idx) => (
                            <div key={idx} className="flex gap-3 items-start bg-ink/[0.02] p-4 rounded-xl text-sm text-ink/60 italic hover:bg-gold/5 transition-colors">
                              <span className="w-6 h-6 rounded-full bg-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-ink/20 shadow-sm border border-ink/5">{idx + 1}</span>
                              <p className="leading-snug">{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-ink/5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs uppercase tracking-widest font-black text-ink/20 flex items-center gap-2">
                            <Edit2 size={12} /> My Personal Notes
                          </h4>
                          {editingDay === day.day ? (
                            <button onClick={() => setEditingDay(null)} className="text-[10px] uppercase tracking-widest font-bold text-gold hover:underline">Finished Recording</button>
                          ) : (
                            <button onClick={() => setEditingDay(day.day)} className="text-[10px] uppercase tracking-widest font-bold text-ink/40 hover:text-gold transition-colors">Add Reflections</button>
                          )}
                        </div>
                        
                        {editingDay === day.day ? (
                          <textarea
                            autoFocus
                            value={day.personalNotes || ''}
                            onChange={(e) => handleUpdateNotes(day.day, e.target.value)}
                            placeholder="Record what God is speaking to you through this passage..."
                            className="w-full bg-parchment border-2 border-gold/20 rounded-xl p-4 text-sm focus:outline-none focus:border-gold transition-all min-h-[120px] shadow-inner"
                          />
                        ) : (
                          <div 
                            onClick={() => setEditingDay(day.day)}
                            className="bg-parchment/50 p-4 rounded-xl text-xs text-ink/40 italic cursor-text min-h-[60px] border border-dashed border-ink/10 flex items-center justify-center hover:bg-parchment transition-colors"
                          >
                            {day.personalNotes || "Click to add your personal reflections and notes..."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
