import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Plus,
  TrendingUp,
  AlertTriangle,
  Award,
  Trash2,
  Edit2,
  BookOpen,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { marksApi, subjectsApi } from '../services/api';
import { Assessment, PerformanceAnalytics, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const MarksAnalytics: React.FC = () => {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [formData, setFormData] = useState({
    subject_id: 0,
    assessment_name: '',
    assessment_type: 'quiz',
    marks_obtained: 18.0,
    maximum_marks: 20.0,
    assessment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [allAss, ana, subData] = await Promise.all([
        marksApi.getAll(),
        marksApi.getAnalytics(),
        subjectsApi.getAll(),
      ]);
      setAssessments(allAss);
      setAnalytics(ana);
      setSubjects(subData);
      if (subData.length > 0 && formData.subject_id === 0) {
        setFormData((prev) => ({ ...prev, subject_id: subData[0].id }));
      }
    } catch (err) {
      error('Failed to load marks and performance analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingAssessment(null);
    setFormData({
      subject_id: subjects.length > 0 ? subjects[0].id : 0,
      assessment_name: '',
      assessment_type: 'quiz',
      marks_obtained: 18.0,
      maximum_marks: 20.0,
      assessment_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (a: Assessment) => {
    setEditingAssessment(a);
    setFormData({
      subject_id: a.subject_id,
      assessment_name: a.assessment_name,
      assessment_type: a.assessment_type,
      marks_obtained: a.marks_obtained,
      maximum_marks: a.maximum_marks,
      assessment_date: a.assessment_date,
      notes: a.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assessment_name) {
      error('Assessment name is required.');
      return;
    }
    if (formData.marks_obtained > formData.maximum_marks) {
      error('Marks obtained cannot exceed maximum marks.');
      return;
    }
    try {
      if (editingAssessment) {
        await marksApi.update(editingAssessment.id, formData);
        success('Assessment score updated!');
      } else {
        await marksApi.create(formData);
        success('Assessment score recorded!');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save assessment.';
      error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this evaluation record?')) return;
    try {
      await marksApi.delete(id);
      success('Record deleted.');
      loadData();
    } catch (err) {
      error('Failed to delete assessment.');
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" label="Computing academic performance analytics..." className="py-24" />;
  }

  // Data for Subject Performance Bar Chart
  const chartData = (analytics?.subject_performance || []).map((s) => ({
    name: s.subject_code,
    average: s.average_percentage,
    highest: s.highest_percentage,
    color: s.color,
  }));

  // Historical Timeline Chart
  const timelineData = [...assessments].reverse().map((a, idx) => ({
    name: `${a.subject_code} (${a.assessment_type})`,
    percentage: a.percentage,
    date: a.assessment_date,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            <span>Marks & Academic Performance Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Subject averages, historical assessment trajectory, and explainable insight generation
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Assessment Score</span>
        </button>
      </div>

      {/* Top Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Cumulative Average</span>
            <div className="text-2xl font-black text-slate-900">
              {analytics?.overall_average ? `${analytics.overall_average}%` : 'N/A'}
            </div>
            <span className="text-[11px] text-slate-400">
              Across {analytics?.total_assessments || 0} recorded assessments
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Strongest Performance</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {analytics?.subject_performance && analytics.subject_performance.length > 0
                ? `${
                    [...analytics.subject_performance].sort(
                      (a, b) => b.average_percentage - a.average_percentage
                    )[0]?.subject_name
                  }`
                : 'No scores recorded'}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              Highest average recorded
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500">Target Focus Areas</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {analytics?.weak_subjects && analytics.weak_subjects.length > 0
                ? analytics.weak_subjects.join(', ')
                : 'None! All subjects >= 65%'}
            </div>
            <span className="text-[11px] text-amber-600 font-semibold">
              Prioritized in Study Planner
            </span>
          </div>
        </div>
      </div>

      {/* Explainable Performance Insights Banner */}
      {analytics?.insights && analytics.insights.length > 0 && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg border border-slate-800">
          <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">
            <Info className="w-4 h-4" />
            <span>Explainable Academic Insights</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {analytics.insights.map((ins, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-slate-200 leading-relaxed flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recharts Analytics Charts */}
      {assessments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subject Average Comparison */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Subject Averages Comparison (%)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="average" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Average Score %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Assessment Trajectory */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
              Assessment Score Trajectory (%)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="percentage"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#06b6d4' }}
                    name="Test Score %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Scores Table */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Recorded Assessment Evaluations</h3>

        {assessments.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No assessments recorded"
            description="Add your quizzes, midterms, and lab assignments to generate performance trends."
            actionText="Record First Score"
            onAction={openCreateModal}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Assessment</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Marks Obtained</th>
                  <th className="py-2.5 px-3">Percentage</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500">{a.assessment_date}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {a.subject_name} ({a.subject_code})
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">{a.assessment_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {a.assessment_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {a.marks_obtained} / {a.maximum_marks}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          a.percentage >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.percentage >= 65
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {a.percentage}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => openEditModal(a)}
                          className="p-1 text-slate-400 hover:text-brand-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Assessment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAssessment ? 'Edit Assessment Result' : 'Record Assessment Evaluation'}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assessment Name *
            </label>
            <input
              type="text"
              value={formData.assessment_name}
              onChange={(e) => setFormData({ ...formData, assessment_name: e.target.value })}
              placeholder="e.g. Mid-Semester Exam"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
              <select
                value={formData.assessment_type}
                onChange={(e) => setFormData({ ...formData, assessment_type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="quiz">Quiz / Class Test</option>
                <option value="midterm">Midterm Examination</option>
                <option value="final">Final Examination</option>
                <option value="assignment">Assignment / Report</option>
                <option value="practical">Lab / Practical Exam</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.assessment_date}
                onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marks Obtained *
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={formData.marks_obtained}
                onChange={(e) =>
                  setFormData({ ...formData, marks_obtained: parseFloat(e.target.value) || 0 })
                }
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Maximum Marks *
              </label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={formData.maximum_marks}
                onChange={(e) =>
                  setFormData({ ...formData, maximum_marks: parseFloat(e.target.value) || 100 })
                }
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Scored full in Section B"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm"
            >
              {editingAssessment ? 'Save Changes' : 'Record Score'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
