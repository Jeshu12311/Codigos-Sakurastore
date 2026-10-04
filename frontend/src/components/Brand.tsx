import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Brand({ link = '/codigos', compact = false }: { link?: string; compact?: boolean }) {
  return (
    <Link to={link} className="inline-flex items-center gap-3" aria-label="Códigos SakuraStore">
      <span className="grid size-9 place-items-center rounded-xl border border-mint/20 bg-mint/10 text-mint"><KeyRound size={18} strokeWidth={2.2} /></span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight text-white">Códigos SakuraStore</span>}
    </Link>
  );
}
