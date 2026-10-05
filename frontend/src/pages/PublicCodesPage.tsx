import { Check, Clipboard, Clock3, KeyRound, LoaderCircle, LockKeyhole, RefreshCcw, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Brand } from '../components/Brand';
import { Button, Input } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { cn, formatRemaining } from '../lib/utils';
import type { PublicCodeResponse } from '../types';

type ViewState = 'idle' | 'loading' | 'waiting' | 'success' | 'error' | 'timeout' | 'expired';

export function PublicCodesPage() {
  const [email, setEmail] = useState('');
  const [saleCode, setSaleCode] = useState('');
  const [state, setState] = useState<ViewState>('idle');
  const [result, setResult] = useState<PublicCodeResponse | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const pollRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (state !== 'success' || !result?.expiresAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(result.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setState('expired');
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [state, result?.expiresAt]);

  async function requestCode(values: { email: string; saleCode: string }, isPoll = false) {
    try {
      const response = await api<PublicCodeResponse>('/public/code', {
        method: 'POST',
        body: values,
        csrf: false,
      });
      if (response.success && response.code && response.expiresAt) {
        stopPolling();
        setResult(response);
        setRemaining(response.secondsRemaining ?? Math.max(0, Math.ceil((new Date(response.expiresAt).getTime() - Date.now()) / 1000)));
        setState('success');
        return;
      }
      if (response.status === 'waiting') {
        setState('waiting');
        if (Date.now() >= deadlineRef.current) {
          setState('timeout');
          return;
        }
        pollRef.current = window.setTimeout(() => void requestCode(values, true), 5000);
        return;
      }
      stopPolling();
      setMessage('No se encontró una solicitud activa con esos datos.');
      setState('error');
    } catch (error) {
      stopPolling();
      if (error instanceof ApiError && error.status === 429) {
        setMessage('Se alcanzó el límite de intentos. Espera unos minutos antes de volver a consultar.');
      } else if (isPoll && Date.now() < deadlineRef.current) {
        setState('waiting');
        pollRef.current = window.setTimeout(() => void requestCode(values, true), 5000);
        return;
      } else {
        setMessage('No se encontró una solicitud activa con esos datos.');
      }
      setState('error');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    stopPolling();
    setCopied(false);
    setMessage('');
    setResult(null);
    setState('loading');
    deadlineRef.current = Date.now() + 120_000;
    void requestCode({ email: email.trim().toLowerCase(), saleCode: saleCode.trim().toUpperCase() });
  }

  async function copyCode() {
    if (!result?.code) return;
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function reset() {
    stopPolling();
    setState('idle');
    setResult(null);
    setMessage('');
  }

  const locked = state === 'loading' || state === 'waiting';

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink">
      <div className="grid-noise pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-36 -top-40 size-[28rem] rounded-full bg-emerald-500/[.07] blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <Brand />
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><ShieldCheck size={15} className="text-mint" /> Conexión protegida</div>
        </header>

        <section className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-14 py-12 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div className="max-w-lg">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-mint/15 bg-mint/[.06] px-3 py-1.5 text-xs font-medium text-mint">
              <span className="size-1.5 rounded-full bg-mint" /> Acceso autorizado
            </div>
            <h1 className="text-4xl font-semibold tracking-[-.04em] text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.04]">Tu código, justo cuando lo necesitas.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">Consulta de forma segura el código temporal enviado por la plataforma al correo de tu cuenta. Necesitarás ese correo y tu código de venta.</p>
            <div className="mt-8 hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-xl border border-line/80 bg-white/[.018] p-4"><LockKeyhole size={18} className="mb-3 text-mint" /><p className="text-sm font-medium text-slate-200">Consulta privada</p><p className="mt-1 text-xs leading-5 text-slate-500">Nunca solicitamos tu contraseña.</p></div>
              <div className="rounded-xl border border-line/80 bg-white/[.018] p-4"><Clock3 size={18} className="mb-3 text-mint" /><p className="text-sm font-medium text-slate-200">Vigencia visible</p><p className="mt-1 text-xs leading-5 text-slate-500">Sabrás cuánto tiempo queda.</p></div>
            </div>
          </div>

          <div className="surface relative p-1 shadow-glow">
            <div className="rounded-[13px] bg-[#0c1119] p-5 sm:p-8">
              <div className="mb-7 flex size-11 items-center justify-center rounded-xl border border-line bg-[#141a24] text-mint"><KeyRound size={20} /></div>
              <p className="eyebrow">Portal de clientes</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Consultar código</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Ingresa el correo real de la cuenta y el código de venta que recibiste.</p>

              <form onSubmit={submit} className="mt-7 space-y-5">
                <Input label="Correo de la cuenta" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cuenta@correo.com" disabled={locked} />
                <Input label="Código de venta" autoComplete="off" required minLength={4} maxLength={50} value={saleCode} onChange={(event) => setSaleCode(event.target.value.toUpperCase())} placeholder="Ej. F8K2-XP91" className="font-mono uppercase tracking-wider" disabled={locked} />
                <Button type="submit" loading={state === 'loading'} disabled={!email.trim() || !saleCode.trim()} className="w-full py-3">
                  {state === 'loading' ? 'Verificando…' : state === 'waiting' ? 'Esperando código…' : 'Obtener código'}
                </Button>
              </form>

              {state === 'waiting' && (
                <div className="mt-6 animate-fade-up rounded-xl border border-sky-400/15 bg-sky-400/[.06] p-4" role="status">
                  <div className="flex items-center gap-3"><LoaderCircle size={18} className="animate-spin text-sky-300" /><div><p className="text-sm font-medium text-sky-100">Esperando código…</p><p className="mt-0.5 text-xs text-sky-200/50">Actualizamos automáticamente cada 5 segundos.</p></div></div>
                </div>
              )}

              {(state === 'error' || state === 'timeout') && (
                <div className="mt-6 animate-fade-up rounded-xl border border-amber-400/15 bg-amber-400/[.06] p-4" role="alert">
                  <p className="text-sm font-medium text-amber-100">{state === 'timeout' ? 'El código aún no está disponible.' : message}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-100/50">{state === 'timeout' ? 'Puedes volver a intentarlo en unos instantes.' : 'Revisa los datos e inténtalo nuevamente.'}</p>
                  <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 hover:text-white"><RefreshCcw size={13} /> Nueva consulta</button>
                </div>
              )}

              {(state === 'success' || state === 'expired') && result?.code && (
                <div className={cn('mt-6 animate-fade-up rounded-2xl border p-5 text-center', state === 'expired' ? 'border-red-400/15 bg-red-400/[.05]' : 'border-mint/20 bg-mint/[.055]')}>
                  <p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Tu código</p>
                  <p className={cn('my-4 break-all font-mono text-4xl font-semibold tracking-[.16em] sm:text-5xl', state === 'expired' ? 'text-slate-500 line-through' : 'text-white')}>{result.code}</p>
                  <div className="mb-4 flex items-center justify-center gap-2 text-sm"><Clock3 size={15} className={state === 'expired' ? 'text-red-300' : 'text-mint'} /><span className="text-slate-400">{state === 'expired' ? 'Este código expiró' : <>Expira en <strong className="font-mono font-semibold text-slate-100">{formatRemaining(remaining)}</strong></>}</span></div>
                  {state !== 'expired' && <Button type="button" variant="secondary" onClick={() => void copyCode()} className="w-full">{copied ? <Check size={16} className="text-mint" /> : <Clipboard size={16} />}{copied ? 'Código copiado' : 'Copiar código'}</Button>}
                  <button onClick={reset} className="mt-4 text-xs text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline">Hacer otra consulta</button>
                </div>
              )}
              <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">Los códigos expiran automáticamente. No compartas esta información con terceros.</p>
            </div>
          </div>
        </section>
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-line/60 pt-5 text-[11px] text-slate-600 sm:flex-row"><span>© {new Date().getFullYear()} Códigos SakuraStore</span><span>Sistema de entrega segura</span></footer>
      </div>
    </main>
  );
}
