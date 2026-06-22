import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CompanyProvider } from './hooks/useCompany';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { ToastProvider } from './hooks/useToast';
import LoginPage from './components/auth/LoginPage';
import Layout from './components/layout/Layout';
import DashboardPage from './components/dashboard/DashboardPage';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './index.css';

// Lazy-load every route that isn't on the critical first paint. This keeps the
// login screen and dashboard tiny — heavy deps (recharts, react-big-calendar,
// @hello-pangea/dnd, react-easy-crop, the admin/pug bundles) only download
// when the user actually navigates to those routes.
const TaskListPage = lazy(() => import('./components/tasks/TaskListPage'));
const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const EmailLogsPage = lazy(() => import('./components/emails/EmailLogsPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const ActivityFeedPage = lazy(() => import('./components/activity/ActivityFeedPage'));
const DayViewPage = lazy(() => import('./components/dayview/DayViewPage'));
const PlannerPage = lazy(() => import('./components/planner/PlannerPage'));
const CompletedTasksPage = lazy(() => import('./components/tasks/CompletedTasksPage'));
const SearchPage = lazy(() => import('./components/search/SearchPage'));
const OrphanTasksPage = lazy(() => import('./components/admin/OrphanTasksPage'));
const CompaniesAdminPage = lazy(() => import('./components/admin/CompaniesAdminPage'));
const ProjectsListPage = lazy(() => import('./components/projects/ProjectsListPage'));
const ProjectDetailPage = lazy(() => import('./components/projects/ProjectDetailPage'));
const PugConfigPage = lazy(() => import('./components/projects/PugConfigPage'));
const PublicProjectPage = lazy(() => import('./components/projects/PublicProjectPage'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
  const { t } = useTranslation();

  // Public share routes — no auth gate. The /shared/:token URL is what
  // David sends to the mayor's office; we early-return so the regular
  // login redirect doesn't kick in.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/shared/')) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/shared/:token" element={<ErrorBoundary><PublicProjectPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-xl font-bold text-white">V</span>
          </div>
          <p className="text-navy-400 text-sm">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="/tasks" element={<ErrorBoundary><TaskListPage /></ErrorBoundary>} />
          <Route path="/search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
          <Route path="/activitate" element={<ErrorBoundary><ActivityFeedPage /></ErrorBoundary>} />
          <Route path="/templates" element={<ErrorBoundary><TemplatesPage /></ErrorBoundary>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><AdminPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/admin/companies" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><CompaniesAdminPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/admin/pug" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><PugConfigPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/proiecte" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'manager', 'user']}><ErrorBoundary><ProjectsListPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/proiecte/:id" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'manager', 'user']}><ErrorBoundary><ProjectDetailPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/orfani" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><ErrorBoundary><OrphanTasksPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/emails" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'manager']}><ErrorBoundary><EmailLogsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="/day-view" element={<ErrorBoundary><DayViewPage /></ErrorBoundary>} />
          <Route path="/planner" element={<ErrorBoundary><PlannerPage /></ErrorBoundary>} />
          {/* Old deadline-based week view is gone — bookmarks now land on the planner. */}
          <Route path="/week-view" element={<Navigate to="/planner" replace />} />
          <Route path="/terminate" element={<ErrorBoundary><CompletedTasksPage /></ErrorBoundary>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <I18nProvider>
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </I18nProvider>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
