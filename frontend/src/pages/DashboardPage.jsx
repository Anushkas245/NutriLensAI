import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  ShieldAlert,
  Bookmark,
  History,
  Eye,
  Trash2,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { AUTH_API, USER_API, SCANS_API } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getVerdictStyle } from '../components/ScoreBadge';

const ALLERGEN_OPTIONS = [
  'Milk',
  'Wheat / Gluten',
  'Soy',
  'Peanuts',
  'Tree Nuts',
  'Sesame',
  'Mustard',
  'Sulphites',
  'Egg',
];

const DIET_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Low Added Sugar',
  'Low Sodium',
  'High Protein',
  'Avoid Artificial Colours',
  'Avoid Artificial Sweeteners',
];

export default function DashboardPage() {
  const { user, loginSuccess, updateUser } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [dashboard, setDashboard] = useState({
    savedProducts: [],
    scanHistory: [],
    recentlyViewed: [],
  });
  const [guestScans, setGuestScans] = useState([]);
  const [dashLoading, setDashLoading] = useState(false);

  const [selectedDiets, setSelectedDiets] = useState([]);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [prefSavedMsg, setPrefSavedMsg] = useState('');

  const loadUserDashboard = async () => {
    setDashLoading(true);
    try {
      const data = await USER_API.dashboard();
      setDashboard(data);
    } catch {
      // ignore
    } finally {
      setDashLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      setSelectedDiets(user.dietaryPreferences || []);
      setSelectedAllergens(user.allergens || []);
      loadUserDashboard();
    } else {
      SCANS_API.history()
        .then((list) => setGuestScans(Array.isArray(list) ? list : []))
        .catch(() => {});
    }
  }, [user]);

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

  const toggleItem = (list, setList, val) => {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const savePreferences = async () => {
    setPrefSavedMsg('');
    try {
      const updated = await AUTH_API.updatePreferences({
        dietaryPreferences: selectedDiets,
        allergens: selectedAllergens,
      });
      updateUser(updated);
      setPrefSavedMsg('Dietary preferences & allergen alerts updated.');
    } catch (err) {
      setPrefSavedMsg(err.message || 'Could not update preferences.');
    }
  };

  const handleRemoveSaved = async (savedId) => {
    try {
      await USER_API.removeSaved(savedId);
      setDashboard((prev) => ({
        ...prev,
        savedProducts: prev.savedProducts.filter((s) => s.savedProductId !== savedId),
      }));
    } catch {
      // ignore
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="rounded-3xl border border-[#E3ECE4] bg-white p-7 shadow-xs lg:col-span-6">
            <div className="flex items-center gap-2.5 text-[#2E5238]">
              <User className="h-5 w-5" />
              <h1 className="text-2xl font-extrabold text-[#143326]">
                {authMode === 'login' ? 'Sign In to NutriLens AI' : 'Create Your Account'}
              </h1>
            </div>
            <p className="mt-1 text-xs text-[#5E7266]">
              Save scanned products, track recently viewed foods, and configure automatic personal allergen warnings.
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

          <div className="rounded-3xl border border-[#E3ECE4] bg-white p-7 lg:col-span-6">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
              <History className="h-5 w-5 text-[#426E4D]" />
              Recent Guest Scans
            </h2>
            <p className="mt-1 text-xs text-[#5E7266]">
              Recent label scans evaluated without signing in.
            </p>

            {guestScans.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center text-xs text-[#5E7266]">
                No scans recorded yet. Try scanning a packaged food label!
              </div>
            ) : (
              <div className="mt-4 divide-y divide-[#EEF3EE]">
                {guestScans.map((s) => (
                  <div key={s.scanId} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-bold text-[#143326]">{s.productName}</p>
                      <p className="text-xs text-[#6A7D72]">
                        {s.category || 'Packaged Food'} • {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EAF3EB] px-2.5 py-0.5 text-xs font-extrabold text-[#1E5631]">
                      {s.healthScore != null ? `Score ${s.healthScore}` : s.verdict}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[#143326]">Welcome, {user.fullName}</h1>
          <p className="mt-1 text-sm text-[#5E7266]">{user.email}</p>
        </div>
        <Link
          to="/scanner"
          className="inline-flex items-center justify-center rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4130]"
        >
          Scan New Food Label
        </Link>
      </div>

      {/* Dietary Preferences & Allergen Profile */}
      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
              <ShieldAlert className="h-5 w-5 text-[#426E4D]" />
              Dietary Preferences &amp; Allergen Alerts
            </h2>
            <p className="mt-0.5 text-xs text-[#5E7266]">
              Selected allergens trigger automatic warning banners on Product Details and Scanner reports.
            </p>
          </div>
          <button
            type="button"
            onClick={savePreferences}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4130]"
          >
            <Check className="h-4 w-4" /> Save Preferences
          </button>
        </div>

        {prefSavedMsg && (
          <div className="mt-3 rounded-xl bg-[#E9F4EC] px-4 py-2 text-xs font-semibold text-[#1E5631]">
            {prefSavedMsg}
          </div>
        )}

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E5238]">Allergens to Flag</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((a) => {
                const active = selectedAllergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleItem(selectedAllergens, setSelectedAllergens, a)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-[#C85546] bg-[#FDF1EF] text-[#96382C]'
                        : 'border-[#DCE6DD] bg-white text-[#4B6154] hover:bg-[#F5F9F5]'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2E5238]">Dietary Goals</h3>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DIET_OPTIONS.map((d) => {
                const active = selectedDiets.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleItem(selectedDiets, setSelectedDiets, d)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? 'border-[#2E5238] bg-[#EAF3EB] text-[#1D4130]'
                        : 'border-[#DCE6DD] bg-white text-[#4B6154] hover:bg-[#F5F9F5]'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {dashLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-[#5E7266]">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading your activity...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Saved Products */}
          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
              <Bookmark className="h-4 w-4 text-[#426E4D]" />
              Saved Products ({dashboard.savedProducts.length})
            </h2>
            {dashboard.savedProducts.length === 0 ? (
              <p className="mt-4 text-xs text-[#6A7D72]">No saved products yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.savedProducts.map((s) => (
                  <div key={s.savedProductId} className="flex items-center justify-between gap-2 rounded-xl border border-[#EDF2ED] p-3">
                    <div className="min-w-0">
                      {s.productId ? (
                        <Link to={`/products/${s.productId}`} className="block truncate text-sm font-bold text-[#143326] hover:text-[#356844]">
                          {s.productName}
                        </Link>
                      ) : (
                        <span className="block truncate text-sm font-bold text-[#143326]">{s.productName}</span>
                      )}
                      <span className="text-[11px] text-[#6A7D72]">
                        {s.category} • Score {s.healthScore ?? 'N/A'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(s.savedProductId)}
                      className="rounded-lg p-1.5 text-[#7B8E82] hover:bg-[#FDF2F0] hover:text-[#96382C]"
                      title="Remove saved"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Scan History */}
          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
              <History className="h-4 w-4 text-[#426E4D]" />
              Scan History ({dashboard.scanHistory.length})
            </h2>
            {dashboard.scanHistory.length === 0 ? (
              <p className="mt-4 text-xs text-[#6A7D72]">No scans saved yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.scanHistory.map((s) => {
                  const vStyle = getVerdictStyle(s.verdict);
                  return (
                    <div key={s.scanId} className="rounded-xl border border-[#EDF2ED] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-[#143326]">{s.productName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${vStyle.pill}`}>
                          {s.healthScore ?? 'N/A'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#6A7D72]">
                        {s.category || 'Packaged Food'} • {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recently Viewed */}
          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
              <Eye className="h-4 w-4 text-[#426E4D]" />
              Recently Viewed ({dashboard.recentlyViewed.length})
            </h2>
            {dashboard.recentlyViewed.length === 0 ? (
              <p className="mt-4 text-xs text-[#6A7D72]">Browse products in Explore to populate recently viewed.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {dashboard.recentlyViewed.map((r) => (
                  <Link
                    key={r.productId}
                    to={`/products/${r.productId}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#EDF2ED] p-3 transition hover:border-[#BFD5C1]"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#143326]">{r.productName}</span>
                      <span className="text-[11px] text-[#6A7D72]">{r.brand || r.category}</span>
                    </div>
                    <span className="rounded-full bg-[#EAF3EB] px-2 py-0.5 text-[11px] font-bold text-[#1E5631]">
                      {r.healthScore ?? 'N/A'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
