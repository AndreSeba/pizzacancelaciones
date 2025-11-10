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
    const init = async () => {
      // Espera a que se cargue la sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session ?? null);
      setLoading(false);
    };
    init();

    // Escucha cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

useEffect(() => {
  const fetchProfile = async () => {
    if (!session) {
      setProfile(null);
      setLoading(false); // 🔹 Esto es lo que evita el doble inicio
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role, branch_id, branches (name)')
      .eq('id', session.user.id)
      .single();

    if (!error) setProfile(data);
    setLoading(false);
  };
  fetchProfile();
}, [session]);


  // 🔹 Mostrar pantalla de carga mientras se confirma sesión
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily: 'system-ui',
      }}>
        <h2>Iniciando...</h2>
      </div>
    );
  }

  // 🔹 Rutas
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          session ? (
            profile?.role === 'sucursal' ? (
              <CajeroPage session={session} profile={profile} />
            ) : (
              <SupervisorPage session={session} profile={profile} />
            )
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
