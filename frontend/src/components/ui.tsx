import { LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export function Button({ className, variant = 'primary', loading, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  const styles = {
    primary: 'bg-mint text-[#062019] hover:bg-[#86f4d1] disabled:bg-mint/45 disabled:text-[#07130f]/70',
    secondary: 'border border-line bg-[#121923] text-slate-100 hover:border-slate-600 hover:bg-[#18212d]',
    ghost: 'text-slate-400 hover:bg-white/5 hover:text-white',
    danger: 'border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  };
  return (
    <button
      className={cn('inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[.98] focus-visible:outline-none disabled:cursor-not-allowed disabled:active:scale-100', styles[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Input({ label, error, className, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="label">{label}</span>}
      <input {...props} id={inputId} className={cn('field', error && 'border-red-400/60', className)} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy} />
      {error && <span id={errorId} className="mt-1.5 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export function Select({ label, children, className, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="label">{label}</span>}
      <select {...props} id={selectId} className={cn('field appearance-none', className)}>{children}</select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
      <input type="search" aria-label={placeholder} className="field py-2.5 pl-10" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; children: ReactNode }) {
  const tones = {
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    danger: 'border-red-400/20 bg-red-400/10 text-red-300',
    neutral: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
    info: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
  };
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Modal({ open, title, description, children, onClose }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020407]/80 p-0 backdrop-blur-[6px] sm:items-center sm:p-5" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-[#10161f] p-5 shadow-floating animate-fade-up sm:max-w-lg sm:rounded-2xl sm:p-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-[-.02em] text-white">{title}</h2>
            {description && <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="icon-button -mr-2 -mt-2"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin text-mint" size={24} /><span>{label}</span></div>;
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-xl bg-white/[.035] p-3 text-slate-500">{icon}</div><h3 className="font-medium text-slate-200">{title}</h3><p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-400">{description}</p></div>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/[.08] px-4 py-3 text-sm text-red-200"><span>{message}</span>{onRetry && <button onClick={onRetry} className="font-semibold underline underline-offset-4">Reintentar</button>}</div>;
}
