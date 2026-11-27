import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, AlertCircle, LogOut, Settings, Bookmark, History } from 'lucide-react';
import { AUTH_API } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AccountPage() {
  const { user, loginSuccess, logout } = useAuth();
  const [authMode, setAuthMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res =
        authMode === 'register'
          ? await AUTH_API.register({ fullName, email, password })
          : await AUTH_API.login({ email, password });
      loginSuccess(res.token, res.user);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="border-b border-[#E3ECE4] pb-5">
          <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">Your Profile</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Signed in as {user.email}
          </p>
        </div>

        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7F2E8] text-[#2E5238]">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#143326]">{user.fullName}</h2>
                <p className="text-xs text-[#5E7266]">{user.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-[#EEC6BE] bg-white px-4 py-2 text-xs font-bold text-[#96382C] hover:bg-[#FDF2F0]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>

          <div className="grid gap-3 border-t border-[#EEF3EE] pt-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-bold uppercase text-[#5E7266]">Active Allergen Alerts</span>
              <p className="mt-1 text-sm font-semibold text-[#143326]">
                {user.allergens?.length ? user.allergens.join(', ') : 'None configured'}
              </p>
            </div>
            <div>
              <span className="text-xs font-bold uppercase text-[#5E7266]">Dietary Preferences</span>
              <p className="mt-1 text-sm font-semibold text-[#143326]">
                {user.dietaryPreferences?.length ? user.dietaryPreferences.join(', ') : 'None configured'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[#EEF3EE] pt-4">
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white"
            >
              <Settings className="h-3.5 w-3.5" />
              Manage Preferences
            </Link>
            <Link
              to="/saved"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C9DBC9] bg-white px-4 py-2 text-xs font-bold text-[#1D4130]"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Saved Products
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C9DBC9] bg-white px-4 py-2 text-xs font-bold text-[#1D4130]"
            >
              <History className="h-3.5 w-3.5" />
              Scan History
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-4">
      <div className="rounded-3xl border border-[#E3ECE4] bg-white p-7 shadow-2xs">
        <div className="flex items-center gap-2.5 text-[#2E5238]">
          <User className="h-5 w-5" />
          <h1 className="text-2xl font-extrabold text-[#143326]">
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>
        </div>
        <p className="mt-1 text-xs text-[#5E7266]">
          Save packaged products, keep your scan history, and set personal allergen alerts.
        </p>

        <div className="mt-4 inline-flex rounded-xl border border-[#D4E2D5] bg-[#F8FBF8] p-1">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setAuthError('');
            }}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
              authMode === 'login' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setAuthError('');
            }}
            className={`rounded-lg px-4 py-1.5 text-xs font-bold ${
              authMode === 'register' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154]'
            }`}
          >
            Register
          </button>
        </div>

        {authError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#EFCBC4] bg-[#FDF3F1] p-3 text-xs text-[#96382C]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-[#2E5238]">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#2E5238]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#2E5238]">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-xl bg-[#2E5238] py-2.5 text-sm font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
          >
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
