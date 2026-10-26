import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Layout } from './components/common/Layout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Timetable } from './pages/Timetable';
import { Tasks } from './pages/Tasks';
import { StudyPlanner } from './pages/StudyPlanner';
import { Attendance } from './pages/Attendance';
import { MarksAnalytics } from './pages/MarksAnalytics';
import { AIChat } from './pages/AIChat';
import { DocumentVault } from './pages/DocumentVault';
import { Notifications } from './pages/Notifications';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { SearchResults } from './pages/SearchResults';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected App Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/study-planner" element={<StudyPlanner />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/marks" element={<MarksAnalytics />} />
                <Route path="/ai-assistant" element={<AIChat />} />
                <Route path="/documents" element={<DocumentVault />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/search" element={<SearchResults />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
