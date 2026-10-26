import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  Key,
  ShieldAlert,
  Save,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { profileApi } from '../services/api';
import { UserPreference } from '../types';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const Settings: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const data = await profileApi.getPreferences();
      setPrefs(data);
    } catch (err) {
      error('Failed to load user preferences.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    try {
      await profileApi.updatePreferences(prefs);
      success('Preferences updated successfully!');
    } catch (err) {
      error('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="md" label="Loading application settings..." className="py-16" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <SettingsIcon className="w-5 h-5 text-brand-600" />
          <span>System & Assistant Preferences</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Configure notifications, local assistant behavior, and application parameters
        </p>
      </div>

      {prefs && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Notification & Threshold Preferences */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Bell className="w-4 h-4 text-brand-600" />
              <span>Academic Alerts & Timers</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attendance Warning Threshold (%): <span className="text-brand-600 font-bold">{prefs.attendance_warning_threshold}%</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={prefs.attendance_warning_threshold}
                  onChange={(e) =>
                    setPrefs({ ...prefs, attendance_warning_threshold: parseFloat(e.target.value) })
                  }
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Generates warnings if attendance drops below this figure.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deadline Alert Horizon: <span className="text-brand-600 font-bold">{prefs.reminder_hours_before_deadline}h</span>
                </label>
                <input
                  type="range"
                  min={6}
                  max={72}
                  step={6}
                  value={prefs.reminder_hours_before_deadline}
                  onChange={(e) =>
                    setPrefs({ ...prefs, reminder_hours_before_deadline: parseInt(e.target.value) })
                  }
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Sends advance notification before assignments and exams fall due.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center space-x-3">
              <input
                type="checkbox"
                id="autoStudy"
                checked={prefs.auto_generate_study_plans}
                onChange={(e) =>
                  setPrefs({ ...prefs, auto_generate_study_plans: e.target.checked })
                }
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <label htmlFor="autoStudy" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Automatically refresh study schedules when new coursework deadlines are created
              </label>
            </div>
          </div>

          {/* AI & Local Demo Mode Status */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-brand-600" />
              <span>AI Integration & Local Demo Status</span>
            </h3>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">AI Engine Mode:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  Dual-Mode (Gemini API with Grounded Local Fallback)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Database Engine:</span>
                <span className="text-slate-600 font-mono text-[11px]">SQLite (Local Dev) • PostgreSQL Ready</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Document Parsing & OCR:</span>
                <span className="text-slate-600 font-mono text-[11px]">pypdf Native Extraction + Chunk Indexing</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Voice Assistant:</span>
                <span className="text-slate-600 font-mono text-[11px]">Web Speech API (STT & TTS)</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              If an external <code className="text-brand-600 bg-slate-100 px-1 py-0.5 rounded">GEMINI_API_KEY</code> is configured in <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">.env</code>, live generative intelligence will formulate answers. If no key is set or the service is offline, the assistant automatically switches to **Grounded Local Demo Mode**, querying your real saved timetable, attendance records, tasks, and document notes with zero fake data.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Preferences'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
