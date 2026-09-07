import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LangContext';
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
import PaymentSuccess from './pages/PaymentSuccess';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import History from './pages/History';
import AdminLogin from './pages/admin/AdminLogin';
import AdminHome from './pages/admin/AdminHome';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';

export const ADMIN_PATH = '/админ';

function homePath(user) {
  return user?.role === 'admin' ? ADMIN_PATH : '/app';
}

function Private({ children }) {
  const { user, ready } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  if (!ready) return <p className="muted">{t('common.loading')}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role === 'admin') return <Navigate to={ADMIN_PATH} replace />;
  return children;
}

function AppLayout({ children }) {
  return <Private><AppShell>{children}</AppShell></Private>;
}

function AdminGate() {
  const { user, ready } = useAuth();
  const { t } = useLang();
  if (!ready) return <p className="muted">{t('common.loading')}</p>;
  if (user?.role === 'admin') {
    return <AdminShell><Outlet /></AdminShell>;
  }
  return <AdminLogin />;
}

function LoggedInRedirect({ children }) {
  const { user, ready } = useAuth();
  const { t } = useLang();
  if (!ready) return <p className="muted">{t('common.loading')}</p>;
  if (user) return <Navigate to={homePath(user)} replace />;
  return children;
}

function adminPages() {
  return (
    <>
      <Route index element={<AdminHome />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="content" element={<AdminContent />} />
      <Route path="flashcards" element={<Navigate to="../content" replace />} />
      <Route path="plans" element={<Navigate to="../content" replace />} />
    </>
  );
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={ready && user ? <Navigate to={homePath(user)} replace /> : <Landing />}
      />
      <Route path="/login" element={<LoggedInRedirect><Login /></LoggedInRedirect>} />
      <Route path="/register" element={<LoggedInRedirect><Register /></LoggedInRedirect>} />
      <Route path="/pricing" element={<PricingPublic />} />
      <Route path="/pay/success" element={<PaymentSuccess />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />

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

      <Route path={ADMIN_PATH} element={<AdminGate />}>{adminPages()}</Route>
      <Route path="/admin" element={<AdminGate />}>{adminPages()}</Route>

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
