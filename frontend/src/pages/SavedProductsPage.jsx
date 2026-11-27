import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Search, Trash2, ArrowRight, RefreshCw, User } from 'lucide-react';
import { USER_API, PACKAGED_CATEGORIES } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getVerdictStyle, getNovaStyle } from '../components/ScoreBadge';

export default function SavedProductsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    USER_API.dashboard()
      .then((res) => {
        if (active) setItems(res?.savedProducts || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleRemove = async (savedId) => {
    try {
      await USER_API.removeSaved(savedId);
      setItems((prev) => prev.filter((x) => x.savedProductId !== savedId));
    } catch {
      // ignore
    }
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        item.productName?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    });
  }, [items, search, category]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E3ECE4] pb-5">
        <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">Saved Products</h1>
        <p className="mt-1 text-sm text-[#5E7266]">
          Your personal library of bookmarked packaged foods and scanned product reports.
        </p>
      </div>

      {!user ? (
        <div className="rounded-3xl border border-[#DCE8DD] bg-white p-10 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-[#5A8B66]" />
          <h2 className="mt-3 text-lg font-extrabold text-[#143326]">Sign in to view saved products</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5E7266]">
            Bookmarks are tied to your NutriLens AI account so you can revisit them anytime.
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
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E3ECE4] bg-white p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter saved products by name or brand..."
                className="h-10 w-full rounded-xl border border-[#D7E4D8] bg-[#FAFDF9] pl-10 pr-3 text-sm text-[#143326]"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter saved products by category"
              className="h-10 rounded-xl border border-[#D7E4D8] bg-white px-3 text-xs font-semibold text-[#1D4130]"
            >
              <option value="all">All Categories</option>
              {PACKAGED_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-[#5E7266]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
              Loading saved products...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#CFE0D0] bg-white p-10 text-center">
              <Bookmark className="mx-auto h-9 w-9 text-[#5A8B66]" />
              <h2 className="mt-3 text-base font-extrabold text-[#143326]">
                {items.length === 0 ? 'No saved products yet' : 'No saved items match your filter'}
              </h2>
              <p className="mt-1 text-xs text-[#5E7266]">
                Explore packaged foods or scan a label and click &ldquo;Save Product&rdquo;.
              </p>
              <Link
                to="/explore"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white"
              >
                Explore Foods <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => {
                const vStyle = getVerdictStyle(item.verdict);
                const detailLink = item.productId
                  ? `/products/${item.productId}`
                  : item.scanId
                    ? `/history?scanId=${item.scanId}`
                    : null;

                return (
                  <article
                    key={item.savedProductId}
                    className="flex flex-col justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-[#EFF5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                          {item.category || 'Packaged Food'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {item.novaGroup && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getNovaStyle(item.novaGroup)}`}>
                              NOVA {item.novaGroup}
                            </span>
                          )}
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                            {item.healthScore != null ? item.healthScore : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <h3 className="mt-4 text-base font-bold text-[#143326]">{item.productName}</h3>
                      <p className="text-xs text-[#6A7D72]">
                        {item.brand || 'Packaged Food'} • Saved {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      {item.verdict && (
                        <p className="mt-2 text-xs font-semibold text-[#4B6154]">{item.verdict}</p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#EEF3EE] pt-3">
                      {detailLink ? (
                        <Link to={detailLink} className="text-xs font-bold text-[#2E5238] hover:underline">
                          {item.productId ? 'Open Product Details →' : 'Open Scan Report →'}
                        </Link>
                      ) : (
                        <span className="text-xs text-[#7B8E82]">Saved snapshot</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(item.savedProductId)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#7B8E82] hover:bg-[#FDF2F0] hover:text-[#96382C]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
