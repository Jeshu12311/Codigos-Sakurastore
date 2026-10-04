import { LoaderCircle, Search, X } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export function Button({ className, variant = 'primary', loading, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  const styles = {
    primary: 'bg-mint text-[#062019] hover:bg-[#83f5d1] shadow-[0_8px_24px_rgba(100,240,194,.12)]',
    secondary: 'border border-line bg-[#151b25] text-slate-100 hover:border-slate-600 hover:bg-[#1b2330]',
    ghost: 'text-slate-400 hover:bg-white/5 hover:text-white',
    danger: 'border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  };
  return (
    <button
      className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Input({ label, error, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <input className={cn('field', error && 'border-red-400/60', className)} {...props} />
      {error && <span className="mt-1.5 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

export function Select({ label, children, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      <select className={cn('field appearance-none', className)} {...props}>{children}</select>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="relative block w-full sm:w-72">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
      <input className="field py-2.5 pl-10" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section role="dialog" aria-modal="true" className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[#10151e] p-5 shadow-2xl animate-fade-up sm:max-w-lg sm:rounded-2xl sm:p-6">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"><X size={19} /></button>
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
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><div className="mb-4 rounded-2xl border border-line bg-white/[.025] p-3 text-slate-500">{icon}</div><h3 className="font-medium text-slate-200">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p></div>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/[.08] px-4 py-3 text-sm text-red-200"><span>{message}</span>{onRetry && <button onClick={onRetry} className="font-semibold underline underline-offset-4">Reintentar</button>}</div>;
}
