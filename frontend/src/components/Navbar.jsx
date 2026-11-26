import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Leaf, Menu, X, Scale, ScanLine, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompare } from '../context/CompareContext';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore Foods' },
  { to: '/scanner', label: 'Label Scanner' },
  { to: '/compare', label: 'Compare' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/sources', label: 'Data & Disclaimer' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { compareIds } = useCompare();

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3ECE4] bg-white/92 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-[#143326] no-underline">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F1E8] text-[#356844] shadow-xs">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <span className="block font-['Plus_Jakarta_Sans'] text-lg font-extrabold tracking-tight text-[#143326]">
              NutriLens AI
            </span>
            <span className="block text-[11px] font-medium text-[#5E7266]">
              Packaged Food Intelligence
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EAF3EB] text-[#1D4130] font-semibold'
                    : 'text-[#4B6154] hover:bg-[#F3F7F4] hover:text-[#143326]'
                }`
              }
            >
              {item.to === '/scanner' && <ScanLine className="h-3.5 w-3.5" />}
              {item.to === '/compare' && <Scale className="h-3.5 w-3.5" />}
              {item.label}
              {item.to === '/compare' && compareIds.length > 0 && (
                <span className="ml-0.5 rounded-full bg-[#426E4D] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {compareIds.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-[#D4E3D5] bg-[#F5F9F5] px-3.5 py-2 text-sm font-semibold text-[#1D4130] hover:bg-[#EAF2EA]"
              >
                <User className="h-4 w-4 text-[#426E4D]" />
                {user.fullName.split(' ')[0]}
              </Link>
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E3ECE4] text-[#5E7266] hover:bg-[#F3F7F4] hover:text-[#143326]"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1D4130]"
            >
              <User className="h-4 w-4" />
              Dashboard / Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DCE7DD] text-[#1D4130] lg:hidden"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E3ECE4] bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                    isActive
                      ? 'bg-[#EAF3EB] text-[#143326] font-semibold'
                      : 'text-[#4B6154] hover:bg-[#F5F8F5]'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === '/compare' && compareIds.length > 0 && (
                  <span className="rounded-full bg-[#426E4D] px-2 py-0.5 text-xs font-bold text-white">
                    {compareIds.length}
                  </span>
                )}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-[#E8EFE8] pt-3">
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#2E5238] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <User className="h-4 w-4" />
                {user ? `My Dashboard (${user.fullName.split(' ')[0]})` : 'Dashboard & Account'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
