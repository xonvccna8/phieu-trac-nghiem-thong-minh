/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ExamPaper from './pages/ExamPaper';
import ExamEditor from './pages/ExamEditor';
import AuthPage from './pages/AuthPage';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useLocation } from 'react-router-dom';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole: 'TEACHER' | 'STUDENT' }) {
  const { userProfile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  
  if (!userProfile) return <Navigate to="/auth" replace />;
  
  if (userProfile.role !== allowedRole) {
    return <Navigate to={userProfile.role === 'TEACHER' ? '/teacher' : '/student'} replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100 font-sans">
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            
            <Route path="/teacher" element={
              <ProtectedRoute allowedRole="TEACHER">
                <TeacherDashboard />
              </ProtectedRoute>
            } />
            <Route path="/teacher/exam/new" element={
              <ProtectedRoute allowedRole="TEACHER">
                <ExamEditor />
              </ProtectedRoute>
            } />
            
            <Route path="/student" element={
              <ProtectedRoute allowedRole="STUDENT">
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/exam/:id" element={
              <ProtectedRoute allowedRole="STUDENT">
                <ExamWrapper />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

function ExamWrapper() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const mode = (queryParams.get('mode') as 'EXAM' | 'PRACTICE') || 'EXAM';
  
  return <ExamPaper mode={mode} />;
}

