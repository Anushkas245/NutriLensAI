import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { PRODUCTS_API, PACKAGED_CATEGORIES } from '../lib/api';
import { getVerdictStyle, getNovaStyle } from '../components/ScoreBadge';
import { useCompare } from '../context/CompareContext';
import { useAuth } from '../context/AuthContext';

export default function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [nova, setNova] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sort, setSort] = useState('score_desc');
  const [useMyAllergens, setUseMyAllergens] = useState(false);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Open Food Facts live search state
  const [mode, setMode] = useState('catalog'); // 'catalog' | 'off'
  const [offQuery, setOffQuery] = useState('');
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState('');
  const [importingBarcode, setImportingBarcode] = useState('');

  const { compareIds, toggleCompare } = useCompare();
  const { user } = useAuth();

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const excludeAllergen =
        useMyAllergens && user?.allergens?.length ? user.allergens.join(',') : '';
      const data = await PRODUCTS_API.list({
        q: query,
        category,
        nova,
        grade,
        sort,
        excludeAllergen,
      });
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load packaged food catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [category, nova, grade, sort, useMyAllergens]);

  const handleCatalogSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (query) next.set('q', query);
    else next.delete('q');
    setSearchParams(next);
    loadCatalog();
  };

  const handleOffSearch = async (e) => {
    e.preventDefault();
    if (offQuery.trim().length < 2) return;
    setOffLoading(true);
    setOffError('');
    try {
      const res = await PRODUCTS_API.searchOff(offQuery.trim());
      setOffResults(Array.isArray(res) ? res : []);
    } catch (err) {
      setOffError(err.message || 'Open Food Facts search failed.');
    } finally {
      setOffLoading(false);
    }
  };

  const handleImportOff = async (barcode) => {
    setImportingBarcode(barcode);
    try {
      const res = await PRODUCTS_API.importOff(barcode);
      if (res?.product?.productId) {
        setOffResults((prev) =>
          prev.map((item) =>
            item.barcode === barcode
              ? { ...item, existingProductId: res.product.productId }
              : item
          )
        );
        loadCatalog();
      }
    } catch (err) {
      setOffError(err.message || 'Could not import product.');
    } finally {
      setImportingBarcode('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-[#143326]">Explore Packaged Foods</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Search verified products in SQL Server or pull live records from Open Food Facts.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-[#D4E2D5] bg-white p-1">
          <button
            type="button"
            onClick={() => setMode('catalog')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
              mode === 'catalog' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154] hover:text-[#143326]'
            }`}
          >
            NutriLens Catalogue
          </button>
          <button
            type="button"
            onClick={() => setMode('off')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
              mode === 'off' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154] hover:text-[#143326]'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Live Open Food Facts
          </button>
        </div>
      </div>

      {mode === 'catalog' ? (
        <>
          {/* Filters & Search */}
          <div className="mt-6 rounded-2xl border border-[#E3ECE4] bg-white p-4 shadow-2xs">
            <form onSubmit={handleCatalogSearch} className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-5">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by product, brand, barcode, or ingredient..."
                  className="h-10 w-full rounded-xl border border-[#D7E4D8] bg-[#FAFDF9] pl-10 pr-3 text-sm text-[#143326] outline-none focus:border-[#426E4D] focus:bg-white"
                />
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

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-[#5E7266]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
              Loading packaged food products...
            </div>
          ) : error ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#D3E0D4] bg-white p-10 text-center">
              <p className="text-base font-bold text-[#143326]">No matching packaged foods found</p>
              <p className="mt-1 text-xs text-[#5E7266]">
                Try broadening filters or switch to Live Open Food Facts to search &amp; import products.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
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

                      <Link to={`/products/${p.productId}`} className="mt-4 flex items-center gap-3.5 group">
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
                          <h2 className="line-clamp-2 text-base font-bold text-[#143326] group-hover:text-[#356844]">
                            {p.productName}
                          </h2>
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
          )}
        </>
      ) : (
        /* Live Open Food Facts Tab */
        <div className="mt-6 space-y-5">
          <form onSubmit={handleOffSearch} className="flex flex-col gap-3 rounded-2xl border border-[#E3ECE4] bg-white p-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]" />
              <input
                type="search"
                value={offQuery}
                onChange={(e) => setOffQuery(e.target.value)}
                placeholder="Search Open Food Facts globally (e.g. Maggi, Dark Fantasy, Epigamia, Kellogg's)..."
                className="h-11 w-full rounded-xl border border-[#D7E4D8] bg-[#FAFDF9] pl-10 pr-3 text-sm text-[#143326] outline-none focus:border-[#426E4D] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={offLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2E5238] px-5 text-sm font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
            >
              {offLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Search Open Food Facts
            </button>
          </form>

          {offError && (
            <div className="rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]">
              {offError}
            </div>
          )}

          {offResults.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offResults.map((item) => (
                <div key={item.barcode} className="flex flex-col justify-between rounded-2xl border border-[#E3ECE4] bg-white p-5">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-[#EFF5EF] px-2.5 py-0.5 text-[11px] font-semibold text-[#356844]">
                        {item.category}
                      </span>
                      <span className="text-[11px] font-mono text-[#6A7D72]">{item.barcode}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-14 w-14 shrink-0 rounded-xl border border-[#E8EFE8] object-contain p-1"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#EEF5EE] text-[#426E4D]">
                          <Leaf className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-bold text-[#143326]">{item.productName}</h3>
                        <p className="truncate text-xs text-[#6A7D72]">{item.brand || 'Open Food Facts'}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#F7FAF7] p-2 text-center text-xs">
                      <div>
                        <span className="block text-[10px] text-[#6A7D72]">kcal/100g</span>
                        <strong>{item.caloriesPer100g ?? '—'}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#6A7D72]">Sugar</span>
                        <strong>{item.sugarPer100g != null ? `${item.sugarPer100g}g` : '—'}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#6A7D72]">NOVA</span>
                        <strong>{item.novaGroup ?? '—'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#EEF3EE] pt-3">
                    {item.existingProductId ? (
                      <Link
                        to={`/products/${item.existingProductId}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#1E5631] hover:underline"
                      >
                        <Check className="h-3.5 w-3.5" />
                        View in NutriLens →
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleImportOff(item.barcode)}
                        disabled={importingBarcode === item.barcode}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
                      >
                        {importingBarcode === item.barcode ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Import &amp; Analyze
                      </button>
                    )}
                    <a
                      href={item.offProductUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-[#5E7266] hover:underline"
                    >
                      OFF Source
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
