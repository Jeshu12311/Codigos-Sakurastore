import { Ban, Check, CheckCircle2, Clipboard, KeyRound, Plus } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, SearchInput, Select, Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate, isExpired, toDateTimeLocal } from '../lib/utils';
import type { Account, TemporaryCode } from '../types';

type CodeFilter = 'all' | 'active' | 'expired';

function codeStatus(code: TemporaryCode) {
  if (code.invalidatedAt) return { label: 'Invalidado', tone: 'danger' as const };
  if (code.used) return { label: 'Usado', tone: 'info' as const };
  if (isExpired(code.expiresAt)) return { label: 'Expirado', tone: 'neutral' as const };
  return { label: 'Activo', tone: 'success' as const };
}

export function CodesPage() {
  const [codes, setCodes] = useState<TemporaryCode[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CodeFilter>('all');
  const [modal, setModal] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [value, setValue] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState('');
  const [working, setWorking] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [codesResponse, accountsResponse] = await Promise.all([api<{ codes: TemporaryCode[] }>('/admin/codes'), api<{ accounts: Account[] }>('/admin/accounts')]);
      setCodes(codesResponse.codes); setAccounts(accountsResponse.accounts.filter((account) => account.status === 'ACTIVE'));
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
    setAccountId(accounts[0]?.id || ''); setValue(''); setExpiresAt(toDateTimeLocal(new Date(Date.now() + 10 * 60_000))); setFormError(''); setModal(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setFormError('');
    try {
      const response = await api<{ code: TemporaryCode }>('/admin/codes', { method: 'POST', body: { accountId, code: value.trim(), expiresAt: new Date(expiresAt).toISOString() } });
      const account = accounts.find((item) => item.id === accountId);
      setCodes((current) => [{ ...response.code, account: response.code.account || account }, ...current]); setModal(false);
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
    <div className="flex flex-col justify-between gap-3 xl:flex-row"><div className="flex flex-col gap-3 sm:flex-row"><SearchInput value={search} onChange={setSearch} placeholder="Buscar código o correo…" /><div className="flex rounded-xl border border-line bg-[#0b0f17] p-1">{(['all', 'active', 'expired'] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === item ? 'bg-white/[.08] text-white' : 'text-slate-500 hover:text-slate-300'}`}>{item === 'all' ? 'Todos' : item === 'active' ? 'Activos' : 'Finalizados'}</button>)}</div></div><Button onClick={openCreate} disabled={!accounts.length}><Plus size={16} /> Registrar código</Button></div>
    <section className="surface overflow-hidden">
      {filtered.length === 0 ? <EmptyState icon={<KeyRound size={22} />} title={search ? 'No encontramos códigos' : 'Aún no hay códigos'} description={search ? 'Ajusta la búsqueda o cambia el filtro.' : 'Registra un código temporal para una cuenta activa.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead><tr className="border-b border-line bg-white/[.015] text-[10px] uppercase tracking-wider text-slate-600"><th className="px-5 py-3 font-semibold">Código</th><th className="px-4 py-3 font-semibold">Correo de la cuenta</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Creado</th><th className="px-4 py-3 font-semibold">Expira</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{filtered.map((code) => { const status = codeStatus(code); const active = status.label === 'Activo'; return <tr key={code.id} className="border-b border-line/60 transition last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4"><div className="flex items-center gap-2"><span className="font-mono text-base font-semibold tracking-[.12em] text-slate-200">{code.code}</span><button onClick={() => void copy(code.code)} className="p-1 text-slate-600 hover:text-mint" title="Copiar">{copied === code.code ? <Check size={13} /> : <Clipboard size={13} />}</button></div></td><td className="px-4 py-4"><p className="font-mono text-xs text-slate-300">{code.account?.email || '—'}</p><p className="mt-1 text-[10px] text-slate-600">{code.account?.service}</p></td><td className="px-4 py-4"><Badge tone={status.tone}>{status.label}</Badge></td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(code.createdAt)}</td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(code.expiresAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1">{active && <><button disabled={working === code.id} title="Marcar como usado" onClick={() => void update(code, 'use')} className="rounded-lg p-2 text-slate-500 hover:bg-sky-500/10 hover:text-sky-300 disabled:opacity-40"><CheckCircle2 size={16} /></button><button disabled={working === code.id} title="Invalidar código" onClick={() => void update(code, 'invalidate')} className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"><Ban size={16} /></button></>}</div></td></tr>; })}</tbody></table></div>}
    </section>
    <Modal open={modal} title="Registrar código temporal" description="El código quedará disponible para las ventas activas de esta cuenta." onClose={() => setModal(false)}><form onSubmit={submit} className="space-y-5"><Select label="Correo de la cuenta" value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="" disabled>Selecciona una cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email} · {account.service}</option>)}</Select><Input label="Código temporal" required minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" value={value} onChange={(event) => setValue(event.target.value.replace(/\s/g, ''))} placeholder="483921" className="font-mono text-lg tracking-widest" /><Input label="Fecha de expiración" type="datetime-local" required min={toDateTimeLocal(new Date(Date.now() + 60_000))} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />{formError && <ErrorBanner message={formError} />}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit" loading={submitting}>Registrar código</Button></div></form></Modal>
  </div>;
}
