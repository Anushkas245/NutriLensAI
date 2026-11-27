import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScanLine,
  Search,
  Bookmark,
  History,
  Eye,
  ArrowRight,
  Leaf,
  PackageCheck,
} from 'lucide-react';
import { PRODUCTS_API, SCANS_API, USER_API } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getVerdictStyle } from '../components/ScoreBadge';

export default function OverviewPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [liveCount, setLiveCount] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    PRODUCTS_API.categories()
      .then((cats) => {
        if (!active || !Array.isArray(cats)) return;
        const total = cats.reduce((sum, c) => sum + (Number(c.count) || 0), 0);
        if (total > 0) setLiveCount(total);
      })
      .catch(() => {});

    SCANS_API.history()
      .then((list) => {
        if (active && Array.isArray(list)) setRecentScans(list);
      })
      .catch(() => {});

    if (user) {
      USER_API.dashboard()
        .then((dash) => {
          if (!active || !dash) return;
          setSavedProducts(dash.savedProducts || []);
          setRecentlyViewed(dash.recentlyViewed || []);
          if (Array.isArray(dash.scanHistory)) setRecentScans(dash.scanHistory);
        })
        .catch(() => {});
    } else {
      setSavedProducts([]);
      setRecentlyViewed([]);
    }

    return () => {
      active = false;
    };
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(searchTerm.trim() ? `/explore?q=${encodeURIComponent(searchTerm.trim())}` : '/explore');
  };

  const eyebrowLabel =
    typeof liveCount === 'number' && liveCount > 0
      ? `FOOD · ${liveCount} DECODED`
      : 'PACKAGED FOOD INTELLIGENCE';

  return (
    <div className="space-y-8">
      {/* Focused Workspace Welcome & Primary Actions */}
      <section className="rounded-3xl border border-[#DCE8DD] bg-white p-7 shadow-2xs sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#D4E4D5] bg-[#F2F8F2] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2E5238]">
          <Leaf className="h-3.5 w-3.5" />
          {eyebrowLabel}
        </span>

        <h1 className="mt-4 font-['Plus_Jakarta_Sans'] text-2xl font-extrabold uppercase leading-tight tracking-tight text-[#143326] sm:text-4xl">
          UNDERSTAND WHAT&apos;S IN YOUR PACKAGED FOOD.
        </h1>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.15em] text-[#426E4D]">
          READ THE LABEL WITHOUT DOING THE LABEL&apos;S JOB.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4B6154]">
          Nutrition labels, ingredients and useful context for the things you actually pick up in a shop.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/scanner"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2E5238] px-6 text-sm font-bold text-white shadow-xs transition hover:bg-[#1D4130]"
          >
            <ScanLine className="h-4 w-4" />
            Scan a Label
          </Link>

          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search packaged foods, brands, or barcodes..."
                aria-label="Search packaged foods"
                className="h-12 w-full rounded-xl border border-[#D2E0D3] bg-[#FAFDF9] pl-10 pr-4 text-sm text-[#143326] outline-none transition focus:border-[#426E4D] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 rounded-xl border border-[#C8DBC9] bg-white px-5 text-sm font-bold text-[#1D4130] transition hover:bg-[#F2F7F2]"
            >
              Search Foods
            </button>
          </form>
        </div>
      </section>

      {/* Compact Recent Activity Summary */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/explore"
          className="flex items-center justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5 transition hover:border-[#B6D2B9]"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6A7D72]">
              Catalogue Foods
            </span>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tabular-nums text-[#143326]">
              {liveCount ?? '—'}
            </p>
            <span className="text-xs text-[#5E7266]">Plus live Open Food Facts search</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EB] text-[#2E5238]">
            <PackageCheck className="h-5 w-5" />
          </div>
        </Link>

        <Link
          to="/history"
          className="flex items-center justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5 transition hover:border-[#B6D2B9]"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6A7D72]">
              Recent Scans
            </span>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tabular-nums text-[#143326]">
              {recentScans.length}
            </p>
            <span className="text-xs text-[#5E7266]">View or reopen past reports</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EB] text-[#2E5238]">
            <History className="h-5 w-5" />
          </div>
        </Link>

        <Link
          to="/saved"
          className="flex items-center justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5 transition hover:border-[#B6D2B9]"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6A7D72]">
              Saved Products
            </span>
            <p className="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tabular-nums text-[#143326]">
              {user ? savedProducts.length : '—'}
            </p>
            <span className="text-xs text-[#5E7266]">
              {user ? 'Bookmarked packaged foods' : 'Sign in to bookmark items'}
            </span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3EB] text-[#2E5238]">
            <Bookmark className="h-5 w-5" />
          </div>
        </Link>
      </section>

      {/* Recently Viewed & Recently Saved */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
              <Eye className="h-4 w-4 text-[#426E4D]" />
              Recently Viewed Products
            </h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5238] hover:underline">
              Explore <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!user ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center">
              <p className="text-xs font-semibold text-[#4B6154]">
                Sign in to automatically track recently viewed packaged foods.
              </p>
              <Link
                to="/account"
                className="mt-3 inline-flex rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white"
              >
                Sign In / Create Account
              </Link>
            </div>
          ) : recentlyViewed.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center text-xs text-[#5E7266]">
              You haven&apos;t opened any product detail pages yet.{' '}
              <Link to="/explore" className="font-bold text-[#2E5238] hover:underline">
                Browse Explore Foods
              </Link>
              .
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {recentlyViewed.slice(0, 4).map((item) => {
                const vStyle = getVerdictStyle(item.verdict);
                return (
                  <Link
                    key={item.productId}
                    to={`/products/${item.productId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#EDF2ED] p-3 transition hover:border-[#BFD5C1] hover:bg-[#FAFDF9]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#143326]">{item.productName}</p>
                      <p className="truncate text-xs text-[#6A7D72]">{item.brand || item.category}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${vStyle.pill}`}>
                      {item.healthScore != null ? `Score ${item.healthScore}` : 'N/A'}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-[#143326]">
              <Bookmark className="h-4 w-4 text-[#426E4D]" />
              Recently Saved Products
            </h2>
            <Link to="/saved" className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5238] hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!user ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center">
              <p className="text-xs font-semibold text-[#4B6154]">
                Save packaged foods and scan reports to build your personal reference library.
              </p>
              <Link
                to="/account"
                className="mt-3 inline-flex rounded-xl border border-[#C9DBC9] bg-white px-4 py-2 text-xs font-bold text-[#1D4130]"
              >
                Sign In to Access Library
              </Link>
            </div>
          ) : savedProducts.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center text-xs text-[#5E7266]">
              No saved products yet. Click &ldquo;Save Product&rdquo; on any product or scan report.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {savedProducts.slice(0, 4).map((s) => {
                const vStyle = getVerdictStyle(s.verdict);
                const linkTo = s.productId
                  ? `/products/${s.productId}`
                  : s.scanId
                    ? `/history?scanId=${s.scanId}`
                    : '/saved';
                return (
                  <Link
                    key={s.savedProductId}
                    to={linkTo}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#EDF2ED] p-3 transition hover:border-[#BFD5C1] hover:bg-[#FAFDF9]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#143326]">{s.productName}</p>
                      <p className="truncate text-xs text-[#6A7D72]">{s.brand || s.category || 'Packaged Food'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${vStyle.pill}`}>
                      {s.healthScore != null ? `Score ${s.healthScore}` : 'Saved'}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
