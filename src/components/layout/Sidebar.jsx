import { NavLink, Link } from 'react-router-dom';import * as Lucide from 'lucide-react';
import { NAV_ITEMS } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
const Icon = ({ name, className='h-5 w-5' }) => { const C = Lucide[name]||Lucide.Circle; return <C className={className} strokeWidth={1.75} />; };
export default function Sidebar() {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const items = NAV_ITEMS
    .filter(i => !i.adminOnly || isAdmin)
    .filter(i => i.to !== '/expenses' || isAdmin || settings.cashierCanRecordExpenses);
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {items.map(item => (
<NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive}) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-moss-50 text-moss-800' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'}`}>            <Icon name={item.icon} />{item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
