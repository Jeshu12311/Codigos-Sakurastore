import { Activity, ChevronLeft, ChevronRight, Globe2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, EmptyState, ErrorBanner, SearchInput, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import type { AuditLog } from '../types';

const labels: Record<string, string> = {
  PUBLIC_CODE_DELIVERED: 'Código entregado', PUBLIC_CODE_WAITING: 'En espera', PUBLIC_QUERY_REJECTED: 'Consulta rechazada',
  CODE_CREATED: 'Código creado', CODE_INVALIDATED: 'Código invalidado', CODE_MARKED_USED: 'Código usado',
  SALE_CREATED: 'Venta creada', SALE_UPDATED: 'Venta actualizada', ACCOUNT_CREATED: 'Cuenta creada', ACCOUNT_UPDATED: 'Cuenta actualizada',
  ADMIN_LOGIN: 'Inicio de sesión', ADMIN_LOGOUT: 'Cierre de sesión', ADMIN_LOGIN_FAILED: 'Acceso fallido',
};
const actionTone = (action: string) => action.includes('REJECTED') || action.includes('FAILED') ? 'danger' as const : action.includes('DELIVERED') || action.includes('CREATED') ? 'success' as const : action.includes('WAITING') ? 'warning' as const : 'neutral' as const;

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '50' }); if (appliedSearch) query.set('action', appliedSearch);
      const response = await api<{ logs: AuditLog[]; pagination: { total: number; pages: number } }>(`/admin/logs?${query}`);
      setLogs(response.logs); setPages(Math.max(1, response.pagination.pages)); setTotal(response.pagination.total);
    } catch { setError('No pudimos cargar el registro de actividad.'); }
    finally { setLoading(false); }
  }, [page, appliedSearch]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setAppliedSearch(search.trim()); }, 350); return () => window.clearTimeout(timer); }, [search]);

  return <div className="space-y-5">
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><SearchInput value={search} onChange={setSearch} placeholder="Filtrar por acción…" /><span className="text-xs text-slate-600">{total.toLocaleString('es-PE')} registros</span></div>
    <section className="surface overflow-hidden">{loading ? <Spinner label="Cargando actividad" /> : logs.length === 0 ? <EmptyState icon={<Activity size={22} />} title="Sin actividad" description="No hay registros que coincidan con este filtro." /> : <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead><tr className="border-b border-line bg-white/[.015] text-[10px] uppercase tracking-wider text-slate-600"><th className="px-5 py-3 font-semibold">Acción</th><th className="px-4 py-3 font-semibold">Cuenta</th><th className="px-4 py-3 font-semibold">Venta</th><th className="px-4 py-3 font-semibold">Dirección IP</th><th className="px-5 py-3 text-right font-semibold">Fecha</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-b border-line/60 last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4"><Badge tone={actionTone(log.action)}>{labels[log.action] || log.action.replaceAll('_', ' ')}</Badge></td><td className="px-4 py-4 font-mono text-xs text-slate-400">{log.account?.email || '—'}</td><td className="px-4 py-4 font-mono text-xs tracking-wider text-slate-400">{log.sale?.saleCode || '—'}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-500"><Globe2 size={13} />{log.ip}</span></td><td className="px-5 py-4 text-right text-xs text-slate-500">{formatDate(log.createdAt)}</td></tr>)}</tbody></table></div>}</section>
    {pages > 1 && <div className="flex items-center justify-between"><p className="text-xs text-slate-600">Página {page} de {pages}</p><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} /> Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Siguiente <ChevronRight size={15} /></Button></div></div>}
  </div>;
}
