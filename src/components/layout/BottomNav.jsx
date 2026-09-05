import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import * as Lucide from 'lucide-react';
import { Menu } from 'lucide-react';
import { visibleMobileItems } from './navConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useIndustry } from '../../hooks/useIndustry';
import { usePermissions } from '../../hooks/usePermissions';
import MobileMoreDrawer from './MobileMoreDrawer';

export default function BottomNav() {
  const { isAdmin } = useAuth();
  const industry = useIndustry();
  const permissions = usePermissions();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = visibleMobileItems({ isAdmin, industry, permissions });

  const Icon = ({ name, className = 'h-5 w-5' }) => {
    const Component = Lucide[name] || Lucide.Circle;
    return <Component className={className} strokeWidth={1.75} />;
  };

  // Position and visibility unchanged — fixed to the bottom on mobile
  // only (lg:hidden). This is one of the four places a shadow is allowed.
  return (
    <>
      <nav
        className="bottom-nav-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface shadow-sticky lg:hidden"
        aria-label="Main"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 pt-2.5 text-label font-semibold transition-colors ${
                isActive
                  ? 'text-primary-700 before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:rounded-full before:bg-primary-600 before:content-[""]'
                  : 'text-ink-500'
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 pt-2.5 text-label font-semibold text-ink-500"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
          More
        </button>
      </nav>

      <MobileMoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
