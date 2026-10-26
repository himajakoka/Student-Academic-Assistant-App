import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  XCircle,
  Clock,
  Filter,
  Trash2,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { attendanceApi, subjectsApi } from '../services/api';
import { OverallAttendanceSummary, AttendanceRecord, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const Attendance: React.FC = () => {
  const [summary, setSummary] = useState<OverallAttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSubjectId, setFilterSubjectId] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject_id: 0,
    date: new Date().toISOString().slice(0, 10),
    status: 'present' as 'present' | 'absent' | 'leave',
    notes: '',
  });

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumData, recData, subData] = await Promise.all([
        attendanceApi.getSummary(),
        attendanceApi.getRecords({ subject_id: filterSubjectId, status_filter: filterStatus === 'all' ? undefined : filterStatus }),
        subjectsApi.getAll(),
      ]);
      setSummary(sumData);
      setRecords(recData);
      setSubjects(subData);
      if (subData.length > 0 && formData.subject_id === 0) {
        setFormData((prev) => ({ ...prev, subject_id: subData[0].id }));
      }
    } catch (err) {
      error('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterSubjectId, filterStatus]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject_id) {
      error('Please select a subject.');
      return;
    }
    try {
      await attendanceApi.record(formData);
      success('Attendance recorded!');
      setLogModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to log attendance.';
      error(msg);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm('Delete this attendance entry?')) return;
    try {
      await attendanceApi.deleteRecord(id);
      success('Entry removed.');
      loadData();
    } catch (err) {
      error('Failed to delete attendance record.');
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" label="Computing attendance percentages..." className="py-24" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <ClipboardCheck className="w-5 h-5 text-brand-600" />
            <span>Attendance Management</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Subject-wise logs, shortage warnings, and target attainment calculations
          </p>
        </div>

        <button
          onClick={() => setLogModalOpen(true)}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log Class Attendance</span>
        </button>
      </div>

      {/* Overall Attendance Card */}
      {summary && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            {/* Visual Circular Gauge */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={`${
                    summary.is_warning ? 'text-amber-500' : 'text-emerald-500'
                  } transition-all duration-1000 ease-out`}
                  strokeDasharray={`${summary.overall_percentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-black text-slate-900 block leading-tight">
                  {summary.overall_percentage}%
                </span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Total</span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Cumulative Attendance Status
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                Attended <span className="font-bold text-slate-800">{summary.total_present}</span> of{' '}
                <span className="font-bold text-slate-800">{summary.total_conducted}</span> eligible conducted classes. Target threshold is{' '}
                <span className="font-bold text-brand-600">{summary.target_percentage}%</span>.
              </p>
              {summary.is_warning && (
                <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Overall attendance is below the minimum prescribed threshold.</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-bold text-emerald-800 uppercase">Present</span>
              <div className="text-lg font-black text-emerald-700">{summary.total_present}</div>
            </div>
            <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-bold text-rose-800 uppercase">Absent</span>
              <div className="text-lg font-black text-rose-700">{summary.total_absent}</div>
            </div>
            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3 text-center">
              <span className="text-[10px] font-bold text-amber-800 uppercase">Leave</span>
              <div className="text-lg font-black text-amber-700">{summary.total_leave}</div>
            </div>
          </div>
        </div>
      )}

      {/* Subject-Wise Summary Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">Subject-Wise Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary?.subject_summaries.map((sub) => (
            <div
              key={sub.subject_id}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: sub.color || '#4f46e5' }}
                  >
                    {sub.subject_code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                      sub.status === 'safe'
                        ? 'bg-emerald-100 text-emerald-800'
                        : sub.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-tight mb-2">
                  {sub.subject_name}
                </h4>

                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-2xl font-black text-slate-900">{sub.percentage}%</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {sub.present_count} / {sub.total_classes} attended
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full ${
                      sub.status === 'safe'
                        ? 'bg-emerald-500'
                        : sub.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, sub.percentage)}%` }}
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-600 border border-slate-100 leading-relaxed">
                  <span className="font-bold text-slate-700 block mb-0.5">Calculated Status:</span>
                  {sub.explanation}
                </div>
              </div>

              {sub.classes_needed_for_target > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] font-semibold text-rose-700">
                  Target: Attend next {sub.classes_needed_for_target} classes consecutively
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Attendance History Log Table */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Attendance Log History</h3>

          {/* Table Filters */}
          <div className="flex items-center space-x-2 text-xs">
            <select
              value={filterSubjectId || ''}
              onChange={(e) =>
                setFilterSubjectId(e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
            </select>
          </div>
        </div>

        {records.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">
            No attendance entries recorded matching the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{r.date}</td>
                    <td className="py-2.5 px-3 text-slate-700">{r.subject_name} ({r.subject_code})</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          r.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'absent'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'present' && <CheckCircle2 className="w-3 h-3" />}
                        {r.status === 'absent' && <XCircle className="w-3 h-3" />}
                        {r.status === 'leave' && <Clock className="w-3 h-3" />}
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 italic">{r.notes || '-'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDeleteRecord(r.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Attendance Modal */}
      <Modal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Log Class Attendance"
      >
        <form onSubmit={handleRecordSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Course Subject *
            </label>
            <select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: parseInt(e.target.value) })}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="leave">Approved Leave</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Attended lecture and lab session"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setLogModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm"
            >
              Save Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
