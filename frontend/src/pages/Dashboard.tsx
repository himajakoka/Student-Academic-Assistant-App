import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  TrendingUp,
  BarChart2,
  Plus,
  ArrowRight,
  GraduationCap,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { dashboardApi, tasksApi } from '../services/api';
import { DashboardSummary, Task } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../context/ToastContext';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const summary = await dashboardApi.getSummary();
      setData(summary);
    } catch (err: any) {
      error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleToggleTask = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await tasksApi.updateStatus(task.id, newStatus);
      success(newStatus === 'completed' ? 'Task marked as completed!' : 'Task re-opened.');
      loadDashboard();
    } catch (err) {
      error('Failed to update task status.');
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" label="Preparing your personalized academic briefing..." className="py-24" />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Could not load dashboard"
        description="Unable to connect to the backend database. Please ensure the server is active."
        actionText="Retry"
        onAction={loadDashboard}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting & Date */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Welcome, {data.student_name} 👋
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {data.current_day}, {data.current_date} • {data.college} • {data.semester}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center flex-wrap gap-2">
          <Link
            to="/tasks"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </Link>
          <Link
            to="/attendance"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark Attendance</span>
          </Link>
          <Link
            to="/study-planner"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Plan</span>
          </Link>
        </div>
      </div>

      {/* 2. Daily Briefing Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-start justify-between mb-3 relative z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Daily Academic Briefing</span>
              <span className="text-[10px] text-slate-400 block">
                {data.daily_briefing.is_ai_generated ? 'AI Generated (Gemini Live)' : 'System Grounded Intelligence (Local Mode)'}
              </span>
            </div>
          </div>
          <Link
            to="/ai-assistant"
            className="text-[11px] text-cyan-300 hover:text-white flex items-center space-x-1 font-semibold transition-colors"
          >
            <span>Ask AI</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <p className="text-sm font-medium text-slate-200 leading-relaxed relative z-10 mb-4">
          {data.daily_briefing.summary}
        </p>

        {/* Highlight Bullets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10">
          {data.daily_briefing.highlights.map((item, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <span className="text-xs text-slate-300 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Attendance</span>
            <CheckCircle2 className={`w-4 h-4 ${data.is_attendance_warning ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data.overall_attendance_percentage}%
            </div>
            <p className={`text-[11px] font-medium mt-0.5 ${data.is_attendance_warning ? 'text-amber-600' : 'text-emerald-600'}`}>
              {data.is_attendance_warning ? 'Below 75% target' : 'Safely above target'}
            </p>
          </div>
          <Link to="/attendance" className="mt-3 text-[11px] text-brand-600 font-semibold hover:underline flex items-center justify-between">
            <span>View records</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Active Tasks</span>
            <Clock className="w-4 h-4 text-brand-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data.pending_tasks_count}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {data.completed_tasks_count} completed this term
            </p>
          </div>
          <Link to="/tasks" className="mt-3 text-[11px] text-brand-600 font-semibold hover:underline flex items-center justify-between">
            <span>Open registry</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Overdue Deadlines</span>
            <AlertTriangle className={`w-4 h-4 ${data.overdue_tasks_count > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className={`text-2xl font-black tracking-tight ${data.overdue_tasks_count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {data.overdue_tasks_count}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {data.overdue_tasks_count > 0 ? 'Immediate action needed' : 'All deadlines on track'}
            </p>
          </div>
          <Link to="/tasks" className="mt-3 text-[11px] text-brand-600 font-semibold hover:underline flex items-center justify-between">
            <span>Check urgency</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Performance Average */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Academic Average</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {data.overall_marks_average > 0 ? `${data.overall_marks_average}%` : 'N/A'}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Across recorded tests
            </p>
          </div>
          <Link to="/marks" className="mt-3 text-[11px] text-brand-600 font-semibold hover:underline flex items-center justify-between">
            <span>Analytics & charts</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4. Two Column Layout: Today's Schedule & Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Timetable */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Today's Class Schedule</h2>
            </div>
            <Link to="/timetable" className="text-xs font-semibold text-brand-600 hover:underline">
              Weekly grid
            </Link>
          </div>

          <div className="flex-1 space-y-2.5">
            {data.todays_classes.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl">
                No classes scheduled for today ({data.current_day}).
              </div>
            ) : (
              data.todays_classes.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-2.5 h-10 rounded-full"
                      style={{ backgroundColor: cls.subject_color || '#4f46e5' }}
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {cls.subject_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cls.classroom} • {cls.faculty_name || 'Faculty'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">
                      {cls.start_time} - {cls.end_time}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {cls.subject_code}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Priority Urgent Tasks */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Urgent Tasks & Exams</h2>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-brand-600 hover:underline">
              All tasks
            </Link>
          </div>

          <div className="flex-1 space-y-2.5">
            {data.upcoming_tasks.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl">
                No active pending tasks.
              </div>
            ) : (
              data.upcoming_tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => handleToggleTask(task)}
                      className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold truncate leading-tight ${
                          task.status === 'completed'
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {task.subject_name || 'General'} • Due {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right ml-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider block ${
                        task.is_overdue
                          ? 'bg-rose-100 text-rose-700'
                          : task.priority === 'urgent'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {task.is_overdue ? 'Overdue' : task.priority}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Score: {task.priority_score}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Today's Recommended Study Plan */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-slate-900">Today's Study Plan Sessions</h2>
          </div>
          <Link to="/study-planner" className="text-xs font-semibold text-brand-600 hover:underline">
            Manage workload
          </Link>
        </div>

        {data.todays_study_sessions.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-2xl">
            No study sessions scheduled for today yet. Use the Study Planner to generate your schedule.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.todays_study_sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-indigo-700 font-semibold mb-1">
                    <span>{sess.start_time} - {sess.end_time}</span>
                    <span>{sess.duration_minutes} min</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight mb-1">
                    {sess.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                    {sess.recommendation_reason}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-indigo-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-indigo-900">{sess.subject_name || 'Revision'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white text-indigo-600 font-bold border border-indigo-200">
                    {sess.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
