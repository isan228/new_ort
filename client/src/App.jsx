import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BankHome from './pages/BankHome';
import TestBuilder from './pages/TestBuilder';
import TestRunner from './pages/TestRunner';
import History from './pages/History';
import Flashcards from './pages/Flashcards';
import Subscriptions from './pages/Subscriptions';
import Admin from './pages/Admin';

function Private({ children, adminOnly }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/ort" replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={ready && user ? '/ort' : '/login'} replace />} />
        <Route path="/login" element={user ? <Navigate to="/ort" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/ort" replace /> : <Register />} />
        <Route path="/ort" element={<Private><Dashboard /></Private>} />
        <Route path="/ort-home" element={<Private><BankHome /></Private>} />
        <Route path="/ort-create" element={<Private><TestBuilder /></Private>} />
        <Route path="/ort-test-builder" element={<Navigate to="/ort-create" replace />} />
        <Route path="/ort-history" element={<Private><History /></Private>} />
        <Route path="/ort-flashcards" element={<Private><Flashcards /></Private>} />
        <Route path="/test" element={<Private><TestRunner /></Private>} />
        <Route path="/subscriptions" element={<Private><Subscriptions /></Private>} />
        <Route path="/admin" element={<Private adminOnly><Admin /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
