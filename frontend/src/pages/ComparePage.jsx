import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Plus, X, Trophy, RefreshCw, AlertCircle, Leaf } from 'lucide-react';
import { PRODUCTS_API } from '../lib/api';
import { useCompare } from '../context/CompareContext';
import { getVerdictStyle, getNovaStyle } from '../components/ScoreBadge';

export default function ComparePage() {
  const { compareIds, toggleCompare, clearCompare } = useCompare();
  const [allProducts, setAllProducts] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [basis, setBasis] = useState('per_100g');

  useEffect(() => {
    PRODUCTS_API.list({ sort: 'name_asc' })
      .then((list) => setAllProducts(Array.isArray(list) ? list : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (compareIds.length < 2) {
      setCompareData(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    PRODUCTS_API.compare(compareIds)
      .then((data) => {
        if (active) setCompareData(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to compare selected products.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [compareIds]);

  const nutrientRows = [
    { key: 'calories', label: 'Calories (kcal)' },
    { key: 'protein', label: 'Protein (g)' },
    { key: 'total_carbohydrate', label: 'Carbohydrates (g)' },
    { key: 'total_sugars', label: 'Total Sugars (g)' },
    { key: 'added_sugars', label: 'Added Sugars (g)' },
    { key: 'dietary_fiber', label: 'Dietary Fiber (g)' },
    { key: 'total_fat', label: 'Total Fat (g)' },
    { key: 'saturated_fat', label: 'Saturated Fat (g)' },
    { key: 'trans_fat', label: 'Trans Fat (g)' },
    { key: 'sodium', label: 'Sodium (mg)' },
  ];

  const getMetricValue = (assessment, key) => {
    const m = assessment?.nutrients?.find((x) => x.key === key);
    if (!m) return null;
    return basis === 'per_100g' ? m.per100g : m.perServing;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-5 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">Compare Foods</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Compare 2 to 4 packaged food products side-by-side across nutrients, additives, and NOVA processing levels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#D4E2D5] bg-white p-1">
            <button
              type="button"
              onClick={() => setBasis('per_100g')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                basis === 'per_100g' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154]'
              }`}
            >
              Per 100g
            </button>
            <button
              type="button"
              onClick={() => setBasis('per_serving')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                basis === 'per_serving' ? 'bg-[#2E5238] text-white' : 'text-[#4B6154]'
              }`}
            >
              Per Serving
            </button>
          </div>

          {compareIds.length > 0 && (
            <button
              type="button"
              onClick={clearCompare}
              className="rounded-xl border border-[#E3ECE4] bg-white px-3.5 py-2 text-xs font-semibold text-[#5E7266] hover:text-[#143326]"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Product selector bar */}
      <div className="mt-6 rounded-2xl border border-[#E3ECE4] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2E5238]">
            Add product ({compareIds.length}/4):
          </span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                toggleCompare(Number(e.target.value));
                e.target.value = '';
              }
            }}
            disabled={compareIds.length >= 4}
            className="h-10 min-w-[240px] flex-1 rounded-xl border border-[#D4E2D5] bg-[#FAFDF9] px-3 text-sm text-[#143326]"
          >
            <option value="">Choose a packaged food to compare...</option>
            {allProducts
              .filter((p) => !compareIds.includes(p.productId))
              .map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.productName} {p.brand ? `(${p.brand})` : ''} — {p.category}
                </option>
              ))}
          </select>
        </div>

        {compareIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {compareIds.map((id) => {
              const found = allProducts.find((p) => p.productId === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#CBE0CD] bg-[#EEF6EE] px-3 py-1 text-xs font-semibold text-[#1D4130]"
                >
                  {found ? found.productName : `Product #${id}`}
                  <button
                    type="button"
                    onClick={() => toggleCompare(id)}
                    aria-label="Remove product"
                    className="rounded-full p-0.5 hover:bg-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {compareIds.length < 2 && (
        <div className="mt-8 rounded-3xl border border-dashed border-[#CFE0D0] bg-white p-10 text-center">
          <Scale className="mx-auto h-10 w-10 text-[#5A8B66]" />
          <h2 className="mt-3 text-lg font-extrabold text-[#143326]">Select at least 2 products</h2>
          <p className="mt-1 text-sm text-[#5E7266]">
            Use the dropdown above or click &ldquo;Compare&rdquo; on any product in Explore Foods.
          </p>
          <Link
            to="/explore"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Browse Catalogue
          </Link>
        </div>
      )}

      {loading && (
        <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-[#5E7266]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
          Comparing products...
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {compareData?.items?.length >= 2 && !loading && (
        <div className="mt-6 space-y-6">
          {/* Meaningful Differences */}
          {compareData.highlights?.differences?.length > 0 && (
            <div className="rounded-2xl border border-[#CFE2D1] bg-[#F3F8F3] p-5">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#143326]">
                <Trophy className="h-4 w-4 text-[#356844]" />
                Meaningful Differences
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-[#2C4739]">
                {compareData.highlights.differences.map((d, idx) => (
                  <li key={idx}>• {d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-3xl border border-[#E3ECE4] bg-white shadow-2xs">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E3ECE4] bg-[#FAFDF9]">
                  <th className="w-48 p-4 text-xs font-bold uppercase tracking-wider text-[#5E7266]">
                    Metric ({basis === 'per_100g' ? 'Per 100g' : 'Per Serving'})
                  </th>
                  {compareData.items.map(({ product, assessment }) => {
                    const vStyle = getVerdictStyle(assessment.verdict, assessment.grade);
                    const isWinner = compareData.highlights?.bestScoreProductId === product.productId;
                    return (
                      <th key={product.productId} className="p-4 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/products/${product.productId}`} className="group flex items-center gap-2.5">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.productName}
                                className="h-11 w-11 rounded-lg border border-[#E8EFE8] object-contain p-0.5"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EEF5EE] text-[#426E4D]">
                                <Leaf className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-extrabold text-[#143326] group-hover:text-[#356844]">
                                {product.productName}
                              </div>
                              <div className="text-[11px] font-medium text-[#6A7D72]">
                                {product.brand || product.category}
                              </div>
                            </div>
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleCompare(product.productId)}
                            className="rounded-lg p-1 text-[#7B8E82] hover:bg-[#EEF3EE] hover:text-[#143326]"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${vStyle.pill}`}>
                            Score {assessment.healthScore ?? 'N/A'}
                          </span>
                          {isWinner && (
                            <span className="rounded-full bg-[#2E5238] px-2 py-0.5 text-[10px] font-bold text-white">
                              Top Pick
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#EEF3EE]">
                <tr>
                  <td className="p-4 font-semibold text-[#2E5238]">Verdict</td>
                  {compareData.items.map(({ product, assessment }) => (
                    <td key={product.productId} className="p-4 text-xs font-bold text-[#143326]">
                      {assessment.verdict}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-[#2E5238]">NOVA Processing</td>
                  {compareData.items.map(({ product, assessment }) => (
                    <td key={product.productId} className="p-4">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${getNovaStyle(assessment.nova?.group)}`}>
                        {assessment.nova?.group ? `NOVA ${assessment.nova.group}` : 'Unknown'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-[#2E5238]">Additives / Total Ingredients</td>
                  {compareData.items.map(({ product, assessment }) => (
                    <td key={product.productId} className="p-4 tabular-nums text-xs font-semibold text-[#143326]">
                      {assessment.ingredientsDecoded?.additiveCount ?? 0} additives /{' '}
                      {assessment.ingredientsDecoded?.totalCount ?? 0} total
                    </td>
                  ))}
                </tr>

                {nutrientRows.map((row) => (
                  <tr key={row.key} className="hover:bg-[#FAFDF9]">
                    <td className="p-4 font-medium text-[#4B6154]">{row.label}</td>
                    {compareData.items.map(({ product, assessment }) => {
                      const val = getMetricValue(assessment, row.key);
                      const isBestSugar =
                        row.key === 'total_sugars' &&
                        compareData.highlights?.lowestSugarProductId === product.productId;
                      const isBestNa =
                        row.key === 'sodium' &&
                        compareData.highlights?.lowestSodiumProductId === product.productId;
                      const isBestProt =
                        row.key === 'protein' &&
                        compareData.highlights?.highestProteinProductId === product.productId;
                      const isBestFib =
                        row.key === 'dietary_fiber' &&
                        compareData.highlights?.highestFiberProductId === product.productId;

                      return (
                        <td key={product.productId} className="p-4 tabular-nums font-bold text-[#143326]">
                          {val !== null && val !== undefined ? (
                            <span className="inline-flex items-center gap-1.5">
                              {val}
                              {(isBestSugar || isBestNa || isBestProt || isBestFib) && (
                                <span className="rounded bg-[#E7F4EA] px-1.5 py-0.5 text-[10px] font-bold text-[#1E5631]">
                                  Best
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs font-normal italic text-[#8A9B90]">Unavailable</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr>
                  <td className="p-4 font-semibold text-[#2E5238]">Allergens</td>
                  {compareData.items.map(({ product, assessment }) => (
                    <td key={product.productId} className="p-4 text-xs text-[#5E7266]">
                      {assessment.ingredientsDecoded?.detectedAllergens?.length > 0
                        ? assessment.ingredientsDecoded.detectedAllergens.join(', ')
                        : product.allergens || 'None declared'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
