import { Pencil, Plus, Power, UsersRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, SearchInput, Select, Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/utils';
import type { Account, AccountStatus } from '../types';

const services = ['Streaming', 'Software', 'Servicio interno', 'Otro'];

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [email, setEmail] = useState('');
  const [service, setService] = useState('Streaming');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api<{ accounts: Account[] }>('/admin/accounts'); setAccounts(response.accounts); }
    catch { setError('No pudimos cargar las cuentas.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => { const query = search.toLowerCase().trim(); return !query ? accounts : accounts.filter((account) => account.email.toLowerCase().includes(query) || account.service.toLowerCase().includes(query)); }, [accounts, search]);

  function openCreate() { setEditing(null); setEmail(''); setService('Streaming'); setFormError(''); setModal(true); }
  function openEdit(account: Account) { setEditing(account); setEmail(account.email); setService(account.service); setFormError(''); setModal(true); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setFormError('');
    try {
      const response = editing
        ? await api<{ account: Account }>(`/admin/accounts/${editing.id}`, { method: 'PATCH', body: { email: email.trim().toLowerCase(), service } })
        : await api<{ account: Account }>('/admin/accounts', { method: 'POST', body: { email: email.trim().toLowerCase(), service } });
      setAccounts((current) => editing ? current.map((item) => item.id === editing.id ? { ...item, ...response.account } : item) : [response.account, ...current]);
      setModal(false);
    } catch (requestError) { setFormError(requestError instanceof ApiError ? requestError.message : 'No se pudo guardar la cuenta.'); }
    finally { setSubmitting(false); }
  }

  async function toggle(account: Account) {
    const status: AccountStatus = account.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try { const response = await api<{ account: Account }>(`/admin/accounts/${account.id}`, { method: 'PATCH', body: { status } }); setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, ...response.account } : item)); }
    catch { setError('No se pudo cambiar el estado de la cuenta.'); }
  }

  if (loading) return <Spinner label="Cargando cuentas" />;
  return <div className="space-y-5">
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <div className="flex flex-col justify-between gap-3 sm:flex-row"><SearchInput value={search} onChange={setSearch} placeholder="Buscar correo o servicio…" /><Button onClick={openCreate}><Plus size={16} /> Nueva cuenta</Button></div>
    <section className="surface overflow-hidden">
      {filtered.length === 0 ? <EmptyState icon={<UsersRound size={22} />} title={search ? 'No encontramos coincidencias' : 'Aún no hay cuentas'} description={search ? 'Prueba con otro término de búsqueda.' : 'Crea la primera cuenta para comenzar a asociar ventas.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-line bg-white/[.015] text-[10px] uppercase tracking-wider text-slate-600"><th className="px-5 py-3 font-semibold">Correo de la cuenta</th><th className="px-4 py-3 font-semibold">Servicio</th><th className="px-4 py-3 font-semibold">Ventas</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Creada</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{filtered.map((account) => <tr key={account.id} className="border-b border-line/60 transition last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4 font-mono text-sm font-medium text-slate-200">{account.email}</td><td className="px-4 py-4 text-sm text-slate-400">{account.service}</td><td className="px-4 py-4 text-sm text-slate-500">{account._count?.sales ?? 0}</td><td className="px-4 py-4"><Badge tone={account.status === 'ACTIVE' ? 'success' : 'neutral'}>{account.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(account.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button title="Editar" onClick={() => openEdit(account)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><Pencil size={15} /></button><button title={account.status === 'ACTIVE' ? 'Desactivar' : 'Activar'} onClick={() => void toggle(account)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><Power size={15} /></button></div></td></tr>)}</tbody></table></div>}
    </section>
    <Modal open={modal} title={editing ? 'Editar cuenta' : 'Nueva cuenta'} description="El correo será el identificador que el comprador usará para consultar códigos." onClose={() => setModal(false)}><form onSubmit={submit} className="space-y-5"><Input label="Correo de la cuenta" type="email" autoComplete="off" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cuenta@ejemplo.com" /><Select label="Servicio" value={service} onChange={(event) => setService(event.target.value)}>{services.map((item) => <option value={item} key={item}>{item}</option>)}</Select>{formError && <ErrorBanner message={formError} />}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit" loading={submitting}>{editing ? 'Guardar cambios' : 'Crear cuenta'}</Button></div></form></Modal>
  </div>;
}
