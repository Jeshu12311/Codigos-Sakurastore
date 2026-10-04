import { Activity, BarChart3, KeyRound, LogOut, Menu, ReceiptText, UsersRound, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn, initials } from '../lib/utils';
import { Brand } from './Brand';

const links = [
  { to: '/admin/dashboard', label: 'Resumen', icon: BarChart3 },
  { to: '/admin/accounts', label: 'Cuentas', icon: UsersRound },
  { to: '/admin/sales', label: 'Ventas', icon: ReceiptText },
  { to: '/admin/codes', label: 'Códigos', icon: KeyRound },
  { to: '/admin/logs', label: 'Actividad', icon: Activity },
];

const titles: Record<string, { title: string; description: string }> = {
  '/admin/dashboard': { title: 'Resumen', description: 'Estado general de tu operación' },
  '/admin/accounts': { title: 'Cuentas', description: 'Administra cuentas y servicios' },
  '/admin/sales': { title: 'Ventas', description: 'Gestiona accesos de clientes' },
  '/admin/codes': { title: 'Códigos temporales', description: 'Registra y controla los códigos' },
  '/admin/logs': { title: 'Registro de actividad', description: 'Historial de consultas y acciones' },
};

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const heading = titles[location.pathname] || titles['/admin/dashboard'];

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-line px-5">
        <Brand link="/admin/dashboard" />
        <button className="rounded-lg p-2 text-slate-500 lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={19} /></button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        <p className="mb-3 px-3 pt-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-600">Administración</p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-mint/[.09] text-mint' : 'text-slate-400 hover:bg-white/[.035] hover:text-slate-100')}>
            <Icon size={18} strokeWidth={1.8} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-xs font-semibold text-slate-300">{initials(user?.email || 'AD')}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{user?.email}</p><p className="mt-0.5 text-[10px] text-slate-600">Administrador</p></div>
          <button onClick={() => void handleLogout()} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300" title="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-[#0c1017] transition-transform duration-200 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-20 items-center border-b border-line bg-ink/85 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <button className="mr-3 rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div><h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{heading.title}</h1><p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{heading.description}</p></div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[11px] text-slate-500"><span className="size-1.5 rounded-full bg-mint shadow-[0_0_8px_#64f0c2]" /> Sistema operativo</div>
        </header>
        <main className="p-4 sm:p-7 lg:p-9"><Outlet /></main>
      </div>
    </div>
  );
}
