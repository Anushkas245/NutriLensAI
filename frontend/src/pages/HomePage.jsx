import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScanLine,
  Search,
  ShieldCheck,
  Layers,
  FlaskConical,
  Scale,
  ArrowRight,
  Sparkles,
  Leaf,
} from 'lucide-react';
import { PRODUCTS_API, PACKAGED_CATEGORIES } from '../lib/api';
import { getVerdictStyle } from '../components/ScoreBadge';

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    PRODUCTS_API.list({ sort: 'score_desc' })
      .then((data) => {
        if (active && Array.isArray(data)) setFeatured(data.slice(0, 6));
      })
      .catch(() => {});
    PRODUCTS_API.categories()
      .then((data) => {
        if (active && Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate(searchTerm.trim() ? `/explore?q=${encodeURIComponent(searchTerm.trim())}` : '/explore');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Editorial Minimal White & Sage Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#DCE8DD] bg-white p-8 shadow-sm sm:p-12 lg:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#EAF4EB]/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full bg-[#E1EFE3]/60 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D4E4D5] bg-[#F2F8F2] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#2E5238]">
              <Leaf className="h-3.5 w-3.5" />
              Packaged Human Food Intelligence
            </span>
            <h1 className="mt-4 font-['Plus_Jakarta_Sans'] text-3xl font-extrabold leading-[1.1] tracking-tight text-[#143326] sm:text-5xl">
              Know every ingredient before it reaches your plate.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#4B6154]">
              Scan packaged food labels with local AI vision, review every extracted value, decode additives &amp; INS codes, check FSSAI daily-value limits, and compare cleaner alternatives.
            </p>

            <form onSubmit={handleSearchSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search biscuits, noodles, snacks, cereals, brands..."
                  className="h-12 w-full rounded-xl border border-[#D2E0D3] bg-[#FAFDF9] pl-11 pr-4 text-sm text-[#143326] outline-none transition focus:border-[#426E4D] focus:bg-white focus:ring-3 focus:ring-[#426E4D]/15"
                />
              </div>
              <button
                type="submit"
                className="h-12 rounded-xl border border-[#C8DBC9] bg-white px-5 text-sm font-bold text-[#1D4130] transition hover:bg-[#F2F7F2]"
              >
                Explore Foods
              </button>
              <Link
                to="/scanner"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2E5238] px-6 text-sm font-bold text-white shadow-xs transition hover:bg-[#1D4130]"
              >
                <ScanLine className="h-4 w-4" />
                Scan a Label
              </Link>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
            {[
              {
                icon: ScanLine,
                title: 'AI Vision + Review',
                desc: 'Extract nutrition & ingredients from labels, then verify & edit before scoring.',
              },
              {
                icon: FlaskConical,
                title: 'Ingredient Decoder',
                desc: 'Plain-language breakdown of INS codes, preservatives, sweeteners & colours.',
              },
              {
                icon: Layers,
                title: 'NOVA 1–4 & FSSAI',
                desc: 'Transparent processing depth & high sugar, sodium, and sat-fat alerts.',
              },
              {
                icon: Scale,
                title: 'Compare & Swap',
                desc: 'Side-by-side product comparisons and data-backed better alternatives.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-[#E4ECE5] bg-[#FAFDF9] p-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6F1E7] text-[#2E5238]">
                  <card.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#143326]">{card.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5E7266]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packaged Human Food Categories */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[#143326]">Packaged Food Categories</h2>
            <p className="mt-1 text-sm text-[#5E7266]">
              Focused exclusively on packaged human food across 10 core grocery categories.
            </p>
          </div>
          <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5238] hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PACKAGED_CATEGORIES.map((cat) => {
            const countObj = categories.find((c) => c.name === cat);
            return (
              <Link
                key={cat}
                to={`/explore?category=${encodeURIComponent(cat)}`}
                className="flex flex-col justify-between rounded-2xl border border-[#E3ECE4] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#A9CAAE] hover:shadow-xs"
              >
                <span className="text-sm font-bold text-[#143326]">{cat}</span>
                <span className="mt-2 text-xs font-medium text-[#5E7266]">
                  {countObj ? `${countObj.count} verified items` : 'Browse category'}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Verified Products */}
      {featured.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-[#143326]">Verified Packaged Food Insights</h2>
              <p className="mt-1 text-sm text-[#5E7266]">
                Real packaged product profiles sourced from Open Food Facts and evaluated deterministically.
              </p>
            </div>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-bold text-[#2E5238] hover:underline">
              Explore catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => {
              const vStyle = getVerdictStyle(p.verdict, p.grade);
              return (
                <Link
                  key={p.productId}
                  to={`/products/${p.productId}`}
                  className="group flex flex-col justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#A9CAAE] hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-[#EFF5EF] px-2.5 py-1 text-[11px] font-semibold text-[#356844]">
                        {p.category}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                        {p.healthScore != null ? `Score ${p.healthScore}` : 'Partial'}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-3.5">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.productName}
                          className="h-14 w-14 shrink-0 rounded-xl border border-[#E8EFE8] bg-[#FAFDF9] object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EEF5EE] text-[#426E4D]">
                          <Leaf className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-[#143326] group-hover:text-[#2E5238]">
                          {p.productName}
                        </h3>
                        <p className="truncate text-xs text-[#6A7D72]">{p.brand || 'Packaged Food'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#EEF3EE] pt-3 text-center text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-[#76887D]">Calories</span>
                      <strong className="tabular-nums text-[#143326]">
                        {p.caloriesPer100g != null ? `${p.caloriesPer100g}` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#76887D]">Sugar/100g</span>
                      <strong className="tabular-nums text-[#143326]">
                        {p.sugarPer100g != null ? `${p.sugarPer100g}g` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#76887D]">NOVA</span>
                      <strong className="tabular-nums text-[#143326]">
                        {p.novaGroup ? `Group ${p.novaGroup}` : '—'}
                      </strong>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Transparency Principle Strip */}
      <section className="mt-12 rounded-3xl border border-[#DCE8DD] bg-[#F2F7F2] p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2E5238]" />
            <div>
              <h3 className="text-sm font-bold text-[#143326]">Evidence-Based Rules</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#4E6357]">
                Every score is computed deterministically using transparent FSSAI &amp; NOVA rules—never black-box AI guesses.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#2E5238]" />
            <div>
              <h3 className="text-sm font-bold text-[#143326]">Honest Missing Data</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#4E6357]">
                When a label omits fiber, added sugar, or sodium, NutriLens marks it unavailable rather than assuming zero.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-[#2E5238]" />
            <div>
              <h3 className="text-sm font-bold text-[#143326]">Human Packaged Foods Only</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#4E6357]">
                Built specifically for human packaged foods—never cosmetics, pet food, or restaurant meals.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
