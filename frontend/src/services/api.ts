import axios from 'axios';
import {
  StudentProfile,
  UserPreference,
  Subject,
  TimetableEntry,
  Task,
  AttendanceRecord,
  OverallAttendanceSummary,
  Assessment,
  PerformanceAnalytics,
  StudySession,
  VaultDocument,
  ChatMessage,
  ChatConversation,
  NotificationItem,
  DashboardSummary,
  GlobalSearchResponse,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and let App/ProtectedRoute redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (credentials: any) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (data: any) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  changePassword: async (data: any) => {
    const res = await api.post('/auth/change-password', data);
    return res.data;
  },
  getMe: async (): Promise<StudentProfile> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const profileApi = {
  getProfile: async (): Promise<StudentProfile> => {
    const res = await api.get('/profile');
    return res.data;
  },
  updateProfile: async (data: Partial<StudentProfile>): Promise<StudentProfile> => {
    const res = await api.put('/profile', data);
    return res.data;
  },
  getPreferences: async (): Promise<UserPreference> => {
    const res = await api.get('/profile/preferences');
    return res.data;
  },
  updatePreferences: async (data: Partial<UserPreference>): Promise<UserPreference> => {
    const res = await api.put('/profile/preferences', data);
    return res.data;
  },
};

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await api.get('/dashboard');
    return res.data;
  },
};

export const subjectsApi = {
  getAll: async (): Promise<Subject[]> => {
    const res = await api.get('/subjects');
    return res.data;
  },
  create: async (data: Partial<Subject>): Promise<Subject> => {
    const res = await api.post('/subjects', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Subject>): Promise<Subject> => {
    const res = await api.put(`/subjects/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/subjects/${id}`);
  },
};

export const timetableApi = {
  getAll: async (day?: string): Promise<TimetableEntry[]> => {
    const res = await api.get('/timetable', { params: { day } });
    return res.data;
  },
  getToday: async (): Promise<TimetableEntry[]> => {
    const res = await api.get('/timetable/today');
    return res.data;
  },
  checkConflict: async (data: any) => {
    const res = await api.post('/timetable/check-conflict', data);
    return res.data;
  },
  create: async (data: Partial<TimetableEntry>): Promise<TimetableEntry> => {
    const res = await api.post('/timetable', data);
    return res.data;
  },
  update: async (id: number, data: Partial<TimetableEntry>): Promise<TimetableEntry> => {
    const res = await api.put(`/timetable/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/timetable/${id}`);
  },
};

export const tasksApi = {
  getAll: async (params?: any): Promise<Task[]> => {
    const res = await api.get('/tasks', { params });
    return res.data;
  },
  getOne: async (id: number): Promise<Task> => {
    const res = await api.get(`/tasks/${id}`);
    return res.data;
  },
  create: async (data: Partial<Task>): Promise<Task> => {
    const res = await api.post('/tasks', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Task>): Promise<Task> => {
    const res = await api.put(`/tasks/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: number, status: string): Promise<Task> => {
    const res = await api.patch(`/tasks/${id}/status`, { status });
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },
};

export const attendanceApi = {
  getSummary: async (): Promise<OverallAttendanceSummary> => {
    const res = await api.get('/attendance/summary');
    return res.data;
  },
  getRecords: async (params?: any): Promise<AttendanceRecord[]> => {
    const res = await api.get('/attendance', { params });
    return res.data;
  },
  record: async (data: Partial<AttendanceRecord>): Promise<AttendanceRecord> => {
    const res = await api.post('/attendance', data);
    return res.data;
  },
  deleteRecord: async (id: number): Promise<void> => {
    await api.delete(`/attendance/${id}`);
  },
};

export const marksApi = {
  getAll: async (subject_id?: number): Promise<Assessment[]> => {
    const res = await api.get('/marks', { params: { subject_id } });
    return res.data;
  },
  getAnalytics: async (): Promise<PerformanceAnalytics> => {
    const res = await api.get('/marks/analytics');
    return res.data;
  },
  create: async (data: Partial<Assessment>): Promise<Assessment> => {
    const res = await api.post('/marks', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Assessment>): Promise<Assessment> => {
    const res = await api.put(`/marks/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/marks/${id}`);
  },
};

export const studyPlanApi = {
  getAll: async (params?: any): Promise<StudySession[]> => {
    const res = await api.get('/study-plan', { params });
    return res.data;
  },
  generate: async (data: { days_ahead?: number; daily_available_hours?: number; break_duration_minutes?: number; target_date?: string }) => {
    const res = await api.post('/study-plan/generate', data);
    return res.data;
  },
  create: async (data: Partial<StudySession>): Promise<StudySession> => {
    const res = await api.post('/study-plan', data);
    return res.data;
  },
  update: async (id: number, data: Partial<StudySession>): Promise<StudySession> => {
    const res = await api.put(`/study-plan/${id}`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/study-plan/${id}`);
  },
};

export const documentsApi = {
  getAll: async (category?: string, subject_id?: number): Promise<VaultDocument[]> => {
    const res = await api.get('/documents', { params: { category, subject_id } });
    return res.data;
  },
  upload: async (formData: FormData): Promise<VaultDocument> => {
    const res = await api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getDetails: async (id: number) => {
    const res = await api.get(`/documents/${id}`);
    return res.data;
  },
  downloadUrl: (id: number) => `${API_BASE_URL}/documents/${id}/download`,
  delete: async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
};

export const chatApi = {
  getConversations: async (): Promise<ChatConversation[]> => {
    const res = await api.get('/chat/conversations');
    return res.data;
  },
  createConversation: async (title?: string): Promise<ChatConversation> => {
    const res = await api.post('/chat/conversations', { title });
    return res.data;
  },
  getConversationDetail: async (id: number): Promise<ChatConversation> => {
    const res = await api.get(`/chat/conversations/${id}`);
    return res.data;
  },
  deleteConversation: async (id: number): Promise<void> => {
    await api.delete(`/chat/conversations/${id}`);
  },
  sendMessage: async (data: { message: string; conversation_id?: number }): Promise<ChatMessage> => {
    const res = await api.post('/chat/message', data);
    return res.data;
  },
};

export const notificationsApi = {
  getAll: async (): Promise<NotificationItem[]> => {
    const res = await api.get('/notifications');
    return res.data;
  },
  markRead: async (id: number): Promise<NotificationItem> => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.post('/notifications/mark-all-read');
    return res.data;
  },
};

export const searchApi = {
  search: async (q: string): Promise<GlobalSearchResponse> => {
    const res = await api.get('/search', { params: { q } });
    return res.data;
  },
};

export default api;
