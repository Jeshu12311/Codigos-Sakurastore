import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/admin/dashboard';

  useEffect(() => setError(''), [email, password]);
  if (!loading && user) return <Navigate to="/admin/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.status === 429 ? 'Demasiados intentos. Inténtalo más tarde.' : 'Correo o contraseña incorrectos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink px-5 py-10">
      <div className="grid-noise pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-[-18rem] size-[42rem] -translate-x-1/2 rounded-full bg-emerald-400/[.075] blur-3xl" />
      <div className="relative w-full max-w-[420px] animate-fade-up">
        <div className="mb-8 flex justify-center"><Brand link="/codigos" /></div>
        <section className="surface p-6 shadow-2xl sm:p-8">
          <div className="mb-7 text-center"><h1 className="text-2xl font-semibold tracking-tight text-white">Bienvenido de nuevo</h1><p className="mt-2 text-sm text-slate-500">Ingresa para administrar tus códigos.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <Input label="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ejemplo.com" />
            <label className="block"><span className="label">Contraseña</span><span className="relative block"><input className="field pr-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-4 py-3 text-sm text-red-200">{error}</div>}
            <Button type="submit" loading={submitting} className="w-full py-3">Iniciar sesión {!submitting && <ArrowRight size={16} />}</Button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-600"><ShieldCheck size={14} className="text-mint/70" /> Acceso protegido y registrado</div>
        </section>
        <p className="mt-6 text-center text-xs text-slate-600">¿Buscas tu código? <a href="/codigos" className="text-slate-400 hover:text-mint">Ir al portal de clientes</a></p>
      </div>
    </main>
  );
}
