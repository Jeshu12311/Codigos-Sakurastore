import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ link = '/codigos', compact = false }: { link?: string; compact?: boolean }) {
  return (
    <Link to={link} className="group inline-flex items-center gap-3 rounded-xl" aria-label="Códigos SakuraStore">
      <span className="grid size-9 place-items-center rounded-[11px] border border-mint/20 bg-mint/[.08] text-mint transition-colors duration-150 group-hover:bg-mint/[.13]"><KeyRound size={18} strokeWidth={2} /></span>
      {!compact && <span className="text-[15px] font-semibold tracking-[-.015em] text-slate-100">Códigos SakuraStore</span>}
    </Link>
  );
}
