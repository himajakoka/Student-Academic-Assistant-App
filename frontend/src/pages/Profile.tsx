import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  GraduationCap,
  Building,
  Calendar,
  Lock,
  Save,
  Clock,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { profileApi, authApi } from '../services/api';
import { StudentProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const Profile: React.FC = () => {
  const { profile, updateLocalProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    college: '',
    course: '',
    semester: '',
    academic_year: '',
    preferred_study_hours_per_day: 4.0,
    preferred_break_duration_minutes: 15,
    minimum_attendance_target: 75.0,
  });

  // Change Password Form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        college: profile.college || '',
        course: profile.course || '',
        semester: profile.semester || '',
        academic_year: profile.academic_year || '2026-2027',
        preferred_study_hours_per_day: profile.preferred_study_hours_per_day || 4.0,
        preferred_break_duration_minutes: profile.preferred_break_duration_minutes || 15,
        minimum_attendance_target: profile.minimum_attendance_target || 75.0,
      });
    }
  }, [profile]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await profileApi.updateProfile(profileForm);
      updateLocalProfile(updated);
      success('Student profile updated successfully!');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update profile.';
      error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      error('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      error('New password must be at least 6 characters.');
      return;
    }
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      success('Password updated successfully!');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update password.';
      error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
          <User className="w-5 h-5 text-brand-600" />
          <span>Student Profile & Academic Settings</span>
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Manage your personal university credentials, degree program, and daily study targets
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/40 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 to-cyanAccent text-white text-3xl font-black flex items-center justify-center uppercase shadow-lg shadow-brand-500/25">
          {profile?.full_name ? profile.full_name[0] : 'S'}
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold tracking-tight">{profile?.full_name}</h2>
          <p className="text-xs text-cyan-300 font-semibold">{profile?.email}</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2 text-[11px] text-slate-300">
            <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
              {profile?.college}
            </span>
            <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
              {profile?.course}
            </span>
            <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
              {profile?.semester} ({profile?.academic_year})
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Edit Academic Details */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-brand-600" />
            <span>Academic Particulars</span>
          </h3>

          <form onSubmit={handleProfileSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                College / Institution
              </label>
              <input
                type="text"
                value={profileForm.college}
                onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course / Program
              </label>
              <input
                type="text"
                value={profileForm.course}
                onChange={(e) => setProfileForm({ ...profileForm, course: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                <select
                  value={profileForm.semester}
                  onChange={(e) => setProfileForm({ ...profileForm, semester: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="Semester 1">Semester 1</option>
                  <option value="Semester 2">Semester 2</option>
                  <option value="Semester 3">Semester 3</option>
                  <option value="Semester 4">Semester 4</option>
                  <option value="Semester 5">Semester 5</option>
                  <option value="Semester 6">Semester 6</option>
                  <option value="Semester 7">Semester 7</option>
                  <option value="Semester 8">Semester 8</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={profileForm.academic_year}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, academic_year: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Attendance %
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={profileForm.minimum_attendance_target}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      minimum_attendance_target: parseFloat(e.target.value) || 75.0,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Daily Study Target (h)
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={profileForm.preferred_study_hours_per_day}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      preferred_study_hours_per_day: parseFloat(e.target.value) || 4.0,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Saving Changes...' : 'Save Profile Details'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Change Account Password</span>
            </h3>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current_password: e.target.value })
                  }
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password: e.target.value })
                  }
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                  }
                  required
                  minLength={6}
                  placeholder="Repeat new password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>{passwordLoading ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mt-6 text-xs text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700 block mb-1">Security & Encryption:</span>
            Your credentials are protected using salted bcrypt hash iterations. Password verification and authorized context extraction are enforced directly on every private API endpoint.
          </div>
        </div>
      </div>
    </div>
  );
};
