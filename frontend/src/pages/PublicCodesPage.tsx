import { BadgeCheck, Check, Clipboard, ClipboardCheck, Clock3, LoaderCircle, LockKeyhole, MailCheck, RefreshCcw, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Brand } from '../components/Brand';
import { Button, Input } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { cn, formatRemaining } from '../lib/utils';
import type { PublicCodeResponse } from '../types';

type ViewState = 'idle' | 'loading' | 'waiting' | 'success' | 'error' | 'timeout' | 'expired';

const steps = [
  { icon: BadgeCheck, title: 'Valida tu compra', description: 'Usa el correo de la cuenta y tu código de venta.' },
  { icon: MailCheck, title: 'Solicita en la plataforma', description: 'Pide el código desde el servicio de streaming.' },
  { icon: ClipboardCheck, title: 'Copia y continúa', description: 'Lo mostraremos aquí apenas llegue al correo.' },
];

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
    <main className="portal-backdrop relative min-h-[100dvh] overflow-hidden bg-ink">
      <a href="#consulta" className="skip-link">Ir a la consulta</a>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex h-[72px] items-center justify-between border-b border-white/[.055]">
          <Brand />
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-400 sm:flex"><ShieldCheck size={15} className="text-mint" aria-hidden="true" /> Conexión protegida</div>
        </header>

        <section className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-9 py-9 lg:grid-cols-[1fr_1.04fr] lg:gap-20 lg:py-14">
          <div className="max-w-xl animate-fade-up">
            <h1 className="max-w-[18ch] text-[2.25rem] font-semibold leading-[1.06] tracking-[-.035em] text-white sm:text-5xl lg:text-[3.1rem]">Tu código, justo cuando lo necesitas.</h1>
            <p className="mt-4 max-w-[34rem] text-[15px] leading-7 text-slate-400 sm:mt-5 sm:text-base">Valida tu compra y recibe aquí el código temporal que envía la plataforma a la cuenta.</p>

            <div className="mt-9 hidden border-t border-white/[.065] lg:block">
              {steps.map(({ icon: Icon, title, description }) => (
                <div key={title} className="grid grid-cols-[32px_1fr] gap-4 border-b border-white/[.055] py-4">
                  <Icon size={18} strokeWidth={1.8} className="mt-0.5 text-mint" aria-hidden="true" />
                  <div><p className="text-sm font-medium text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div id="consulta" className="scroll-mt-6 rounded-2xl bg-[#0d131c] p-5 shadow-floating animate-fade-up sm:p-7 lg:p-8">
            {(state === 'success' || state === 'expired') && result?.code ? (
              <div className="animate-fade-up" aria-live="polite">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/[.09] text-mint"><Check size={19} aria-hidden="true" /></span>
                  <div><h2 className="text-xl font-semibold tracking-[-.025em] text-white">Código recibido</h2><p className="mt-1 text-sm leading-6 text-slate-400">Úsalo en la plataforma antes de que termine su vigencia.</p></div>
                </div>
                <div className={cn('mt-6 rounded-2xl p-5 text-center sm:p-6', state === 'expired' ? 'bg-red-400/[.07]' : 'bg-mint/[.065]')}>
                  <p className="text-xs font-medium text-slate-400">Tu código temporal</p>
                  <p className={cn('my-4 break-words font-mono text-4xl font-semibold tracking-[.16em] sm:text-5xl', state === 'expired' ? 'text-slate-500 line-through' : 'text-white')}>{result.code}</p>
                  <div className="mb-5 flex items-center justify-center gap-2 text-sm"><Clock3 size={15} className={state === 'expired' ? 'text-red-300' : 'text-mint'} aria-hidden="true" /><span className="text-slate-400">{state === 'expired' ? 'Este código expiró' : <>Expira en <strong className="tabular-nums font-mono font-semibold text-slate-100">{formatRemaining(remaining)}</strong></>}</span></div>
                  {state !== 'expired' && <Button type="button" variant="secondary" onClick={() => void copyCode()} className="w-full">{copied ? <Check size={16} className="text-mint" aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}{copied ? 'Código copiado' : 'Copiar código'}</Button>}
                </div>
                <button type="button" onClick={reset} className="mt-5 w-full rounded-lg py-2 text-sm font-medium text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">Hacer otra consulta</button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/[.09] text-mint"><ShieldCheck size={19} aria-hidden="true" /></span>
                  <div><h2 className="text-xl font-semibold tracking-[-.025em] text-white sm:text-2xl">Consulta tu código</h2><p className="mt-1 text-sm leading-6 text-slate-400">Ingresa los datos que recibiste con tu compra.</p></div>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-4 sm:space-y-5">
                  <Input label="Correo de la cuenta" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cuenta@correo.com" disabled={locked} />
                  <Input label="Código de venta" autoComplete="off" required minLength={4} maxLength={50} value={saleCode} onChange={(event) => setSaleCode(event.target.value.toUpperCase())} placeholder="Ej. F8K2-XP91" className="font-mono uppercase tracking-wider" disabled={locked} />
                  <Button type="submit" loading={state === 'loading'} disabled={!email.trim() || !saleCode.trim()} className="w-full py-3">
                    {state === 'loading' ? 'Verificando…' : state === 'waiting' ? 'Esperando código…' : 'Obtener código'}
                  </Button>
                </form>

                {state === 'waiting' && (
                  <div className="mt-5 animate-fade-up rounded-xl bg-sky-400/[.075] p-4" role="status" aria-live="polite">
                    <div className="flex items-start gap-3"><LoaderCircle size={18} className="mt-0.5 animate-spin text-sky-300" aria-hidden="true" /><div><p className="text-sm font-medium text-sky-100">Ahora solicita el código en la plataforma</p><p className="mt-1 text-xs leading-5 text-sky-100/70">Cuando el correo llegue, esta pantalla se actualizará automáticamente.</p></div></div>
                  </div>
                )}

                {(state === 'error' || state === 'timeout') && (
                  <div className="mt-5 animate-fade-up rounded-xl bg-amber-400/[.075] p-4" role="alert">
                    <p className="text-sm font-medium text-amber-100">{state === 'timeout' ? 'El código aún no está disponible.' : message}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-100/70">{state === 'timeout' ? 'Solicítalo otra vez en la plataforma y vuelve a consultar.' : 'Revisa el correo y el código de venta.'}</p>
                    <button type="button" onClick={reset} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-amber-200 hover:text-white"><RefreshCcw size={13} aria-hidden="true" /> Limpiar consulta</button>
                  </div>
                )}

                <div className="mt-5 flex items-start gap-2 border-t border-white/[.055] pt-4 text-xs leading-5 text-slate-500"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-mint/75" aria-hidden="true" /><p>Nunca te pediremos la contraseña. Los códigos expiran automáticamente.</p></div>
              </>
            )}
          </div>
        </section>
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-white/[.055] py-5 text-[11px] text-slate-500 sm:flex-row"><span>© {new Date().getFullYear()} Códigos SakuraStore</span><span>Entrega segura de códigos temporales</span></footer>
      </div>
    </main>
  );
}
