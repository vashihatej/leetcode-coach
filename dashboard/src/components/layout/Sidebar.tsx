import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Network, CalendarCheck, Heart } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', Icon: BookOpen },
  { to: '/patterns', label: 'Patterns', Icon: Network },
  { to: '/review', label: 'Review', Icon: CalendarCheck },
  { to: '/wishlist', label: 'Wishlist', Icon: Heart },
];

export default function Sidebar() {
  return (
    <nav className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col py-6 gap-1">
      <div className="px-4 mb-6">
        <h1 className="text-base font-bold text-white tracking-tight">LC Coach</h1>
        <p className="text-xs text-gray-500 mt-0.5">Dashboard</p>
      </div>
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`
          }
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
