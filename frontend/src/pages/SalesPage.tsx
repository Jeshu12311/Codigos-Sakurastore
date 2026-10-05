import { Check, Clipboard, Pencil, Plus, Power, ReceiptText } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, SearchInput, Select, Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate, isExpired, toDateTimeLocal } from '../lib/utils';
import type { Account, Sale } from '../types';

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [accountId, setAccountId] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [salesResponse, accountsResponse] = await Promise.all([
        api<{ sales: Sale[] }>('/admin/sales'),
        api<{ accounts: Account[] }>('/admin/accounts'),
      ]);
      setSales(salesResponse.sales); setAccounts(accountsResponse.accounts.filter((account) => account.status === 'ACTIVE'));
    } catch { setError('No pudimos cargar las ventas.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return sales.filter((sale) => {
      const active = sale.active && !isExpired(sale.expiresAt);
      if (filter === 'active' && !active) return false;
      if (filter === 'inactive' && active) return false;
      return !query || sale.saleCode.toLowerCase().includes(query) || sale.customerReference?.toLowerCase().includes(query) || sale.account?.email.toLowerCase().includes(query);
    });
  }, [sales, search, filter]);

  function openCreate() {
    setEditing(null); setAccountId(accounts[0]?.id || ''); setCustomerReference('');
    setExpiresAt(toDateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60_000))); setFormError(''); setModal(true);
  }
  function openEdit(sale: Sale) {
    setEditing(sale); setAccountId(sale.accountId); setCustomerReference(sale.customerReference || '');
    setExpiresAt(toDateTimeLocal(new Date(sale.expiresAt))); setFormError(''); setModal(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setFormError('');
    try {
      const response = editing
        ? await api<{ sale: Sale }>(`/admin/sales/${editing.id}`, { method: 'PATCH', body: { customerReference: customerReference.trim() || null, expiresAt: new Date(expiresAt).toISOString() } })
        : await api<{ sale: Sale }>('/admin/sales', { method: 'POST', body: { accountId, customerReference: customerReference.trim() || null, expiresAt: new Date(expiresAt).toISOString() } });
      setSales((current) => editing ? current.map((item) => item.id === editing.id ? response.sale : item) : [response.sale, ...current]);
      setModal(false);
    } catch (requestError) { setFormError(requestError instanceof ApiError ? requestError.message : 'No se pudo guardar la venta.'); }
    finally { setSubmitting(false); }
  }

  async function toggle(sale: Sale) {
    try { const response = await api<{ sale: Sale }>(`/admin/sales/${sale.id}`, { method: 'PATCH', body: { active: !sale.active } }); setSales((current) => current.map((item) => item.id === sale.id ? response.sale : item)); }
    catch { setError('No se pudo cambiar el estado de la venta.'); }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value); setCopied(value); window.setTimeout(() => setCopied(''), 1400);
  }

  if (loading) return <Spinner label="Cargando ventas" />;
  return <div className="space-y-5">
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <div className="flex flex-col justify-between gap-3 xl:flex-row"><div className="flex flex-col gap-3 sm:flex-row"><SearchInput value={search} onChange={setSearch} placeholder="Código, cliente o correo…" /><div className="flex rounded-xl border border-line bg-[#0b0f17] p-1">{(['all', 'active', 'inactive'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === item ? 'bg-white/[.08] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{item === 'all' ? 'Todas' : item === 'active' ? 'Activas' : 'Finalizadas'}</button>)}</div></div><Button onClick={openCreate} disabled={!accounts.length}><Plus size={16} /> Nueva venta</Button></div>
    <section className="surface overflow-hidden">
      {filtered.length === 0 ? <EmptyState icon={<ReceiptText size={22} />} title={search ? 'No encontramos ventas' : 'Aún no hay ventas'} description={search ? 'Ajusta la búsqueda o cambia el filtro.' : 'Crea una venta para entregar códigos a un cliente.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead><tr className="border-b border-line bg-white/[.015] text-[10px] uppercase tracking-wider text-slate-600"><th className="px-5 py-3 font-semibold">Venta</th><th className="px-4 py-3 font-semibold">Correo de la cuenta</th><th className="px-4 py-3 font-semibold">Referencia</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Expira</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{filtered.map((sale) => { const active = sale.active && !isExpired(sale.expiresAt); return <tr key={sale.id} className="border-b border-line/60 transition last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold tracking-wider text-slate-200">{sale.saleCode}</span><button onClick={() => void copy(sale.saleCode)} className="p-1 text-slate-600 hover:text-mint" title="Copiar">{copied === sale.saleCode ? <Check size={13} /> : <Clipboard size={13} />}</button></div><p className="mt-1 text-[10px] text-slate-600">{formatDate(sale.createdAt)}</p></td><td className="px-4 py-4"><p className="font-mono text-xs text-slate-300">{sale.account?.email || '—'}</p><p className="mt-1 text-[10px] text-slate-600">{sale.account?.service}</p></td><td className="max-w-[220px] truncate px-4 py-4 text-sm text-slate-500">{sale.customerReference || '—'}</td><td className="px-4 py-4"><Badge tone={active ? 'success' : sale.active ? 'warning' : 'neutral'}>{active ? 'Activa' : sale.active ? 'Expirada' : 'Desactivada'}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(sale.expiresAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button title="Editar" onClick={() => openEdit(sale)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><Pencil size={15} /></button><button title={sale.active ? 'Desactivar' : 'Activar'} onClick={() => void toggle(sale)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><Power size={15} /></button></div></td></tr>; })}</tbody></table></div>}
    </section>
    <Modal open={modal} title={editing ? 'Editar venta' : 'Nueva venta'} description={editing ? `Actualiza los datos de ${editing.saleCode}.` : 'El código de venta se generará automáticamente.'} onClose={() => setModal(false)}><form onSubmit={submit} className="space-y-5"><Select label="Correo de la cuenta" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={!!editing} required><option value="" disabled>Selecciona una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email} · {account.service}</option>)}</Select><Input label="Referencia del cliente (opcional)" maxLength={120} value={customerReference} onChange={(event) => setCustomerReference(event.target.value)} placeholder="Pedido, nombre o referencia interna" /><Input label="Fecha de expiración" type="datetime-local" required min={toDateTimeLocal(new Date(Date.now() + 60_000))} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />{formError && <ErrorBanner message={formError} />}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit" loading={submitting}>{editing ? 'Guardar cambios' : 'Crear venta'}</Button></div></form></Modal>
  </div>;
}
