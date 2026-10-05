import { Ban, Check, CheckCircle2, Clipboard, KeyRound, Plus } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, SearchInput, Select, Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate, isExpired, toDateTimeLocal } from '../lib/utils';
import type { Account, Sale, TemporaryCode } from '../types';

type CodeFilter = 'all' | 'active' | 'expired';

const iconButtonClass = 'icon-button size-9 rounded-lg disabled:cursor-not-allowed disabled:opacity-40';
const filterButtonClass = 'min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50';

function codeStatus(code: TemporaryCode) {
  if (code.invalidatedAt) return { label: 'Invalidado', tone: 'danger' as const };
  if (code.used) return { label: 'Usado', tone: 'info' as const };
  if (isExpired(code.expiresAt)) return { label: 'Expirado', tone: 'neutral' as const };
  return { label: 'Activo', tone: 'success' as const };
}

export function CodesPage() {
  const [codes, setCodes] = useState<TemporaryCode[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CodeFilter>('all');
  const [modal, setModal] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [saleId, setSaleId] = useState('');
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState('');
  const [working, setWorking] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [codesResponse, accountsResponse, salesResponse] = await Promise.all([api<{ codes: TemporaryCode[] }>('/admin/codes'), api<{ accounts: Account[] }>('/admin/accounts'), api<{ sales: Sale[] }>('/admin/sales?active=true')]);
      setCodes(codesResponse.codes); setAccounts(accountsResponse.accounts.filter((account) => account.status === 'ACTIVE')); setSales(salesResponse.sales.filter((sale) => new Date(sale.expiresAt).getTime() > Date.now()));
    } catch { setError('No pudimos cargar los códigos.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return codes.filter((code) => {
      const active = !code.used && !code.invalidatedAt && !isExpired(code.expiresAt);
      if (filter === 'active' && !active) return false;
      if (filter === 'expired' && active) return false;
      return !query || code.code.toLowerCase().includes(query) || code.account?.email.toLowerCase().includes(query);
    });
  }, [codes, search, filter]);

  function openCreate() {
    const firstAccount = accounts.find((account) => sales.some((sale) => sale.accountId === account.id));
    setAccountId(firstAccount?.id || ''); setSaleId(sales.find((sale) => sale.accountId === firstAccount?.id)?.id || ''); setValue(''); setExpiresAt(toDateTimeLocal(new Date(Date.now() + 10 * 60_000))); setFormError(''); setModal(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setFormError('');
    try {
      const response = await api<{ code: TemporaryCode }>('/admin/codes', { method: 'POST', body: { accountId, saleId, code: value.trim(), expiresAt: new Date(expiresAt).toISOString() } });
      const account = accounts.find((item) => item.id === accountId);
      const sale = sales.find((item) => item.id === saleId);
      setCodes((current) => [{ ...response.code, account: response.code.account || account, sale: response.code.sale || (sale ? { saleCode: sale.saleCode } : null) }, ...current]); setModal(false);
    } catch (requestError) { setFormError(requestError instanceof ApiError ? requestError.message : 'No se pudo registrar el código.'); }
    finally { setSubmitting(false); }
  }

  async function update(code: TemporaryCode, action: 'invalidate' | 'use') {
    setWorking(code.id);
    try {
      const response = await api<{ code: TemporaryCode }>(`/admin/codes/${code.id}/${action}`, { method: 'PATCH' });
      setCodes((current) => current.map((item) => item.id === code.id ? { ...item, ...response.code } : item));
    } catch { setError(`No se pudo ${action === 'use' ? 'marcar como usado' : 'invalidar'} el código.`); }
    finally { setWorking(''); }
  }

  async function copy(code: string) { await navigator.clipboard.writeText(code); setCopied(code); window.setTimeout(() => setCopied(''), 1400); }
  if (loading) return <Spinner label="Cargando códigos" />;

  return <div className="space-y-5">
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <div className="flex flex-col items-stretch justify-between gap-3 xl:flex-row xl:items-center"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><SearchInput value={search} onChange={setSearch} placeholder="Buscar código o correo…" /><div className="grid grid-cols-3 rounded-xl border border-line bg-[#0b0f17] p-1 sm:flex" role="group" aria-label="Filtrar códigos">{(['all', 'active', 'expired'] as const).map((item) => <button type="button" aria-pressed={filter === item} key={item} onClick={() => setFilter(item)} className={`${filterButtonClass} ${filter === item ? 'bg-white/[.08] text-white' : 'text-slate-500 hover:bg-white/[.03] hover:text-slate-300'}`}>{item === 'all' ? 'Todos' : item === 'active' ? 'Activos' : 'Finalizados'}</button>)}</div></div><Button type="button" className="w-full xl:w-auto" onClick={openCreate} disabled={!sales.length}><Plus size={16} /> Registrar código</Button></div>
    <section className="surface overflow-hidden">
      {filtered.length === 0 ? <EmptyState icon={<KeyRound size={22} />} title={search ? 'No encontramos códigos' : 'Aún no hay códigos'} description={search ? 'Ajusta la búsqueda o cambia el filtro.' : 'Registra un código temporal para una cuenta activa.'} /> : <div className="overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[980px] text-left tabular-nums"><thead><tr className="border-b border-line bg-[#0b1018] text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-semibold">Código</th><th className="px-4 py-3 font-semibold">Correo de la cuenta</th><th className="px-4 py-3 font-semibold">Origen</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Creado</th><th className="px-4 py-3 font-semibold">Expira</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{filtered.map((code) => { const status = codeStatus(code); const active = status.label === 'Activo'; return <tr key={code.id} className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-mono text-base font-semibold tracking-[.12em] text-slate-200">{code.code}</span><button type="button" aria-label={copied === code.code ? `Código ${code.code} copiado` : `Copiar código ${code.code}`} onClick={() => void copy(code.code)} className={`${iconButtonClass} hover:text-mint`} title={copied === code.code ? 'Copiado' : 'Copiar'}>{copied === code.code ? <Check size={15} /> : <Clipboard size={15} />}</button></div></td><td className="px-4 py-4"><p className="font-mono text-xs text-slate-300">{code.account?.email || '—'}</p><p className="mt-1 text-[10px] text-slate-600">{code.account?.service}</p></td><td className="px-4 py-4"><Badge tone={code.source === 'EMAIL' ? 'info' : 'neutral'}>{code.source === 'EMAIL' ? 'Correo' : 'Manual'}</Badge>{code.sale?.saleCode && <p className="mt-1 font-mono text-[10px] text-slate-600">{code.sale.saleCode}</p>}</td><td className="px-4 py-4"><Badge tone={status.tone}>{status.label}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(code.createdAt)}</td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(code.expiresAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1">{active && <><button type="button" disabled={working === code.id} aria-label={`Marcar código ${code.code} como usado`} title="Marcar como usado" onClick={() => void update(code, 'use')} className={`${iconButtonClass} hover:bg-sky-500/10 hover:text-sky-300`}><CheckCircle2 size={16} /></button><button type="button" disabled={working === code.id} aria-label={`Invalidar código ${code.code}`} title="Invalidar código" onClick={() => void update(code, 'invalidate')} className={`${iconButtonClass} hover:bg-red-500/10 hover:text-red-300`}><Ban size={16} /></button></>}</div></td></tr>; })}</tbody></table></div>}
    </section>
    <Modal open={modal} title="Registrar código temporal" description="El código quedará disponible únicamente para la venta seleccionada." onClose={() => setModal(false)}><form onSubmit={submit} className="space-y-5"><Select label="Correo de la cuenta" value={accountId} onChange={(event) => { const nextAccountId = event.target.value; setAccountId(nextAccountId); setSaleId(sales.find((sale) => sale.accountId === nextAccountId)?.id || ''); }} required><option value="" disabled>Selecciona una cuenta</option>{accounts.filter((account) => sales.some((sale) => sale.accountId === account.id)).map((account) => <option key={account.id} value={account.id}>{account.email} · {account.service}</option>)}</Select><Select label="Venta autorizada" value={saleId} onChange={(event) => setSaleId(event.target.value)} required><option value="" disabled>Selecciona una venta</option>{sales.filter((sale) => sale.accountId === accountId).map((sale) => <option key={sale.id} value={sale.id}>{sale.saleCode}{sale.customerReference ? ` · ${sale.customerReference}` : ''}</option>)}</Select><Input label="Código temporal" required minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" value={value} onChange={(event) => setValue(event.target.value.replace(/\s/g, ''))} placeholder="483921" className="font-mono text-lg tracking-widest" /><Input label="Fecha de expiración" type="datetime-local" required min={toDateTimeLocal(new Date(Date.now() + 60_000))} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />{formError && <ErrorBanner message={formError} />}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit" loading={submitting}>Registrar código</Button></div></form></Modal>
  </div>;
}
