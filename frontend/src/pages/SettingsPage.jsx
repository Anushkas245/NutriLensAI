import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Check, User, Settings } from 'lucide-react';
import { AUTH_API } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [selectedDiets, setSelectedDiets] = useState([]);
  const [selectedAllergens, setSelectedAllergens] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setSelectedDiets(user.dietaryPreferences || []);
      setSelectedAllergens(user.allergens || []);
    }
  }, [user]);

  const toggleItem = (list, setList, val) => {
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const updated = await AUTH_API.updatePreferences({
        fullName: fullName.trim() || user.fullName,
        dietaryPreferences: selectedDiets,
        allergens: selectedAllergens,
      });
      updateUser(updated);
      setMessage('Account, dietary, and allergen preferences saved.');
    } catch (err) {
      setMessage(err.message || 'Could not update preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E3ECE4] pb-5">
        <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[#5E7266]">
          Manage your account name, dietary goals, and automatic allergen alert rules.
        </p>
      </div>

      {!user ? (
        <div className="rounded-3xl border border-[#DCE8DD] bg-white p-10 text-center">
          <Settings className="mx-auto h-10 w-10 text-[#5A8B66]" />
          <h2 className="mt-3 text-lg font-extrabold text-[#143326]">Sign in to configure preferences</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5E7266]">
            Your dietary preferences and allergen alerts are stored securely on your NutriLens AI profile.
          </p>
          <Link
            to="/account"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white"
          >
            <User className="h-4 w-4" />
            Sign In / Create Account
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-4">
            <h2 className="text-base font-extrabold text-[#143326]">Account Profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Display Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E6EDE6] bg-[#F7FAF7] px-3 text-sm text-[#6A7D72]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-5">
            <div>
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
                <ShieldAlert className="h-5 w-5 text-[#426E4D]" />
                Allergen &amp; Dietary Preferences
              </h2>
              <p className="mt-1 text-xs text-[#5E7266]">
                Selected allergens automatically highlight warning banners on Product Details and Label Scanner reports.
              </p>
            </div>

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
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
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
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
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

            {message && (
              <div className="rounded-xl bg-[#E9F4EC] px-4 py-2.5 text-xs font-semibold text-[#1E5631]">
                {message}
              </div>
            )}

            <div className="border-t border-[#EEF3EE] pt-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
}
