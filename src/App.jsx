import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import LoginPage from './pages/LoginPage';
import CajeroPage from './pages/CajeroPage';
import SupervisorPage from './pages/SupervisorPage';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, branch_id, branches (name)')
        .eq('id', session.user.id)
        .single();

      if (error) console.error(error);
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [session]);

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          session && profile?.role === 'sucursal' ? (
            <CajeroPage session={session} profile={profile} />
          ) : session && profile?.role === 'supervisor' ? (
            <SupervisorPage session={session} profile={profile} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
