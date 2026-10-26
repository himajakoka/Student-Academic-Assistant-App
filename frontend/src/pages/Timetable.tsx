import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  User,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { timetableApi, subjectsApi } from '../services/api';
import { TimetableEntry, Subject } from '../types';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const Timetable: React.FC = () => {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    subject_id: 0,
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:30',
    classroom: 'Hall 101',
    faculty_name: '',
    notes: '',
  });

  // Subject Form State
  const [newSubject, setNewSubject] = useState({
    name: '',
    code: '',
    faculty: '',
    color: '#4f46e5',
    target_attendance: 75.0,
  });

  const { success, error, warning } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [ttData, subData] = await Promise.all([
        timetableApi.getAll(),
        subjectsApi.getAll(),
      ]);
      setEntries(ttData);
      setSubjects(subData);
      if (subData.length > 0 && formData.subject_id === 0) {
        setFormData((prev) => ({ ...prev, subject_id: subData[0].id }));
      }
    } catch (err) {
      error('Failed to load timetable and subject details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingEntry(null);
    setFormData({
      subject_id: subjects.length > 0 ? subjects[0].id : 0,
      day_of_week: 'Monday',
      start_time: '09:00',
      end_time: '10:30',
      classroom: 'Hall 101',
      faculty_name: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setFormData({
      subject_id: entry.subject_id,
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      classroom: entry.classroom,
      faculty_name: entry.faculty_name || '',
      notes: entry.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.start_time >= formData.end_time) {
      error('Start time must be before end time.');
      return;
    }
    if (!formData.subject_id) {
      error('Please select a subject or create one first.');
      return;
    }

    try {
      if (editingEntry) {
        await timetableApi.update(editingEntry.id, formData);
        success('Class updated successfully!');
      } else {
        await timetableApi.create(formData);
        success('Class added to timetable!');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to save timetable class.';
      error(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;
    try {
      await timetableApi.delete(id);
      success('Class removed.');
      loadData();
    } catch (err) {
      error('Failed to delete class.');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name || !newSubject.code) {
      error('Subject name and code are required.');
      return;
    }
    try {
      const created = await subjectsApi.create(newSubject);
      success(`Subject ${created.name} added!`);
      setSubjectModalOpen(false);
      setNewSubject({
        name: '',
        code: '',
        faculty: '',
        color: '#4f46e5',
        target_attendance: 75.0,
      });
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to create subject.';
      error(msg);
    }
  };

  const filteredEntries =
    selectedDay === 'All'
      ? entries
      : entries.filter((e) => e.day_of_week.toLowerCase() === selectedDay.toLowerCase());

  if (loading) {
    return <LoadingSpinner size="lg" label="Loading timetable schedule..." className="py-24" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <CalendarDays className="w-5 h-5 text-brand-600" />
            <span>Academic Timetable</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your weekly class schedule with automatic conflict detection
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setSubjectModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Subject</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* Day Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {['All', ...DAYS].map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDay === day
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Timetable Grid */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No classes scheduled"
          description={
            selectedDay === 'All'
              ? 'Your timetable is empty. Add your classes to enable schedule planning and conflict detection.'
              : `No classes recorded for ${selectedDay}.`
          }
          actionText="Add a Class"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: entry.subject_color || '#4f46e5' }}
                  >
                    {entry.subject_code || 'CLASS'}
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {entry.day_of_week}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-tight mb-2">
                  {entry.subject_name}
                </h3>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800">
                      {entry.start_time} - {entry.end_time}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{entry.classroom}</span>
                  </div>
                  {entry.faculty_name && (
                    <div className="flex items-center space-x-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{entry.faculty_name}</span>
                    </div>
                  )}
                </div>

                {entry.notes && (
                  <p className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100 italic line-clamp-2">
                    {entry.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  onClick={() => openEditModal(entry)}
                  className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Edit Class"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Delete Class"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Class Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEntry ? 'Edit Class Session' : 'Add New Class Session'}
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Subject *
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

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Day *</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start *</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End *</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Hall</label>
              <input
                type="text"
                value={formData.classroom}
                onChange={(e) => setFormData({ ...formData, classroom: e.target.value })}
                placeholder="e.g. Hall 302"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty Name</label>
              <input
                type="text"
                value={formData.faculty_name}
                onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })}
                placeholder="e.g. Dr. Jenkins"
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
              placeholder="e.g. Bring lab notebook"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
            >
              {editingEntry ? 'Save Changes' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        isOpen={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        title="Add New Course Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              value={newSubject.name}
              onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              placeholder="e.g. Distributed Systems"
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                value={newSubject.code}
                onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CS601"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Badge Color
              </label>
              <input
                type="color"
                value={newSubject.color}
                onChange={(e) => setNewSubject({ ...newSubject, color: e.target.value })}
                className="w-full h-8 rounded-xl cursor-pointer p-0.5 bg-slate-50 border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Faculty Name</label>
            <input
              type="text"
              value={newSubject.faculty}
              onChange={(e) => setNewSubject({ ...newSubject, faculty: e.target.value })}
              placeholder="e.g. Dr. Sarah Jenkins"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="pt-3 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setSubjectModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
            >
              Save Subject
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
