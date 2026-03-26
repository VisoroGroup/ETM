import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import LoginPage from './components/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './components/dashboard/DashboardPage';
import TaskListPage from './components/tasks/TaskListPage';
import AdminPage from './components/admin/AdminPage';
import EmailLogsPage from './components/emails/EmailLogsPage';
import TemplatesPage from './pages/TemplatesPage';
import PaymentsPage from './components/payments/PaymentsPage';
import ErrorBoundary from './components/ErrorBoundary';
import ActivityFeedPage from './components/activity/ActivityFeedPage';
import DayViewPage from './components/dayview/DayViewPage';
import CompletedTasksPage from './components/tasks/CompletedTasksPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000, // 30s
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-xl font-bold text-white">V</span>
          </div>
          <p className="text-navy-400 text-sm">Se încarcă...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
        <Route path="/tasks" element={<ErrorBoundary><TaskListPage /></ErrorBoundary>} />
        <Route path="/activitate" element={<ErrorBoundary><ActivityFeedPage /></ErrorBoundary>} />
        <Route path="/templates" element={<ErrorBoundary><TemplatesPage /></ErrorBoundary>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><AdminPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/financiar" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><PaymentsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/emails" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'manager']}><ErrorBoundary><EmailLogsPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/day-view" element={<ProtectedRoute allowedRoles={['superadmin']}><ErrorBoundary><DayViewPage /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/terminate" element={<ErrorBoundary><CompletedTasksPage /></ErrorBoundary>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
