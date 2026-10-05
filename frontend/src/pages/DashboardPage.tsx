import { Activity, ArrowRight, CheckCircle2, CircleDollarSign, Clock3, KeyRound, ReceiptText, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ErrorBanner } from '../components/ui';
import { api } from '../lib/api';
import { cn, formatCompactDate, isExpired } from '../lib/utils';
import type { AuditLog, DashboardStats, TemporaryCode } from '../types';

interface DashboardResponse {
  stats: DashboardStats;
  recentCodes: TemporaryCode[];
  recentLogs: AuditLog[];
}

const activityLabels: Record<string, string> = {
  PUBLIC_CODE_DELIVERED: 'Código entregado',
  PUBLIC_CODE_WAITING: 'Consulta en espera',
  PUBLIC_QUERY_REJECTED: 'Consulta rechazada',
  CODE_CREATED: 'Código registrado',
  CODE_INVALIDATED: 'Código invalidado',
  CODE_MARKED_USED: 'Código marcado como usado',
  SALE_CREATED: 'Venta creada',
  SALE_UPDATED: 'Venta actualizada',
  ACCOUNT_CREATED: 'Cuenta creada',
  ACCOUNT_UPDATED: 'Cuenta actualizada',
  ADMIN_LOGIN: 'Inicio de sesión',
};

const metricBorders = [
  'border-b border-line/70 sm:border-r xl:border-b-0',
  'border-b border-line/70 xl:border-b-0 xl:border-r',
  'border-b border-line/70 sm:border-b-0 sm:border-r',
  '',
];

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api<DashboardResponse>('/admin/dashboard'));
    } catch {
      setError('No pudimos cargar el resumen.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <DashboardSkeleton />;
  if (error || !data) return <ErrorBanner message={error || 'No hay datos disponibles.'} onRetry={() => void load()} />;

  const cards = [
    { label: 'Ventas activas', value: data.stats.activeSales, icon: ReceiptText, href: '/admin/sales' },
    { label: 'Cuentas activas', value: data.stats.activeAccounts, icon: UsersRound, href: '/admin/accounts' },
    { label: 'Códigos activos', value: data.stats.activeCodes, icon: KeyRound, href: '/admin/codes' },
    { label: 'Entregados hoy', value: data.stats.codesDeliveredToday, icon: CheckCircle2, href: '/admin/logs' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <section aria-labelledby="dashboard-metrics-title">
        <h2 id="dashboard-metrics-title" className="sr-only">Indicadores principales</h2>
        <div className="surface grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon, href }, index) => (
            <Link
              to={href}
              key={label}
              className={cn(
                'group flex min-h-36 flex-col justify-between p-5 transition-[background-color,color] duration-150 ease-out hover:bg-white/[.025] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/60 active:bg-white/[.04]',
                metricBorders[index],
              )}
              aria-label={`${label}: ${value.toLocaleString('es-PE')}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-10 place-items-center rounded-xl border border-line bg-white/[.025] text-slate-400 transition-[border-color,background-color,color] duration-150 group-hover:border-mint/25 group-hover:bg-mint/[.06] group-hover:text-mint">
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <ArrowRight size={16} className="mt-1 text-slate-600 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-mint" aria-hidden="true" />
              </div>
              <div className="mt-6">
                <p className="tabular-nums text-3xl font-semibold tracking-[-.03em] text-white">{value.toLocaleString('es-PE')}</p>
                <p className="mt-1.5 text-xs font-medium text-slate-500">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.85fr)]" aria-label="Información reciente">
        <article className="surface min-w-0 overflow-hidden">
          <header className="flex min-h-[4.75rem] items-center justify-between gap-4 border-b border-line/80 px-4 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-100">Códigos recientes</h2>
              <p className="mt-1 text-xs text-slate-500">Últimos registros del sistema</p>
            </div>
            <Link
              to="/admin/codes"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-mint transition-colors hover:bg-mint/[.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60"
            >
              Ver todos
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </header>

          {data.recentCodes.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-6 text-center">
              <div>
                <KeyRound size={22} className="mx-auto text-slate-600" aria-hidden="true" />
                <p className="mt-3 text-sm text-slate-500">Aún no hay códigos registrados.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Códigos temporales registrados recientemente</caption>
                <thead>
                  <tr className="border-b border-line/80 text-[11px] font-medium text-slate-500">
                    <th scope="col" className="px-4 py-3 sm:px-5">Cuenta</th>
                    <th scope="col" className="px-3 py-3 sm:px-4">Código</th>
                    <th scope="col" className="px-3 py-3 sm:px-4">Estado</th>
                    <th scope="col" className="hidden px-5 py-3 text-right md:table-cell">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentCodes.map((code) => {
                    const active = !code.used && !code.invalidatedAt && !isExpired(code.expiresAt);
                    return (
                      <tr key={code.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-white/[.018]">
                        <td className="max-w-40 px-4 py-4 sm:max-w-64 sm:px-5">
                          <p className="truncate text-sm font-medium text-slate-200" title={code.account?.email || undefined}>{code.account?.email || 'Sin cuenta'}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{code.account?.service}</p>
                        </td>
                        <td className="px-3 py-4 font-mono text-sm tracking-[.08em] text-slate-300 sm:px-4">{code.code}</td>
                        <td className="px-3 py-4 sm:px-4"><Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activo' : code.used ? 'Usado' : 'Finalizado'}</Badge></td>
                        <td className="hidden px-5 py-4 text-right text-xs text-slate-500 md:table-cell">
                          <time dateTime={code.createdAt}>{formatCompactDate(code.createdAt)}</time>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="surface min-w-0 overflow-hidden">
          <header className="flex min-h-[4.75rem] items-center justify-between gap-4 border-b border-line/80 px-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Actividad reciente</h2>
              <p className="mt-1 text-xs text-slate-500">{data.stats.queriesToday.toLocaleString('es-PE')} consultas hoy</p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl border border-line bg-white/[.025] text-slate-500">
              <Activity size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </header>

          {data.recentLogs.length === 0 ? (
            <div className="grid min-h-56 place-items-center px-6 text-center">
              <p className="text-sm text-slate-500">Sin actividad reciente.</p>
            </div>
          ) : (
            <ol className="divide-y divide-line/60 px-5" aria-label="Últimos eventos del sistema">
              {data.recentLogs.map((log) => (
                <li className="flex gap-3 py-3.5" key={log.id}>
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-white/[.02] text-slate-500" aria-hidden="true">
                    <Activity size={13} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-300">{activityLabels[log.action] || log.action.replaceAll('_', ' ')}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock3 size={11} className="shrink-0" aria-hidden="true" />
                      <time className="shrink-0" dateTime={log.createdAt}>{formatCompactDate(log.createdAt)}</time>
                      {log.account?.email && <><span aria-hidden="true">·</span><span className="truncate" title={log.account.email}>{log.account.email}</span></>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

      <section className="surface flex flex-col items-stretch justify-between gap-5 p-5 sm:flex-row sm:items-center" aria-labelledby="new-operation-title">
        <div className="flex items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-mint/20 bg-mint/[.06] text-mint">
            <CircleDollarSign size={20} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <h2 id="new-operation-title" className="text-sm font-semibold text-slate-200">¿Nueva operación?</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Crea una venta y asóciala con una cuenta activa.</p>
          </div>
        </div>
        <Link
          to="/admin/sales"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-mint px-4 text-sm font-semibold text-[#062019] transition-[background-color,transform] duration-150 hover:bg-[#83f5d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel active:scale-[.98]"
        >
          Gestionar ventas
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Preparando el resumen</span>
      <div className="surface grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={cn('min-h-36 animate-pulse p-5', metricBorders[item])}>
            <div className="size-10 rounded-xl bg-white/[.045]" />
            <div className="mt-6 h-8 w-20 rounded-lg bg-white/[.06]" />
            <div className="mt-2 h-3 w-28 rounded bg-white/[.035]" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.85fr)]">
        <div className="surface min-h-80 animate-pulse p-5"><div className="h-4 w-36 rounded bg-white/[.055]" /><div className="mt-8 space-y-4">{[0, 1, 2].map((item) => <div key={item} className="h-12 rounded-xl bg-white/[.025]" />)}</div></div>
        <div className="surface min-h-80 animate-pulse p-5"><div className="h-4 w-32 rounded bg-white/[.055]" /><div className="mt-8 space-y-4">{[0, 1, 2].map((item) => <div key={item} className="h-12 rounded-xl bg-white/[.025]" />)}</div></div>
      </div>
    </div>
  );
}
