import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Tracker from './pages/Tracker.jsx';

export default function App() {
  const { user } = useAuth();
  if (user === undefined) return <div className="splash">Loading</div>;
  if (!user) return (
    <Routes>
      <Route path="*" element={<Login />} />
    </Routes>
  );
  return (
    <Routes>
      <Route path="/learner/:uid/:tab?" element={<Tracker />} />
      <Route path="/:tab?" element={<Tracker />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
