import { Activity, ArrowRight, CheckCircle2, CircleDollarSign, Clock3, KeyRound, ReceiptText, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, ErrorBanner, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { formatCompactDate, isExpired } from '../lib/utils';
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

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await api<DashboardResponse>('/admin/dashboard')); }
    catch { setError('No pudimos cargar el resumen.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <Spinner label="Preparando el resumen" />;
  if (error || !data) return <ErrorBanner message={error || 'No hay datos disponibles.'} onRetry={() => void load()} />;

  const cards = [
    { label: 'Ventas activas', value: data.stats.activeSales, icon: ReceiptText, tone: 'text-sky-300 bg-sky-400/10', href: '/admin/sales' },
    { label: 'Cuentas activas', value: data.stats.activeAccounts, icon: UsersRound, tone: 'text-violet-300 bg-violet-400/10', href: '/admin/accounts' },
    { label: 'Códigos activos', value: data.stats.activeCodes, icon: KeyRound, tone: 'text-mint bg-mint/10', href: '/admin/codes' },
    { label: 'Entregados hoy', value: data.stats.codesDeliveredToday, icon: CheckCircle2, tone: 'text-amber-300 bg-amber-400/10', href: '/admin/logs' },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone, href }) => <Link to={href} key={label} className="surface group p-5 transition hover:-translate-y-0.5 hover:border-slate-600"><div className="flex items-start justify-between"><span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={19} /></span><ArrowRight size={15} className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-400" /></div><p className="mt-5 text-3xl font-semibold tracking-tight text-white">{value.toLocaleString('es-PE')}</p><p className="mt-1 text-xs text-slate-500">{label}</p></Link>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <div className="surface overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-100">Códigos recientes</h2><p className="mt-1 text-xs text-slate-500">Últimos registros del sistema</p></div><Link to="/admin/codes" className="text-xs font-semibold text-mint hover:text-white">Ver todos</Link></header>
          {data.recentCodes.length === 0 ? <div className="grid min-h-52 place-items-center text-sm text-slate-600">Aún no hay códigos registrados.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-line text-[10px] uppercase tracking-wider text-slate-600"><th className="px-5 py-3 font-semibold">Cuenta</th><th className="px-4 py-3 font-semibold">Código</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-5 py-3 text-right font-semibold">Creado</th></tr></thead><tbody>{data.recentCodes.map((code) => { const active = !code.used && !code.invalidatedAt && !isExpired(code.expiresAt); return <tr key={code.id} className="border-b border-line/60 last:border-0"><td className="px-5 py-4"><p className="text-sm font-medium text-slate-200">{code.account?.email || '—'}</p><p className="mt-0.5 text-[11px] text-slate-600">{code.account?.service}</p></td><td className="px-4 py-4 font-mono text-sm tracking-wider text-slate-300">{code.code}</td><td className="px-4 py-4"><Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activo' : code.used ? 'Usado' : 'Finalizado'}</Badge></td><td className="px-5 py-4 text-right text-xs text-slate-500">{formatCompactDate(code.createdAt)}</td></tr>; })}</tbody></table></div>}
        </div>

        <div className="surface overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-100">Actividad reciente</h2><p className="mt-1 text-xs text-slate-500">{data.stats.queriesToday} consultas hoy</p></div><Activity size={17} className="text-slate-600" /></header>
          <div className="divide-y divide-line/60 px-5">{data.recentLogs.length === 0 ? <div className="grid min-h-52 place-items-center text-sm text-slate-600">Sin actividad reciente.</div> : data.recentLogs.map((log) => <div className="flex gap-3 py-3.5" key={log.id}><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint/70" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-300">{activityLabels[log.action] || log.action.replaceAll('_', ' ')}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-600"><Clock3 size={10} />{formatCompactDate(log.createdAt)}{log.account?.email && ` · ${log.account.email}`}</p></div></div>)}</div>
        </div>
      </section>

      <div className="surface flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-4"><span className="grid size-11 place-items-center rounded-xl bg-mint/10 text-mint"><CircleDollarSign size={20} /></span><div><p className="text-sm font-medium text-slate-200">¿Nueva operación?</p><p className="mt-1 text-xs text-slate-500">Crea una venta y asóciala con una cuenta activa.</p></div></div><Link to="/admin/sales" className="inline-flex items-center gap-2 text-xs font-semibold text-mint hover:text-white">Gestionar ventas <ArrowRight size={14} /></Link></div>
    </div>
  );
}
