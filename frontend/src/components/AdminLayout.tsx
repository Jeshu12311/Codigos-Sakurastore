import { Activity, BarChart3, KeyRound, LogOut, Menu, ReceiptText, UsersRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const heading = titles[location.pathname] || titles['/admin/dashboard'];

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function handleLogout() {
    await logout();
    navigate('/admin/login', { replace: true });
  }

  function closeNavigation(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  const sidebar = (
    <>
      <div className="flex h-[4.5rem] shrink-0 items-center justify-between border-b border-line/80 px-5">
        <Brand link="/admin/dashboard" />
        <button
          type="button"
          className="icon-button min-h-11 min-w-11 lg:hidden"
          onClick={() => closeNavigation(true)}
          aria-label="Cerrar menú"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Navegación administrativa" className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-xs font-medium text-slate-500">Administración</p>
        <div className="space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cn(
                'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1017] active:scale-[.985]',
                isActive
                  ? 'bg-mint/[.095] text-mint'
                  : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-100',
              )}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-line/80 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white/[.035] text-xs font-semibold text-slate-300"
            aria-hidden="true"
          >
            {initials(user?.email || 'AD')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200" title={user?.email}>{user?.email}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Administrador</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="icon-button min-h-11 min-w-11 hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-red-300/60"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-ink text-slate-100">
      <a href="#admin-main" className="skip-link">Saltar al contenido</a>

      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-black/75 backdrop-blur-[2px] lg:hidden"
          onClick={() => closeNavigation(true)}
        />
      )}

      <aside
        id="admin-navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[min(17rem,calc(100vw-2rem))] flex-col border-r border-line/80 bg-[#0c1017] shadow-floating transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none lg:w-64 lg:visible lg:translate-x-0 lg:shadow-none',
          open ? 'visible translate-x-0' : 'invisible -translate-x-full',
        )}
      >
        {sidebar}
      </aside>

      <div className="min-h-[100dvh] lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[4.5rem] items-center border-b border-line/80 bg-ink/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button mr-2 min-h-11 min-w-11 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            aria-controls="admin-navigation"
            aria-expanded={open}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-[-.02em] text-white sm:text-xl">{heading.title}</h1>
            <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">{heading.description}</p>
          </div>

          <div
            className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-line/80 bg-white/[.018] px-2.5 text-[11px] text-slate-400 sm:px-3"
            role="status"
            aria-label="Sistema operativo"
          >
            <span className="size-1.5 rounded-full bg-mint" aria-hidden="true" />
            <span className="hidden sm:inline">Sistema operativo</span>
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] p-4 outline-none sm:p-7 lg:p-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
