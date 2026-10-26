export interface User {
  id: number;
  email: string;
  full_name: string;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  college?: string;
  course?: string;
  semester?: string;
  academic_year?: string;
  avatar_url?: string;
  preferred_study_hours_per_day: number;
  preferred_break_duration_minutes: number;
  minimum_attendance_target: number;
}

export interface UserPreference {
  theme: string;
  attendance_warning_threshold: number;
  email_notifications: boolean;
  sound_enabled: boolean;
  reminder_hours_before_deadline: number;
  auto_generate_study_plans: boolean;
}

export interface Subject {
  id: number;
  user_id: number;
  name: string;
  code: string;
  faculty?: string;
  semester?: string;
  color: string;
  target_attendance: number;
  created_at: string;
}

export interface TimetableEntry {
  id: number;
  user_id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  subject_color?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  classroom: string;
  faculty_name?: string;
  notes?: string;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  subject_id?: number;
  subject_name?: string;
  subject_code?: string;
  subject_color?: string;
  title: string;
  description?: string;
  task_type: 'assignment' | 'examination' | 'project' | 'revision' | 'personal';
  due_date: string;
  estimated_effort_minutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  priority_score: number;
  priority_reason?: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: string;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  date: string;
  status: 'present' | 'absent' | 'leave';
  notes?: string;
  created_at: string;
}

export interface SubjectAttendanceSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  color: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  leave_count: number;
  percentage: number;
  target_percentage: number;
  status: 'safe' | 'warning' | 'critical';
  classes_needed_for_target: number;
  explanation: string;
}

export interface OverallAttendanceSummary {
  overall_percentage: number;
  total_conducted: number;
  total_present: number;
  total_absent: number;
  total_leave: number;
  target_percentage: number;
  is_warning: boolean;
  subject_summaries: SubjectAttendanceSummary[];
}

export interface Assessment {
  id: number;
  user_id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  subject_color?: string;
  assessment_name: string;
  assessment_type: string;
  marks_obtained: number;
  maximum_marks: number;
  percentage: number;
  assessment_date: string;
  notes?: string;
  created_at: string;
}

export interface SubjectPerformanceSummary {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  color: string;
  assessment_count: number;
  average_percentage: number;
  highest_percentage: number;
  lowest_percentage: number;
  is_weak_subject: boolean;
}

export interface PerformanceAnalytics {
  overall_average: number;
  total_assessments: number;
  subject_performance: SubjectPerformanceSummary[];
  weak_subjects: string[];
  insights: string[];
  recent_assessments: Assessment[];
}

export interface StudySession {
  id: number;
  user_id: number;
  subject_id?: number;
  subject_name?: string;
  subject_code?: string;
  subject_color?: string;
  task_id?: number;
  task_title?: string;
  title: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'skipped';
  recommendation_reason?: string;
  is_accepted: boolean;
  created_at: string;
}

export interface VaultDocument {
  id: number;
  user_id: number;
  subject_id?: number;
  subject_name?: string;
  title: string;
  category: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  has_extracted_text: boolean;
  created_at: string;
}

export interface SourceReference {
  source_type: string;
  title: string;
  reference_detail: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceReference[];
  is_demo: boolean;
  created_at: string;
}

export interface ChatConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages?: ChatMessage[];
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface DailyBriefing {
  summary: string;
  highlights: string[];
  is_ai_generated: boolean;
  generated_at: string;
}

export interface DashboardSummary {
  student_name: string;
  college: string;
  course: string;
  semester: string;
  current_date: string;
  current_day: string;
  daily_briefing: DailyBriefing;
  todays_classes: TimetableEntry[];
  upcoming_tasks: Task[];
  pending_tasks_count: number;
  completed_tasks_count: number;
  overdue_tasks_count: number;
  overall_attendance_percentage: number;
  is_attendance_warning: boolean;
  subject_attendance: SubjectAttendanceSummary[];
  overall_marks_average: number;
  subject_marks: SubjectPerformanceSummary[];
  weak_subjects: string[];
  todays_study_sessions: StudySession[];
  unread_notifications_count: number;
}

export interface SearchResultItem {
  category: string;
  id: number;
  title: string;
  subtitle: string;
  link_url: string;
  details?: string;
}

export interface GlobalSearchResponse {
  query: string;
  total_results: number;
  results: SearchResultItem[];
}
