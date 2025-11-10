import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor, complete usuario y contraseña',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(error);
        await Swal.fire({
          icon: 'error',
          title: 'Error al iniciar sesión',
          text: 'Usuario o contraseña incorrectos',
        });
        return;
      }

      // Login OK
      await Swal.fire({
        icon: 'success',
        title: 'Bienvenido',
        timer: 1200,
        showConfirmButton: false,
      });

      // App.jsx redirige según rol
      navigate('/');
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Error inesperado',
        text: 'Ocurrió un problema. Intente de nuevo.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#000',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          background: '#111',
          padding: '40px 30px',
          borderRadius: 16,
          boxShadow: '0 0 20px rgba(255,0,0,0.2)',
          width: '100%',
          maxWidth: 380,
          textAlign: 'center',
        }}
      >
        <h1 style={{ color: '#f44336', marginBottom: 8 }}>🍕 Pizza Río</h1>
        <p style={{ color: '#ccc', marginBottom: 30 }}>Registro de Cancelaciones</p>

        <label style={{ display: 'block', textAlign: 'left', marginBottom: 15 }}>
          <span style={{ fontSize: 14, color: '#ddd' }}>Usuario</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            required
            style={{
              width: '100%',
              padding: 10,
              marginTop: 5,
              borderRadius: 8,
              border: '1px solid #333',
              background: '#000',
              color: '#fff',
            }}
          />
        </label>

        <label style={{ display: 'block', textAlign: 'left', marginBottom: 25 }}>
          <span style={{ fontSize: 14, color: '#ddd' }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
            style={{
              width: '100%',
              padding: 10,
              marginTop: 5,
              borderRadius: 8,
              border: '1px solid #333',
              background: '#000',
              color: '#fff',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            border: 'none',
            borderRadius: 10,
            background: loading ? '#800' : '#f44336',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: '0.3s',
          }}
        >
          {loading ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>

        <p style={{ marginTop: 30, color: '#555', fontSize: 13 }}>
          © Pizza Río — Santa Cruz, Bolivia
        </p>
      </form>
    </div>
  );
}
