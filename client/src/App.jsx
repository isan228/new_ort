import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell, AdminShell } from './components/Shells';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Tests from './pages/Tests';
import TestBuilder from './pages/TestBuilder';
import TestRunner from './pages/TestRunner';
import TestResults from './pages/TestResults';
import Errors from './pages/Errors';
import Favorites from './pages/Favorites';
import Flashcards from './pages/Flashcards';
import Stats from './pages/Stats';
import Ranking from './pages/Ranking';
import Achievements from './pages/Achievements';
import Referral from './pages/Referral';
import Subscriptions, { PricingPublic } from './pages/Subscriptions';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import History from './pages/History';
import AdminHome from './pages/admin/AdminHome';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminFlashcards from './pages/admin/AdminFlashcards';
import AdminPlans from './pages/admin/AdminPlans';

function Private({ children, adminOnly }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <p className="muted">Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

function AppLayout({ children }) {
  return <Private><AppShell>{children}</AppShell></Private>;
}

function AdminLayout({ children }) {
  return <Private adminOnly><AdminShell>{children}</AdminShell></Private>;
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route path="/" element={ready && user ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <Register />} />
      <Route path="/pricing" element={<PricingPublic />} />

      <Route path="/app" element={<AppLayout><Home /></AppLayout>} />
      <Route path="/app/tests" element={<AppLayout><Tests /></AppLayout>} />
      <Route path="/app/create" element={<AppLayout><TestBuilder /></AppLayout>} />
      <Route path="/app/test" element={<AppLayout><TestRunner /></AppLayout>} />
      <Route path="/app/results" element={<AppLayout><TestResults /></AppLayout>} />
      <Route path="/app/errors" element={<AppLayout><Errors /></AppLayout>} />
      <Route path="/app/favorites" element={<AppLayout><Favorites /></AppLayout>} />
      <Route path="/app/flashcards" element={<AppLayout><Flashcards /></AppLayout>} />
      <Route path="/app/stats" element={<AppLayout><Stats /></AppLayout>} />
      <Route path="/app/ranking" element={<AppLayout><Ranking /></AppLayout>} />
      <Route path="/app/achievements" element={<AppLayout><Achievements /></AppLayout>} />
      <Route path="/app/referral" element={<AppLayout><Referral /></AppLayout>} />
      <Route path="/app/premium" element={<AppLayout><Subscriptions /></AppLayout>} />
      <Route path="/app/profile" element={<AppLayout><Profile /></AppLayout>} />
      <Route path="/app/settings" element={<AppLayout><Settings /></AppLayout>} />
      <Route path="/app/history" element={<AppLayout><History /></AppLayout>} />

      <Route path="/admin" element={<AdminLayout><AdminHome /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
      <Route path="/admin/content" element={<AdminLayout><AdminContent /></AdminLayout>} />
      <Route path="/admin/flashcards" element={<AdminLayout><AdminFlashcards /></AdminLayout>} />
      <Route path="/admin/plans" element={<AdminLayout><AdminPlans /></AdminLayout>} />

      <Route path="/ort" element={<Navigate to="/app/tests" replace />} />
      <Route path="/ort-home" element={<Navigate to="/app/tests" replace />} />
      <Route path="/ort-create" element={<Navigate to="/app/create" replace />} />
      <Route path="/ort-history" element={<Navigate to="/app/history" replace />} />
      <Route path="/ort-flashcards" element={<Navigate to="/app/flashcards" replace />} />
      <Route path="/test" element={<Navigate to="/app/test" replace />} />
      <Route path="/subscriptions" element={<Navigate to="/app/premium" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
