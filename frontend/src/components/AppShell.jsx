import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  ScanLine,
  Scale,
  Bookmark,
  History,
  BookOpen,
  Database,
  Settings,
  User,
  LogOut,
  Leaf,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCompare } from '../context/CompareContext';

const SIDEBAR_GROUPS = [
  {
    label: 'WORKSPACE',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/explore', label: 'Explore Foods', icon: Search },
      { to: '/scanner', label: 'Label Scanner', icon: ScanLine },
      { to: '/compare', label: 'Compare Foods', icon: Scale, badgeCompare: true },
      { to: '/saved', label: 'Saved Products', icon: Bookmark },
      { to: '/history', label: 'Scan History', icon: History },
    ],
  },
  {
    label: 'INFORMATION',
    items: [
      { to: '/methodology', label: 'Methodology', icon: BookOpen },
      { to: '/sources', label: 'Data Sources', icon: Database },
    ],
  },
];

function getRouteMeta(pathname) {
  if (pathname === '/') return { section: 'Workspace', title: 'Overview' };
  if (pathname.startsWith('/explore')) return { section: 'Workspace', title: 'Explore Foods' };
  if (pathname.startsWith('/scanner')) return { section: 'Workspace', title: 'Label Scanner' };
  if (pathname.startsWith('/compare')) return { section: 'Workspace', title: 'Compare Foods' };
  if (pathname.startsWith('/saved')) return { section: 'Workspace', title: 'Saved Products' };
  if (pathname.startsWith('/history')) return { section: 'Workspace', title: 'Scan History' };
  if (pathname.startsWith('/products/')) return { section: 'Explore Foods', title: 'Product Details' };
  if (pathname.startsWith('/methodology')) return { section: 'Information', title: 'Methodology' };
  if (pathname.startsWith('/sources')) return { section: 'Information', title: 'Data Sources' };
  if (pathname.startsWith('/settings')) return { section: 'Account', title: 'Settings' };
  if (pathname.startsWith('/account') || pathname.startsWith('/dashboard')) {
    return { section: 'Account', title: 'Profile & Account' };
  }
  return { section: 'Workspace', title: 'NutriLens AI' };
}

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const { compareIds } = useCompare();
  const { pathname } = useLocation();
  const meta = getRouteMeta(pathname);

  const renderSidebarContent = (onNavigate) => (
    <div className="flex h-full flex-col justify-between bg-white px-3.5 py-5">
      <div className="space-y-6">
        {/* Brand */}
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-2 py-1 text-[#143326] no-underline"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#2E5238]">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <span className="block font-['Plus_Jakarta_Sans'] text-base font-extrabold tracking-tight text-[#143326]">
              NutriLens AI
            </span>
            <span className="block text-[11px] font-medium text-[#667B6E]">
              Packaged Food Intelligence
            </span>
          </div>
        </Link>

        {/* Workspace & Information Groups */}
        <nav className="space-y-5" aria-label="Sidebar Navigation">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A8D81]">
                {group.label}
              </div>
              <div className="mt-1.5 space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#EAF3EB] font-semibold text-[#143326]'
                          : 'text-[#4B6154] hover:bg-[#F4F8F4] hover:text-[#143326]'
                      }`
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 shrink-0 text-[#426E4D]" />
                      <span>{item.label}</span>
                    </span>
                    {item.badgeCompare && compareIds.length > 0 && (
                      <span className="rounded-full bg-[#2E5238] px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {compareIds.length}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Account Group */}
          <div>
            <div className="px-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#7A8D81]">
              ACCOUNT
            </div>
            <div className="mt-1.5 space-y-1">
              <NavLink
                to="/settings"
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EAF3EB] font-semibold text-[#143326]'
                      : 'text-[#4B6154] hover:bg-[#F4F8F4] hover:text-[#143326]'
                  }`
                }
              >
                <Settings className="h-4 w-4 shrink-0 text-[#426E4D]" />
                <span>Settings</span>
              </NavLink>

              <NavLink
                to="/account"
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#EAF3EB] font-semibold text-[#143326]'
                      : 'text-[#4B6154] hover:bg-[#F4F8F4] hover:text-[#143326]'
                  }`
                }
              >
                <User className="h-4 w-4 shrink-0 text-[#426E4D]" />
                <span>{user ? `Profile (${user.fullName.split(' ')[0]})` : 'Sign In / Profile'}</span>
              </NavLink>
            </div>
          </div>
        </nav>
      </div>

      {/* Sidebar Bottom Card */}
      <div className="border-t border-[#E8EFE9] pt-4">
        {user ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E3ECE4] bg-[#FAFDF9] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#143326]">{user.fullName}</p>
              <p className="truncate text-[11px] text-[#667B6E]">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                if (onNavigate) onNavigate();
              }}
              title="Sign out"
              className="rounded-lg p-1.5 text-[#5E7266] hover:bg-white hover:text-[#96382C]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/account"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#CFE0D0] bg-[#F4F9F4] px-3 py-2.5 text-xs font-bold text-[#1D4130] hover:bg-[#EAF3EA]"
          >
            <User className="h-3.5 w-3.5" />
            Sign In for Saved Lists
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7FAF7] text-[#143326]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#E3ECE4] bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0C2118]/30 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[#E3ECE4] bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-[#5E7266] hover:bg-[#F3F8F4]"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarContent(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E3ECE4] bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#DCE6DD] text-[#1D4130] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E7F2E8] text-[#2E5238]">
                <Leaf className="h-4 w-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-extrabold text-[#143326]">
                NutriLens AI
              </span>
            </Link>

            <div className="hidden items-center gap-2 text-xs text-[#6A7D72] sm:flex">
              <span>{meta.section}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-bold text-[#143326]">{meta.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {pathname !== '/scanner' && (
              <Link
                to="/scanner"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#1D4130]"
              >
                <ScanLine className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Scan a Label</span>
                <span className="sm:hidden">Scan</span>
              </Link>
            )}
            <Link
              to="/account"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D4E2D5] bg-[#F6FAF6] px-3 py-2 text-xs font-bold text-[#1D4130] hover:bg-[#EBF4EC]"
            >
              <User className="h-3.5 w-3.5 text-[#426E4D]" />
              <span className="hidden sm:inline">
                {user ? user.fullName.split(' ')[0] : 'Sign In'}
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">{children}</div>
        </main>

        {/* Clean SaaS Footer */}
        <footer className="border-t border-[#E3ECE4] bg-white px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 text-xs text-[#5E7266] sm:flex-row sm:items-center">
            <p>
              Data sourced from Open Food Facts. Nutritional analysis is informational; consult a healthcare professional for dietary advice.
            </p>
            <div className="flex shrink-0 items-center gap-4 font-semibold text-[#2E5238]">
              <Link to="/methodology" className="hover:underline">Methodology</Link>
              <Link to="/sources" className="hover:underline">Data Sources</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
