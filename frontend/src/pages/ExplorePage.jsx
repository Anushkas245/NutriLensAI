import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Scale,
  Globe,
  Plus,
  Check,
  RefreshCw,
  Leaf,
  AlertCircle,
  Database,
  Barcode,
  ChevronDown,
  X,
} from 'lucide-react';
import { PRODUCTS_API, PACKAGED_CATEGORIES } from '../lib/api';
import { getVerdictStyle, getNovaStyle } from '../components/ScoreBadge';
import { useCompare } from '../context/CompareContext';
import { useAuth } from '../context/AuthContext';

const LOCAL_PAGE_SIZE = 12;

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || 'all';

  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [category, setCategory] = useState(urlCategory);
  const [nova, setNova] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sort, setSort] = useState('score_desc');
  const [useMyAllergens, setUseMyAllergens] = useState(false);

  const [scope, setScope] = useState('all'); // 'all' | 'local' | 'external'
  const [externalSource, setExternalSource] = useState('all'); // 'all' | 'off' | 'usda'

  // Local SQL catalogue state
  const [products, setProducts] = useState([]);
  const [localVisibleCount, setLocalVisibleCount] = useState(LOCAL_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // External live search state
  const [extItems, setExtItems] = useState([]);
  const [extPage, setExtPage] = useState(1);
  const [extHasMore, setExtHasMore] = useState(false);
  const [extTotal, setExtTotal] = useState(0);
  const [extSourcesUsed, setExtSourcesUsed] = useState([]);
  const [extWarnings, setExtWarnings] = useState([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extLoadingMore, setExtLoadingMore] = useState(false);
  const [extError, setExtError] = useState('');
  const [importingKey, setImportingKey] = useState('');

  const extReqSeq = useRef(0);
  const { compareIds, toggleCompare } = useCompare();
  const { user } = useAuth();

  // Sync URL params when navigating from Homepage search or Category cards
  useEffect(() => {
    setQuery(urlQuery);
    setDebouncedQuery(urlQuery);
    setCategory(urlCategory);
  }, [urlQuery, urlCategory]);

  // Debounce search input (450ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const isBarcodeQuery = useMemo(() => /^\d{6,14}$/.test(debouncedQuery), [debouncedQuery]);

  // 1. Load local SQL Server catalogue
  const loadCatalog = async (searchStr = debouncedQuery) => {
    if (scope === 'external') {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const excludeAllergen =
        useMyAllergens && user?.allergens?.length ? user.allergens.join(',') : '';
      const data = await PRODUCTS_API.list({
        q: searchStr,
        category,
        nova,
        grade,
        sort,
        excludeAllergen,
      });
      setProducts(Array.isArray(data) ? data : []);
      setLocalVisibleCount(LOCAL_PAGE_SIZE);
    } catch (err) {
      setError(err.message || 'Unable to load packaged food catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog(debouncedQuery);
  }, [debouncedQuery, category, nova, grade, sort, useMyAllergens, scope]);

  // 2. Load live external results (Open Food Facts + USDA fallback) whenever query or external scope changes
  const runExternalSearch = async ({ q = debouncedQuery, page = 1, append = false } = {}) => {
    const shouldSearchExternal =
      scope === 'external'
        ? q.length >= 2 || category !== 'all'
        : scope === 'all' && q.length >= 2;

    if (!shouldSearchExternal) {
      if (!append) {
        setExtItems([]);
        setExtTotal(0);
        setExtHasMore(false);
        setExtWarnings([]);
        setExtSourcesUsed([]);
        setExtError('');
      }
      return;
    }

    const seq = ++extReqSeq.current;
    if (append) setExtLoadingMore(true);
    else {
      setExtLoading(true);
      setExtError('');
    }

    try {
      const res = await PRODUCTS_API.searchExternal({
        q,
        category,
        source: externalSource,
        page,
        pageSize: 12,
      });
      if (seq !== extReqSeq.current) return;

      const incoming = Array.isArray(res?.items) ? res.items : [];
      setExtItems((prev) => {
        if (!append) return incoming;
        const seen = new Set(prev.map((x) => `${x.source}:${x.externalId}`));
        return [...prev, ...incoming.filter((x) => !seen.has(`${x.source}:${x.externalId}`))];
      });
      setExtPage(res?.page || page);
      setExtHasMore(Boolean(res?.hasMore));
      setExtTotal(res?.totalCount || incoming.length);
      setExtSourcesUsed(res?.sourcesUsed || []);
      setExtWarnings(res?.warnings || []);
    } catch (err) {
      if (seq !== extReqSeq.current) return;
      setExtError(err.message || 'External food database search failed.');
      if (!append) setExtItems([]);
    } finally {
      if (seq === extReqSeq.current) {
        setExtLoading(false);
        setExtLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    runExternalSearch({ q: debouncedQuery, page: 1, append: false });
  }, [debouncedQuery, category, scope, externalSource]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    if (category && category !== 'all') next.set('category', category);
    else next.delete('category');
    setSearchParams(next);
    setDebouncedQuery(trimmed);
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next);
  };

  const handleImportExternal = async (item) => {
    const key = `${item.source}:${item.externalId}`;
    setImportingKey(key);
    try {
      const res = await PRODUCTS_API.importExternal(item.source, item.externalId);
      if (res?.product?.productId) {
        setExtItems((prev) =>
          prev.map((x) =>
            `${x.source}:${x.externalId}` === key
              ? { ...x, existingProductId: res.product.productId }
              : x
          )
        );
        loadCatalog(debouncedQuery);
      }
    } catch (err) {
      setExtError(err.message || 'Could not import product into SQL Server.');
    } finally {
      setImportingKey('');
    }
  };

  // Deduplicate external results against local results already displayed
  const localProductIds = useMemo(() => new Set(products.map((p) => p.productId)), [products]);
  const localBarcodes = useMemo(
    () =>
      new Set(
        products
          .map((p) => (p.barcode || '').trim().replace(/^0+/, ''))
          .filter(Boolean)
      ),
    [products]
  );

  const visibleExternalItems = useMemo(() => {
    return extItems.filter((item) => {
      if (item.existingProductId && localProductIds.has(item.existingProductId)) return false;
      const normCode = (item.barcode || '').trim().replace(/^0+/, '');
      if (normCode && localBarcodes.has(normCode)) return false;
      if (nova !== 'all' && item.novaGroup && String(item.novaGroup) !== nova) return false;
      if (grade !== 'all' && item.grade && item.grade !== grade) return false;
      return true;
    });
  }, [extItems, localProductIds, localBarcodes, nova, grade]);

  const visibleLocalProducts = products.slice(0, localVisibleCount);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-[#143326]">Explore Packaged Foods</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Search by product name, brand, category, or barcode across our SQL Server catalogue and live Open Food Facts / USDA databases.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-xl border border-[#D4E2D5] bg-white p-1">
          {[
            { id: 'all', label: 'All Sources' },
            { id: 'local', label: 'Local Catalogue' },
            { id: 'external', label: 'Live External Only' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                scope === tab.id ? 'bg-[#2E5238] text-white' : 'text-[#4B6154] hover:text-[#143326]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Search & Filter Panel */}
      <div className="mt-6 rounded-2xl border border-[#E3ECE4] bg-white p-4 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Lay's, Oreo, Maggi, Coca-Cola, or 13-digit barcode..."
              className="h-10 w-full rounded-xl border border-[#D7E4D8] bg-[#FAFDF9] pl-10 pr-20 text-sm text-[#143326] outline-none focus:border-[#426E4D] focus:bg-white"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {isBarcodeQuery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F2E8] px-1.5 py-0.5 text-[10px] font-bold text-[#2E5238]">
                  <Barcode className="h-3 w-3" /> Barcode
                </span>
              )}
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="rounded-md p-1 text-[#6B7E73] hover:bg-[#EDF3EE] hover:text-[#143326]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-10 rounded-xl border border-[#D7E4D8] bg-white px-3 text-xs font-semibold text-[#1D4130] md:col-span-3"
          >
            <option value="all">All Packaged Food Categories</option>
            {PACKAGED_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            aria-label="Filter by NOVA processing group"
            className="h-10 rounded-xl border border-[#D7E4D8] bg-white px-3 text-xs font-semibold text-[#1D4130] md:col-span-2"
          >
            <option value="all">All NOVA Groups</option>
            <option value="1">NOVA 1 (Minimal)</option>
            <option value="2">NOVA 2 (Culinary)</option>
            <option value="3">NOVA 3 (Processed)</option>
            <option value="4">NOVA 4 (Ultra-Processed)</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort products"
            className="h-10 rounded-xl border border-[#D7E4D8] bg-white px-3 text-xs font-semibold text-[#1D4130] md:col-span-2"
          >
            <option value="score_desc">Sort: Highest Score</option>
            <option value="score_asc">Sort: Lowest Score</option>
            <option value="sugar_asc">Sort: Lowest Sugar</option>
            <option value="sodium_asc">Sort: Lowest Sodium</option>
            <option value="protein_desc">Sort: Highest Protein</option>
            <option value="calories_asc">Sort: Lowest Calories</option>
            <option value="name_asc">Sort: Name A–Z</option>
          </select>
        </form>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF3EE] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[#5E7266]" />
            <span className="text-xs font-semibold text-[#5E7266]">Grade:</span>
            {['all', 'A', 'B', 'C', 'D'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  grade === g
                    ? 'bg-[#2E5238] text-white'
                    : 'bg-[#F2F6F2] text-[#4B6154] hover:bg-[#E4EFE5]'
                }`}
              >
                {g === 'all' ? 'All' : `Grade ${g}`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {scope !== 'local' && (
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4B6154]">
                <Globe className="h-3.5 w-3.5 text-[#426E4D]" />
                External source:
                <select
                  value={externalSource}
                  onChange={(e) => setExternalSource(e.target.value)}
                  className="rounded-lg border border-[#D7E4D8] bg-white px-2 py-1 text-xs font-bold text-[#143326]"
                >
                  <option value="all">Open Food Facts + USDA</option>
                  <option value="off">Open Food Facts only</option>
                  <option value="usda">USDA FoodData Central</option>
                </select>
              </label>
            )}

            {user?.allergens?.length > 0 && (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#1D4130]">
                <input
                  type="checkbox"
                  checked={useMyAllergens}
                  onChange={(e) => setUseMyAllergens(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2E5238]"
                />
                Exclude my allergens ({user.allergens.join(', ')})
              </label>
            )}
          </div>
        </div>
      </div>

      {compareIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C6DEC8] bg-[#EEF6EE] px-4 py-3">
          <span className="text-xs font-bold text-[#1D4130]">
            {compareIds.length} product{compareIds.length > 1 ? 's' : ''} selected for comparison
          </span>
          <Link
            to="/compare"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1D4130]"
          >
            <Scale className="h-3.5 w-3.5" />
            Open Comparison
          </Link>
        </div>
      )}

      {/* SECTION 1: LOCAL SQL SERVER CATALOGUE */}
      {scope !== 'external' && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#426E4D]" />
              <h2 className="text-lg font-extrabold text-[#143326]">
                NutriLens Local Catalogue
              </h2>
              <span className="rounded-full bg-[#EAF3EB] px-2.5 py-0.5 text-xs font-bold text-[#2E5238]">
                {products.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-[#5E7266]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
              Searching local catalogue...
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D3E0D4] bg-white p-6 text-center">
              <p className="text-sm font-bold text-[#143326]">
                No matches in the local SQL Server catalogue
                {debouncedQuery ? ` for “${debouncedQuery}”` : ''}
              </p>
              <p className="mt-1 text-xs text-[#5E7266]">
                {debouncedQuery.length >= 2
                  ? 'Check the Live External Results below from Open Food Facts & USDA.'
                  : 'Type at least 2 characters or a barcode to search millions of products live.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleLocalProducts.map((p) => {
                  const vStyle = getVerdictStyle(p.verdict, p.grade);
                  const inCompare = compareIds.includes(p.productId);
                  return (
                    <article
                      key={p.productId}
                      className="flex flex-col justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5 transition hover:border-[#B6D2B9] hover:shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-[#EFF5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                            {p.category || 'Packaged Food'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {p.novaGroup && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getNovaStyle(p.novaGroup)}`}>
                                NOVA {p.novaGroup}
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                              {p.healthScore != null ? `${p.healthScore}` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <Link to={`/products/${p.productId}`} className="group mt-4 flex items-center gap-3.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.productName}
                              className="h-16 w-16 shrink-0 rounded-xl border border-[#E8EFE8] bg-[#FAFDF9] object-contain p-1"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#EEF5EE] text-[#426E4D]">
                              <Leaf className="h-6 w-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-base font-bold text-[#143326] group-hover:text-[#356844]">
                              {p.productName}
                            </h3>
                            <p className="truncate text-xs text-[#6A7D72]">
                              {p.brand || 'Packaged Food'} {p.netWeight ? `• ${p.netWeight}` : ''}
                            </p>
                          </div>
                        </Link>

                        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[#F7FAF7] p-2.5 text-center text-xs">
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">kcal</span>
                            <strong className="tabular-nums text-[#143326]">{p.caloriesPer100g ?? '—'}</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">Sugar</span>
                            <strong className="tabular-nums text-[#143326]">
                              {p.sugarPer100g != null ? `${p.sugarPer100g}g` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">Sodium</span>
                            <strong className="tabular-nums text-[#143326]">
                              {p.sodiumMgPer100g != null ? `${p.sodiumMgPer100g}mg` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">Protein</span>
                            <strong className="tabular-nums text-[#143326]">
                              {p.proteinPer100g != null ? `${p.proteinPer100g}g` : '—'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEF3EE] pt-3">
                        <Link
                          to={`/products/${p.productId}`}
                          className="text-xs font-bold text-[#2E5238] hover:underline"
                        >
                          Full Analysis →
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleCompare(p.productId)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                            inCompare
                              ? 'border-[#2E5238] bg-[#2E5238] text-white'
                              : 'border-[#D4E2D5] bg-white text-[#2E5238] hover:bg-[#F1F7F1]'
                          }`}
                        >
                          {inCompare ? <Check className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
                          {inCompare ? 'Added' : 'Compare'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {products.length > localVisibleCount && (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => setLocalVisibleCount((c) => c + LOCAL_PAGE_SIZE)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9DBC9] bg-white px-5 py-2 text-xs font-bold text-[#1D4130] hover:bg-[#F2F8F2]"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Show More Local Products ({products.length - localVisibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* SECTION 2: LIVE EXTERNAL RESULTS (OPEN FOOD FACTS + USDA) */}
      {scope !== 'local' && (
        <section className="mt-10 border-t border-[#E3ECE4] pt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="h-4 w-4 text-[#426E4D]" />
              <h2 className="text-lg font-extrabold text-[#143326]">
                Live External Food Databases
              </h2>
              {extSourcesUsed.map((s) => (
                <span key={s} className="rounded-full border border-[#D4E4D5] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                  {s}
                </span>
              ))}
              {extTotal > 0 && (
                <span className="text-xs font-medium text-[#5E7266]">
                  ({visibleExternalItems.length} shown{extTotal > visibleExternalItems.length ? ` of ~${extTotal} matches` : ''})
                </span>
              )}
            </div>
          </div>

          {debouncedQuery.length < 2 && !(scope === 'external' && category !== 'all') ? (
            <div className="rounded-2xl border border-dashed border-[#CFE0D0] bg-white p-8 text-center">
              <Globe className="mx-auto h-8 w-8 text-[#5A8B66]" />
              <p className="mt-2 text-sm font-bold text-[#143326]">
                Search millions of packaged foods live
              </p>
              <p className="mt-1 text-xs text-[#5E7266]">
                Enter a product name, brand, or barcode above (e.g., &ldquo;Oreo biscuits&rdquo;, &ldquo;Maggi noodles&rdquo;, &ldquo;Coca-Cola&rdquo;, or &ldquo;8901058023787&rdquo;) to fetch live data from Open Food Facts and USDA FoodData Central.
              </p>
            </div>
          ) : extLoading ? (
            <div className="flex min-h-[180px] items-center justify-center gap-2 rounded-2xl border border-[#E3ECE4] bg-white text-sm text-[#5E7266]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
              Querying live food databases for &ldquo;{debouncedQuery || category}&rdquo;...
            </div>
          ) : extError ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{extError}</span>
            </div>
          ) : visibleExternalItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D3E0D4] bg-white p-8 text-center">
              <p className="text-sm font-bold text-[#143326]">No additional external products found</p>
              <p className="mt-1 text-xs text-[#5E7266]">
                {extItems.length > 0
                  ? 'All matching external records are already displayed in your local catalogue above.'
                  : 'Try a simpler product or brand keyword, or search by barcode.'}
              </p>
            </div>
          ) : (
            <>
              {extWarnings.length > 0 && (
                <div className="mb-4 rounded-xl border border-[#F0D9AE] bg-[#FFF9ED] px-4 py-2.5 text-xs text-[#8B5A12]">
                  {extWarnings.join(' • ')}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleExternalItems.map((item) => {
                  const key = `${item.source}:${item.externalId}`;
                  const vStyle = getVerdictStyle(item.verdict, item.grade);
                  const detailUrl = item.existingProductId
                    ? `/products/${item.existingProductId}`
                    : `/products/external/${item.source}/${encodeURIComponent(item.externalId)}`;

                  return (
                    <article
                      key={key}
                      className="flex flex-col justify-between rounded-2xl border border-[#DCE8DD] bg-white p-5 transition hover:border-[#9CC2A2] hover:shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#EFF5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                              {item.category}
                            </span>
                            <span className="rounded-full border border-[#DCE6DD] bg-[#FAFDF9] px-2 py-0.5 text-[10px] font-semibold text-[#5E7266]">
                              {item.dataSource}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.nutriScoreGrade && (
                              <span
                                title="Open Food Facts Nutri-Score"
                                className="rounded-md border border-[#DCE6DD] bg-[#F8FAF8] px-1.5 py-0.5 text-[10px] font-extrabold text-[#1D4130]"
                              >
                                NS {item.nutriScoreGrade}
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                              {item.healthScore != null ? item.healthScore : 'Partial'}
                            </span>
                          </div>
                        </div>

                        <Link to={detailUrl} className="group mt-4 flex items-center gap-3.5">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.productName}
                              className="h-16 w-16 shrink-0 rounded-xl border border-[#E8EFE8] bg-[#FAFDF9] object-contain p-1"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#EEF5EE] text-[#426E4D]">
                              <Leaf className="h-6 w-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-base font-bold text-[#143326] group-hover:text-[#356844]">
                              {item.productName}
                            </h3>
                            <p className="truncate text-xs text-[#6A7D72]">
                              {item.brand || item.dataSource}
                              {item.barcode ? ` • ${item.barcode}` : ''}
                            </p>
                          </div>
                        </Link>

                        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[#F7FAF7] p-2.5 text-center text-xs">
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">kcal</span>
                            <strong className="tabular-nums text-[#143326]">{item.caloriesPer100g ?? '—'}</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">Sugar</span>
                            <strong className="tabular-nums text-[#143326]">
                              {item.sugarPer100g != null ? `${item.sugarPer100g}g` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">Sodium</span>
                            <strong className="tabular-nums text-[#143326]">
                              {item.sodiumMgPer100g != null ? `${item.sodiumMgPer100g}mg` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#6A7D72]">NOVA</span>
                            <strong className="tabular-nums text-[#143326]">
                              {item.novaGroup ? `G${item.novaGroup}` : '—'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEF3EE] pt-3">
                        <Link
                          to={detailUrl}
                          className="text-xs font-bold text-[#2E5238] hover:underline"
                        >
                          View Details →
                        </Link>

                        {item.existingProductId ? (
                          <Link
                            to={`/products/${item.existingProductId}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#E9F4EC] px-2.5 py-1 text-xs font-bold text-[#1E5631]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            In Catalogue
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImportExternal(item)}
                            disabled={importingKey === key}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#2E5238] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
                          >
                            {importingKey === key ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                            Save to SQL
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {extHasMore && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    disabled={extLoadingMore}
                    onClick={() => runExternalSearch({ q: debouncedQuery, page: extPage + 1, append: true })}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#C9DBC9] bg-white px-5 py-2.5 text-xs font-bold text-[#1D4130] hover:bg-[#F2F8F2] disabled:opacity-60"
                  >
                    {extLoadingMore ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    Load More External Products
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
