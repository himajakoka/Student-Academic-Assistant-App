import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { tasksApi, subjectsApi } from '../services/api';
import { Task, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('urgency');

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject_id: undefined as number | undefined,
    task_type: 'assignment' as 'assignment' | 'examination' | 'project' | 'revision' | 'personal',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    estimated_effort_minutes: 60,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });

  const { success, error } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [tData, sData] = await Promise.all([
        tasksApi.getAll({ sort_by: sortBy }),
        subjectsApi.getAll(),
      ]);
      setTasks(tData);
      setSubjects(sData);
    } catch (err) {
      error('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sortBy]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      subject_id: subjects.length > 0 ? subjects[0].id : undefined,
      task_type: 'assignment',
      due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
      estimated_effort_minutes: 60,
      priority: 'medium',
    });
    setModalOpen(true);
  };

  const openEditModal = (t: Task) => {
    setEditingTask(t);
    setFormData({
      title: t.title,
      description: t.description || '',
      subject_id: t.subject_id,
      task_type: t.task_type,
      due_date: new Date(t.due_date).toISOString().slice(0, 16),
      estimated_effort_minutes: t.estimated_effort_minutes,
      priority: t.priority,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      error('Task title is required.');
      return;
    }
    try {
      if (editingTask) {
        await tasksApi.update(editingTask.id, formData);
        success('Task updated!');
      } else {
        await tasksApi.create(formData);
        success('Task created successfully!');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save task.';
      error(msg);
    }
  };

  const handleToggleStatus = async (task: Task) => {
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      await tasksApi.updateStatus(task.id, nextStatus);
      success(nextStatus === 'completed' ? 'Marked task as completed!' : 'Task reopened.');
      loadData();
    } catch (err) {
      error('Failed to update status.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await tasksApi.delete(id);
      success('Task deleted.');
      loadData();
    } catch (err) {
      error('Failed to delete task.');
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (typeFilter !== 'all' && t.task_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchSubj = t.subject_name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchSubj) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-brand-600" />
            <span>Tasks, Assignments & Examinations</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Deterministic urgency scoring, intelligent priority calculations & deadline tracking
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Task / Exam</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, exams, subjects..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="assignment">Assignment</option>
            <option value="examination">Examination</option>
            <option value="project">Project</option>
            <option value="revision">Revision</option>
            <option value="personal">Personal</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none"
          >
            <option value="urgency">Sort by Urgency</option>
            <option value="priority_score">Sort by Score</option>
            <option value="due_date">Sort by Due Date</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <LoadingSpinner size="md" label="Loading tasks..." className="py-12" />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks match your filter"
          description="Create a new assignment or examination to begin tracking your academic workload."
          actionText="Create Task"
          onAction={openCreateModal}
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded-2xl p-4 border transition-all shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                task.status === 'completed'
                  ? 'border-slate-100 opacity-75'
                  : task.is_overdue
                  ? 'border-rose-200 bg-rose-50/20'
                  : 'border-slate-200/80'
              }`}
            >
              {/* Left Column: Checkbox, Title, Details */}
              <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => handleToggleStatus(task)}
                  className="mt-1 w-5 h-5 rounded-md text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        task.status === 'completed'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>

                    {/* Task Type Badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                      {task.task_type}
                    </span>

                    {/* Subject Pill */}
                    {task.subject_name && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: task.subject_color || '#4f46e5' }}
                      >
                        {task.subject_name}
                      </span>
                    )}

                    {/* Overdue Badge */}
                    {task.is_overdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>OVERDUE</span>
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Priority Reason Grounding */}
                  {task.priority_reason && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-brand-500 shrink-0" />
                      <span className="italic">{task.priority_reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Priority Score & Due Date */}
              <div className="flex items-center justify-between md:justify-end space-x-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        task.priority === 'urgent'
                          ? 'bg-amber-100 text-amber-800'
                          : task.priority === 'high'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {task.priority}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Score: {task.priority_score}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-end space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {new Date(task.due_date).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>({task.estimated_effort_minutes}m effort)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 pl-2">
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100"
                    title="Edit task"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Task or Exam' : 'Create Task / Examination'}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Distributed Consensus Implementation"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Notes, requirements, lab specifications..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <select
                value={formData.subject_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    subject_id: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="">(None / General)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Task Type</label>
              <select
                value={formData.task_type}
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="assignment">Assignment</option>
                <option value="examination">Examination</option>
                <option value="project">Project</option>
                <option value="revision">Revision</option>
                <option value="personal">Personal Task</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date & Time *</label>
              <input
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Estimated Effort (minutes)
            </label>
            <input
              type="number"
              min={15}
              max={1440}
              step={15}
              value={formData.estimated_effort_minutes}
              onChange={(e) =>
                setFormData({ ...formData, estimated_effort_minutes: parseInt(e.target.value) || 60 })
              }
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
              {editingTask ? 'Save Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
