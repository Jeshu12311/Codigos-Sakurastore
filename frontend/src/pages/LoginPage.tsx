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
    <main className="portal-backdrop relative grid min-h-[100dvh] place-items-center overflow-hidden bg-ink px-5 py-10">
      <div className="relative w-full max-w-[420px] animate-fade-up">
        <div className="mb-7 flex justify-center"><Brand link="/codigos" /></div>
        <section className="rounded-2xl bg-[#0d131c] p-6 shadow-floating sm:p-8">
          <div className="mb-7"><h1 className="text-2xl font-semibold tracking-[-.025em] text-white">Acceso administrativo</h1><p className="mt-2 text-sm leading-6 text-slate-400">Ingresa para administrar cuentas, ventas y códigos.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <Input label="Correo electrónico" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ejemplo.com" />
            <div><label className="label" htmlFor="admin-password">Contraseña</label><span className="relative block"><input id="admin-password" className="field pr-12" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/[.045] hover:text-slate-200">{showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></span></div>
            {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/[.07] px-4 py-3 text-sm text-red-200">{error}</div>}
            <Button type="submit" loading={submitting} className="w-full py-3">Iniciar sesión {!submitting && <ArrowRight size={16} />}</Button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-white/[.055] pt-5 text-xs text-slate-500"><ShieldCheck size={14} className="text-mint/75" /> Acceso protegido y registrado</div>
        </section>
        <p className="mt-6 text-center text-xs text-slate-500">¿Buscas tu código? <a href="/codigos" className="font-medium text-slate-300 underline-offset-4 hover:text-mint hover:underline">Ir al portal de clientes</a></p>
      </div>
    </main>
  );
}
