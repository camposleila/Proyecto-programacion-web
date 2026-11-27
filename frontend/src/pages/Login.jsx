import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import logo from '../assets/tarantines_logo.svg';

export default function Login() {
  const [form, setForm] = useState({ nombre_usuario: '', password: '' });
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre_usuario.trim() || !form.password) {
      return setError('Escribe tu usuario y tu contraseña.');
    }
    setCargando(true);
    try {
      const r = await api.post('/auth/login', { ...form, nombre_usuario: form.nombre_usuario.trim() });
      const d = r.data ?? r;
      localStorage.setItem('token', d.token);
      if (d.usuario) localStorage.setItem('usuario', JSON.stringify(d.usuario));
      navegar(ubicacion.state?.desde || '/catalogo', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-marino via-[#1B3455] to-[#2C4667] p-4">
      <form onSubmit={enviar} className="w-full max-w-sm space-y-4 rounded-2xl bg-crema p-8 shadow-xl">
        <img src={logo} alt="Tarantines" className="mx-auto h-32 w-32" />
        <h1 className="text-center text-xl font-semibold text-marino">Iniciar sesión</h1>

        <div>
          <label htmlFor="usuario" className="etiqueta">Usuario</label>
          <input
            id="usuario"
            className="campo"
            autoComplete="username"
            placeholder="Usuario"
            value={form.nombre_usuario}
            onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor="clave" className="etiqueta">Contraseña</label>
          <div className="relative">
            <input
              id="clave"
              className="campo pr-11"
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verClave}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-oliva transition hover:text-marino"
            >
              {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={cargando} className="btn-oscuro flex w-full items-center justify-center gap-2 py-2.5">
          {cargando && <Loader2 size={16} className="animate-spin" />}
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
