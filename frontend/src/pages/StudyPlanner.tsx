import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  BookOpen,
  Sliders,
  Trash2,
  Check,
} from 'lucide-react';
import { studyPlanApi, subjectsApi } from '../services/api';
import { StudySession, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const StudyPlanner: React.FC = () => {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generator settings modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    days_ahead: 7,
    daily_available_hours: 4.0,
    break_duration_minutes: 15,
  });

  const { success, error, warning } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, subData] = await Promise.all([
        studyPlanApi.getAll(),
        subjectsApi.getAll(),
      ]);
      setSessions(sData);
      setSubjects(subData);
    } catch (err) {
      error('Failed to load study sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await studyPlanApi.generate(generateForm);
      success(res.message);
      if (res.missing_data_warnings && res.missing_data_warnings.length > 0) {
        res.missing_data_warnings.forEach((w: string) => warning(w));
      }
      setGenerateModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to generate study plan.';
      error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleStatus = async (session: StudySession) => {
    try {
      const nextStatus = session.status === 'completed' ? 'scheduled' : 'completed';
      await studyPlanApi.update(session.id, { status: nextStatus });
      success(nextStatus === 'completed' ? 'Session completed!' : 'Session marked scheduled.');
      loadData();
    } catch (err) {
      error('Failed to update session.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this study session?')) return;
    try {
      await studyPlanApi.delete(id);
      success('Session removed.');
      loadData();
    } catch (err) {
      error('Failed to delete session.');
    }
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce((acc, sess) => {
    acc[sess.session_date] = acc[sess.session_date] || [];
    acc[sess.session_date].push(sess);
    return acc;
  }, {} as Record<string, StudySession[]>);

  const sortedDates = Object.keys(groupedSessions).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            <span>AI Study Planner & Workload Balancer</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Class-conflict avoidance, deadline urgency weighting, and targeted weak-subject reinforcement
          </p>
        </div>

        <button
          onClick={() => setGenerateModalOpen(true)}
          className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md shadow-violet-500/20 transition-all flex items-center space-x-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Regenerate Study Plan</span>
        </button>
      </div>

      {/* Explanatory Banner */}
      <div className="bg-violet-50/70 border border-violet-200/80 rounded-2xl p-4 flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <div className="text-xs text-violet-900 leading-relaxed">
          <span className="font-bold">Algorithmic Balance Engine:</span> The planner reads your regular class timetable, upcoming assignment deadlines, test marks, and your desired daily study hours. Sessions are arranged into open evening windows without overlapping scheduled lectures, prioritizing urgent coursework first.
        </div>
      </div>

      {/* Sessions Timeline */}
      {loading ? (
        <LoadingSpinner size="md" label="Loading study plan..." className="py-12" />
      ) : sortedDates.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No study plan generated yet"
          description="Click 'Regenerate Study Plan' to let the engine analyze your timetable and deadlines."
          actionText="Generate Study Plan"
          onAction={() => setGenerateModalOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayName = dateObj.toLocaleDateString([], { weekday: 'long' });
            const prettyDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const daySessions = groupedSessions[dateStr];

            return (
              <div key={dateStr} className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span>{dayName}, {prettyDate}</span>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">
                    {daySessions.length} session{daySessions.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {daySessions.map((session) => (
                    <div
                      key={session.id}
                      className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                        session.status === 'completed'
                          ? 'bg-slate-50 border-slate-200 opacity-70'
                          : 'bg-white border-slate-200/90 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Session Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white uppercase"
                            style={{ backgroundColor: session.subject_color || '#4f46e5' }}
                          >
                            {session.subject_code || 'STUDY'}
                          </span>
                          <span className="text-xs font-bold text-slate-600 flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{session.start_time} - {session.end_time}</span>
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-tight mb-1.5">
                          {session.title}
                        </h4>

                        <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 leading-relaxed border border-slate-100 mb-3">
                          <span className="font-semibold text-slate-700 block mb-0.5">Recommendation Context:</span>
                          {session.recommendation_reason}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleToggleStatus(session)}
                          className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors ${
                            session.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{session.status === 'completed' ? 'Completed' : 'Mark Done'}</span>
                        </button>

                        <button
                          onClick={() => handleDelete(session.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Settings Modal */}
      <Modal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Configure Study Plan Parameters"
      >
        <form onSubmit={handleGeneratePlan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Planning Horizon (Days Ahead)
            </label>
            <select
              value={generateForm.days_ahead}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, days_ahead: parseInt(e.target.value) })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value={3}>Next 3 Days (Weekend Sprint)</option>
              <option value={7}>Next 7 Days (Full Weekly Schedule)</option>
              <option value={14}>Next 14 Days (Exam Period Preparation)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Daily Target Study Hours: <span className="text-brand-600 font-bold">{generateForm.daily_available_hours}h</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={generateForm.daily_available_hours}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, daily_available_hours: parseFloat(e.target.value) })
              }
              className="w-full accent-brand-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1 hour (Light)</span>
              <span>4 hours (Optimal)</span>
              <span>10 hours (Intensive)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Preferred Break Duration Between Blocks
            </label>
            <select
              value={generateForm.break_duration_minutes}
              onChange={(e) =>
                setGenerateForm({
                  ...generateForm,
                  break_duration_minutes: parseInt(e.target.value),
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes (Standard Pomodoro)</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? 'Calculating Schedule...' : 'Generate Optimized Plan'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
