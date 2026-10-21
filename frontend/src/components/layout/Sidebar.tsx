import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map, 
  PlusCircle, 
  BookmarkCheck, 
  Sparkles, 
  Navigation, 
  User as UserIcon,
  Globe
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'My Trips', path: '/trips', icon: Map },
    { label: 'Create Trip', path: '/trips/create', icon: PlusCircle },
    { label: 'Bookings & Reservations', path: '/bookings', icon: BookmarkCheck },
    { label: 'Recommendations', path: '/recommendations', icon: Sparkles },
    { label: 'Route Optimizer', path: '/routes', icon: Navigation },
    { label: 'My Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-[calc(100vh-4rem)] sticky top-16 p-4 hidden md:flex flex-col justify-between transition-colors self-start overflow-y-auto">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-2">
        <div className="flex items-center space-x-2 text-zinc-900 dark:text-zinc-100 font-bold text-xs uppercase tracking-wider">
          <Globe className="w-4 h-4 text-zinc-500" />
          <span>Traveler Portal</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Manage itineraries, track bookings, and optimize multi-stop itineraries seamlessly.
        </p>
      </div>
    </aside>
  );
};
