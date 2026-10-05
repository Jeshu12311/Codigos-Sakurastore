import { Check, Copy, ExternalLink, Link2, Mail, Pencil, Plus, Power, RefreshCw, Settings2, Unplug, UsersRound, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, EmptyState, ErrorBanner, Input, Modal, SearchInput, Select, Spinner } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { formatDate } from '../lib/utils';
import type { Account, AccountStatus, MailConnectionStatus, MailIntegrationConfig, MailProvider } from '../types';

const services = ['Streaming', 'Software', 'Servicio interno', 'Otro'];

const mailboxStatuses: Record<MailConnectionStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: 'Conectado', tone: 'success' },
  REAUTH_REQUIRED: { label: 'Requiere reconexión', tone: 'warning' },
  REVOKED: { label: 'Revocado', tone: 'danger' },
  ERROR: { label: 'Error', tone: 'danger' },
};

type MailboxNotice = { tone: 'success' | 'error'; text: string };
type ConnectResponse = { authorizationUrl?: string; redirectUrl?: string; url?: string };

const iconButtonClass = 'icon-button size-9 rounded-lg disabled:cursor-not-allowed disabled:opacity-40';

export function AccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [mailboxAccount, setMailboxAccount] = useState<Account | null>(null);
  const [senderInput, setSenderInput] = useState('');
  const [senderAllowlist, setSenderAllowlist] = useState<string[]>([]);
  const [mailboxError, setMailboxError] = useState('');
  const [mailboxAction, setMailboxAction] = useState<MailProvider | 'sync' | 'disconnect' | null>(null);
  const [mailboxNotice, setMailboxNotice] = useState<MailboxNotice | null>(null);
  const [mailConfig, setMailConfig] = useState<MailIntegrationConfig | null>(null);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);
  const [copiedSetupValue, setCopiedSetupValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [response, config] = await Promise.all([
        api<{ accounts: Account[] }>('/admin/accounts'),
        api<MailIntegrationConfig>('/admin/mail/config'),
      ]);
      setAccounts(response.accounts);
      setMailConfig(config);
    } catch { setError('No pudimos cargar las cuentas.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const result = searchParams.get('mailbox');
    if (!result) return;
    setMailboxNotice(result === 'connected'
      ? { tone: 'success', text: 'El buzón se conectó correctamente.' }
      : { tone: 'error', text: 'No se pudo conectar el buzón. Inténtalo nuevamente.' });
    const next = new URLSearchParams(searchParams);
    next.delete('mailbox');
    setSearchParams(next, { replace: true });
    void load();
  }, [load, searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return !query ? accounts : accounts.filter((account) => account.email.toLowerCase().includes(query) || account.service.toLowerCase().includes(query));
  }, [accounts, search]);

  function openCreate() { setEditing(null); setEmail(''); setService('Streaming'); setFormError(''); setModal(true); }
  function openEdit(account: Account) { setEditing(account); setEmail(account.email); setService(account.service); setFormError(''); setModal(true); }
  function openMailbox(account: Account) {
    setMailboxAccount(account); setSenderInput(''); setMailboxError('');
    setSenderAllowlist(account.mailboxConnection?.senderAllowlist ?? []);
  }

  function addSender() {
    const sender = senderInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
      setMailboxError('Ingresa un correo válido para el remitente permitido.');
      return;
    }
    setSenderAllowlist((current) => current.includes(sender) ? current : [...current, sender]);
    setSenderInput(''); setMailboxError('');
  }

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
    try {
      const response = await api<{ account: Account }>(`/admin/accounts/${account.id}`, { method: 'PATCH', body: { status } });
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, ...response.account } : item));
    } catch { setError('No se pudo cambiar el estado de la cuenta.'); }
  }

  async function connectMailbox(provider: MailProvider) {
    if (!mailboxAccount) return;
    if (senderAllowlist.length === 0) {
      setMailboxError('Agrega al menos un remitente permitido antes de conectar el buzón.');
      return;
    }
    setMailboxAction(provider); setMailboxError('');
    try {
      const response = await api<ConnectResponse>(`/admin/mail/accounts/${mailboxAccount.id}/connect/${provider.toLowerCase()}`, {
        method: 'POST', body: { senderAllowlist },
      });
      const authorizationUrl = response.authorizationUrl ?? response.redirectUrl ?? response.url;
      if (!authorizationUrl) throw new Error('No se recibió la URL de autorización.');
      window.location.assign(authorizationUrl);
    } catch (requestError) {
      setMailboxError(requestError instanceof ApiError ? requestError.message : 'No se pudo iniciar la conexión del buzón.');
      if (requestError instanceof ApiError && requestError.status === 503) setSetupGuideOpen(true);
      setMailboxAction(null);
    }
  }

  async function syncMailbox() {
    if (!mailboxAccount) return;
    setMailboxAction('sync'); setMailboxError('');
    try {
      await api(`/admin/mail/accounts/${mailboxAccount.id}/sync`, { method: 'POST' });
      await load();
      setMailboxNotice({ tone: 'success', text: 'La sincronización del buzón se inició correctamente.' });
    } catch (requestError) { setMailboxError(requestError instanceof ApiError ? requestError.message : 'No se pudo sincronizar el buzón.'); }
    finally { setMailboxAction(null); }
  }

  async function disconnectMailbox() {
    if (!mailboxAccount) return;
    setMailboxAction('disconnect'); setMailboxError('');
    try {
      await api(`/admin/mail/accounts/${mailboxAccount.id}/connection`, { method: 'DELETE' });
      setAccounts((current) => current.map((account) => account.id === mailboxAccount.id ? { ...account, mailboxConnection: null } : account));
      setMailboxAccount((current) => current ? { ...current, mailboxConnection: null } : null);
      setMailboxNotice({ tone: 'success', text: 'El buzón se desconectó.' });
    } catch (requestError) { setMailboxError(requestError instanceof ApiError ? requestError.message : 'No se pudo desconectar el buzón.'); }
    finally { setMailboxAction(null); }
  }

  if (loading) return <Spinner label="Cargando cuentas" />;
  return <div className="space-y-5">
    {mailboxNotice && <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${mailboxNotice.tone === 'success' ? 'border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200' : 'border-red-500/20 bg-red-500/[.08] text-red-200'}`}><span>{mailboxNotice.text}</span><button type="button" aria-label="Cerrar aviso" title="Cerrar aviso" onClick={() => setMailboxNotice(null)} className={`${iconButtonClass} text-current opacity-70 hover:text-current hover:opacity-100`}><X size={16} /></button></div>}
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    {mailConfig && <MailSetupCard config={mailConfig} onOpen={() => setSetupGuideOpen(true)} />}
    <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"><SearchInput value={search} onChange={setSearch} placeholder="Buscar correo o servicio…" /><Button type="button" className="w-full sm:w-auto" onClick={openCreate}><Plus size={16} /> Nueva cuenta</Button></div>
    <section className="surface overflow-hidden">
      {filtered.length === 0 ? <EmptyState icon={<UsersRound size={22} />} title={search ? 'No encontramos coincidencias' : 'Aún no hay cuentas'} description={search ? 'Prueba con otro término de búsqueda.' : 'Crea la primera cuenta para comenzar a asociar ventas.'} /> : <div className="overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[860px] text-left tabular-nums"><thead><tr className="border-b border-line bg-[#0b1018] text-[10px] uppercase tracking-wider text-slate-500"><th className="px-5 py-3 font-semibold">Correo de la cuenta</th><th className="px-4 py-3 font-semibold">Servicio</th><th className="px-4 py-3 font-semibold">Ventas</th><th className="px-4 py-3 font-semibold">Buzón</th><th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Creada</th><th className="px-5 py-3 text-right font-semibold">Acciones</th></tr></thead><tbody>{filtered.map((account) => { const connection = account.mailboxConnection; const mailboxStatus = connection ? mailboxStatuses[connection.status] : null; return <tr key={account.id} className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-white/[.018]"><td className="px-5 py-4 font-mono text-sm font-medium text-slate-200">{account.email}</td><td className="px-4 py-4 text-sm text-slate-400">{account.service}</td><td className="px-4 py-4 text-sm text-slate-500">{account._count?.sales ?? 0}</td><td className="px-4 py-4">{connection && mailboxStatus ? <div className="space-y-1"><Badge tone={mailboxStatus.tone}>{connection.provider === 'GOOGLE' ? 'Gmail' : 'Outlook'}</Badge><p className="max-w-[150px] truncate text-[10px] text-slate-500" title={connection.externalEmail}>{connection.externalEmail}</p></div> : <span className="text-xs text-slate-600">Sin conectar</span>}</td><td className="px-4 py-4"><Badge tone={account.status === 'ACTIVE' ? 'success' : 'neutral'}>{account.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</Badge>{mailboxStatus && <p className="mt-1 text-[10px] text-slate-500">{mailboxStatus.label}</p>}</td><td className="px-4 py-4 text-xs text-slate-500">{formatDate(account.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button type="button" aria-label={`Configurar buzón de ${account.email}`} title="Configurar buzón" onClick={() => openMailbox(account)} className={`${iconButtonClass} hover:text-mint`}><Mail size={16} /></button><button type="button" aria-label={`Editar cuenta ${account.email}`} title="Editar" onClick={() => openEdit(account)} className={`${iconButtonClass} hover:text-white`}><Pencil size={16} /></button><button type="button" aria-label={`${account.status === 'ACTIVE' ? 'Desactivar' : 'Activar'} cuenta ${account.email}`} title={account.status === 'ACTIVE' ? 'Desactivar' : 'Activar'} onClick={() => void toggle(account)} className={`${iconButtonClass} hover:text-white`}><Power size={16} /></button></div></td></tr>; })}</tbody></table></div>}
    </section>
    <Modal open={modal} title={editing ? 'Editar cuenta' : 'Nueva cuenta'} description="El correo será el identificador que el comprador usará para consultar códigos." onClose={() => setModal(false)}><form onSubmit={submit} className="space-y-5"><Input label="Correo de la cuenta" type="email" autoComplete="off" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cuenta@ejemplo.com" /><Select label="Servicio" value={service} onChange={(event) => setService(event.target.value)}>{services.map((item) => <option value={item} key={item}>{item}</option>)}</Select>{formError && <ErrorBanner message={formError} />}<div className="flex justify-end gap-3 pt-2"><Button type="button" variant="ghost" onClick={() => setModal(false)}>Cancelar</Button><Button type="submit" loading={submitting}>{editing ? 'Guardar cambios' : 'Crear cuenta'}</Button></div></form></Modal>
    <Modal open={!!mailboxAccount} title="Conectar buzón" description={mailboxAccount ? `Autoriza únicamente el buzón que recibirá códigos para ${mailboxAccount.email}.` : undefined} onClose={() => setMailboxAccount(null)}>{mailboxAccount && <MailboxModal account={mailboxAccount} senders={senderAllowlist} senderInput={senderInput} error={mailboxError} action={mailboxAction} onSenderInput={setSenderInput} onAddSender={addSender} onRemoveSender={(sender) => setSenderAllowlist((current) => current.filter((item) => item !== sender))} onConnect={connectMailbox} onSync={syncMailbox} onDisconnect={disconnectMailbox} onOpenSetup={() => setSetupGuideOpen(true)} />}</Modal>
    <Modal open={setupGuideOpen} title="Activa la entrega automática" description="Configuración única para leer códigos de Gmail, Outlook o Hotmail." onClose={() => setSetupGuideOpen(false)}><MailSetupGuide config={mailConfig} copiedValue={copiedSetupValue} onCopy={async (value) => { await navigator.clipboard.writeText(value); setCopiedSetupValue(value); window.setTimeout(() => setCopiedSetupValue(''), 1600); }} /></Modal>
  </div>;
}

function MailSetupCard({ config, onOpen }: { config: MailIntegrationConfig; onOpen: () => void }) {
  const ready = config.providers.google.configured && config.providers.microsoft.configured;
  return <section className="surface overflow-hidden p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-mint/20 bg-mint/[.07] text-mint"><Settings2 size={18} aria-hidden="true" /></span><div><h2 className="text-sm font-semibold text-slate-100">Entrega automática por correo</h2><p className="mt-1 text-xs leading-5 text-slate-500">{ready ? 'Las conexiones están listas para autorizar buzones.' : 'Completa la configuración una sola vez para recibir códigos automáticamente.'}</p></div></div><Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onOpen}>{ready ? 'Revisar configuración' : 'Configurar integración'} <ExternalLink size={14} aria-hidden="true" /></Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><ProviderStatus label="Gmail" configured={config.providers.google.configured} /><ProviderStatus label="Outlook / Hotmail" configured={config.providers.microsoft.configured} /></div></section>;
}

function ProviderStatus({ label, configured }: { label: string; configured: boolean }) {
  return <div className="flex items-center justify-between rounded-xl bg-white/[.025] px-3 py-2.5 text-xs"><span className="text-slate-300">{label}</span><span className={configured ? 'inline-flex items-center gap-1.5 font-medium text-emerald-300' : 'inline-flex items-center gap-1.5 font-medium text-amber-300'}><span className={`size-1.5 rounded-full ${configured ? 'bg-emerald-300' : 'bg-amber-300'}`} aria-hidden="true" />{configured ? 'Listo' : 'Falta configurar'}</span></div>;
}

function MailSetupGuide({ config, copiedValue, onCopy }: { config: MailIntegrationConfig | null; copiedValue: string; onCopy: (value: string) => Promise<void> }) {
  const keyCommand = '[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))';
  return <div className="space-y-5"><ol className="space-y-4"><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint/[.1] text-xs font-semibold text-mint">1</span><div><p className="text-sm font-medium text-slate-200">Genera la clave de cifrado</p><p className="mt-1 text-xs leading-5 text-slate-500">En PowerShell ejecuta este comando y guarda el resultado como secreto en Render.</p><div className="mt-2 flex items-start gap-2 rounded-lg bg-[#090e16] p-3"><code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-slate-300">{keyCommand}</code><button type="button" className="icon-button size-8 rounded-lg hover:text-mint" title="Copiar comando" aria-label="Copiar comando" onClick={() => void onCopy(keyCommand)}>{copiedValue === keyCommand ? <Check size={14} /> : <Copy size={14} />}</button></div></div></li><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint/[.1] text-xs font-semibold text-mint">2</span><div><p className="text-sm font-medium text-slate-200">Crea la aplicación OAuth</p><p className="mt-1 text-xs leading-5 text-slate-500">Usa una consola por proveedor y pega la URI de retorno exacta.</p><div className="mt-3 space-y-2"><ProviderSetupLink label="Google Cloud Console" href="https://console.cloud.google.com/apis/credentials" redirectUri={config?.providers.google.redirectUri} copiedValue={copiedValue} onCopy={onCopy} /><ProviderSetupLink label="Microsoft Entra" href="https://entra.microsoft.com/" redirectUri={config?.providers.microsoft.redirectUri} copiedValue={copiedValue} onCopy={onCopy} /></div></div></li><li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-mint/[.1] text-xs font-semibold text-mint">3</span><div><p className="text-sm font-medium text-slate-200">Añade los secretos en Render</p><p className="mt-1 text-xs leading-5 text-slate-500">En Environment agrega los valores. No los pegues aquí ni en GitHub.</p><div className="mt-2 flex flex-wrap gap-2">{['MAIL_TOKEN_KEY_B64', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'].map((key) => <code key={key} className="rounded-md bg-white/[.045] px-2 py-1 font-mono text-[10px] text-slate-400">{key}</code>)}</div><a className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-semibold text-mint hover:text-white" href="https://dashboard.render.com/" target="_blank" rel="noreferrer">Abrir Render <ExternalLink size={13} aria-hidden="true" /></a></div></li></ol><div className="border-t border-line/70 pt-4 text-xs leading-5 text-slate-500">Después de guardar, espera el nuevo despliegue y vuelve a pulsar <strong className="font-medium text-slate-300">Conectar Gmail</strong> o <strong className="font-medium text-slate-300">Conectar Outlook/Hotmail</strong>.</div></div>;
}

function ProviderSetupLink({ label, href, redirectUri, copiedValue, onCopy }: { label: string; href: string; redirectUri?: string; copiedValue: string; onCopy: (value: string) => Promise<void> }) {
  return <div className="rounded-xl border border-line/80 bg-white/[.018] p-3"><div className="flex items-center justify-between gap-3"><a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-mint">{label} <ExternalLink size={12} aria-hidden="true" /></a>{redirectUri && <button type="button" className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-mint" onClick={() => void onCopy(redirectUri)}>{copiedValue === redirectUri ? <Check size={13} /> : <Copy size={13} />}{copiedValue === redirectUri ? 'Copiada' : 'Copiar URI'}</button>}</div>{redirectUri && <code className="mt-2 block break-all font-mono text-[10px] leading-4 text-slate-500">{redirectUri}</code>}</div>;
}

function MailboxModal({ account, senders, senderInput, error, action, onSenderInput, onAddSender, onRemoveSender, onConnect, onSync, onDisconnect, onOpenSetup }: { account: Account; senders: string[]; senderInput: string; error: string; action: MailProvider | 'sync' | 'disconnect' | null; onSenderInput: (value: string) => void; onAddSender: () => void; onRemoveSender: (sender: string) => void; onConnect: (provider: MailProvider) => void; onSync: () => void; onDisconnect: () => void; onOpenSetup: () => void }) {
  const connection = account.mailboxConnection;
  const connected = connection?.status === 'ACTIVE';
  const status = connection ? mailboxStatuses[connection.status] : null;
  return <div className="space-y-5">
    {connection && status && <div className="rounded-xl border border-line bg-white/[.025] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-slate-200">{connection.provider === 'GOOGLE' ? 'Gmail' : 'Outlook / Hotmail'}</p><p className="mt-1 text-xs text-slate-500">{connection.externalEmail}</p></div><Badge tone={status.tone}>{status.label}</Badge></div>{connection.lastSyncAt && <p className="mt-3 text-xs text-slate-500">Última sincronización: {formatDate(connection.lastSyncAt)}</p>}{connection.lastErrorCode && <p className="mt-2 text-xs text-red-300">Último error: {connection.lastErrorCode}</p>}</div>}
    <div><p className="label">Remitentes permitidos</p><p className="mb-2 text-xs leading-5 text-slate-500">Solo se aceptarán códigos de estos correos. {connected ? 'Para modificarlos, desconecta y vuelve a autorizar el buzón.' : 'Se enviarán al iniciar la autorización.'}</p><div className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Agregar remitente permitido" type="email" disabled={connected} value={senderInput} onChange={(event) => onSenderInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onAddSender(); } }} placeholder="no-reply@servicio.com" /><Button type="button" className="w-full sm:w-auto" variant="secondary" disabled={connected} onClick={onAddSender}>Agregar</Button></div>{senders.length > 0 ? <ul className="mt-3 space-y-2">{senders.map((sender) => <li key={sender} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[.02] px-3 py-1.5 font-mono text-xs text-slate-300"><span className="min-w-0 truncate">{sender}</span>{!connected && <button type="button" onClick={() => onRemoveSender(sender)} aria-label={`Quitar ${sender}`} title={`Quitar ${sender}`} className={`${iconButtonClass} hover:text-red-300`}><X size={15} /></button>}</li>)}</ul> : <p className="mt-3 text-xs text-amber-300">Agrega al menos un remitente permitido para conectar.</p>}</div>
    {error && <div className="space-y-2"><ErrorBanner message={error} /><button type="button" onClick={onOpenSetup} className="text-xs font-semibold text-mint underline-offset-4 hover:text-white hover:underline">Ver cómo configurarlo</button></div>}
    {connected ? <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="danger" loading={action === 'disconnect'} onClick={onDisconnect}><Unplug size={16} /> Desconectar</Button><Button type="button" variant="secondary" loading={action === 'sync'} onClick={onSync}><RefreshCw size={16} /> Sincronizar</Button></div> : <div className="space-y-3 border-t border-line pt-4"><p className="text-xs text-slate-500">Se abrirá el proveedor para conceder acceso. No guardamos tu contraseña.</p><div className="flex flex-col gap-3 sm:flex-row sm:justify-end">{connection && <Button type="button" variant="danger" loading={action === 'disconnect'} onClick={onDisconnect}><Unplug size={16} /> Desconectar</Button>}<Button type="button" variant="secondary" loading={action === 'GOOGLE'} onClick={() => onConnect('GOOGLE')}><Link2 size={16} /> {connection ? 'Reconectar Gmail' : 'Conectar Gmail'}</Button><Button type="button" variant="secondary" loading={action === 'MICROSOFT'} onClick={() => onConnect('MICROSOFT')}><Link2 size={16} /> {connection ? 'Reconectar Outlook/Hotmail' : 'Conectar Outlook/Hotmail'}</Button></div></div>}
  </div>;
}
