import { useState } from 'react';
import { Calculator, AlertTriangle } from 'lucide-react';

export default function NutritionCharts({
  nutrients = [],
  defaultServingG,
  servingSizeText,
  evaluationBasis,
  isPerServingCalculated,
}) {
  const [viewMode, setViewMode] = useState(
    evaluationBasis === 'per_serving' ? 'per_serving' : 'per_100g'
  );
  const [customGrams, setCustomGrams] = useState(
    defaultServingG && defaultServingG > 0 ? String(defaultServingG) : '30'
  );

  const parsedCustomG = Number.parseFloat(customGrams);
  const customFactor = Number.isFinite(parsedCustomG) && parsedCustomG > 0 ? parsedCustomG / 100 : null;

  const getVal = (n) => {
    if (viewMode === 'per_100g') return n.per100g;
    if (viewMode === 'per_serving') return n.perServing;
    if (viewMode === 'calculator') {
      if (n.per100g != null && customFactor != null) {
        return Math.round(n.per100g * customFactor * 100) / 100;
      }
      return null;
    }
    return null;
  };

  const getDv = (n) => {
    const val = getVal(n);
    if (val == null || !n.dailyValue || n.dailyValue <= 0) return null;
    return Math.round((val / n.dailyValue) * 1000) / 10;
  };

  // Macro energy split from available per_100g or per_serving
  const findNutrient = (key) => nutrients.find((n) => n.key === key);
  const proteinVal = getVal(findNutrient('protein') || {});
  const carbsVal = getVal(findNutrient('total_carbohydrate') || {});
  const fatVal = getVal(findNutrient('total_fat') || {});

  const proteinKcal = proteinVal != null ? proteinVal * 4 : 0;
  const carbsKcal = carbsVal != null ? carbsVal * 4 : 0;
  const fatKcal = fatVal != null ? fatVal * 9 : 0;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;

  const levelBadge = (level) => {
    switch (level) {
      case 'high':
        return 'bg-[#FBE7E4] text-[#96382C] border-[#F0CAC3]';
      case 'moderate':
        return 'bg-[#FDF3DF] text-[#8B5A12] border-[#F0DBB2]';
      case 'low':
      case 'positive':
        return 'bg-[#E8F4EB] text-[#1E5631] border-[#C4E2CB]';
      default:
        return 'bg-[#F3F6F3] text-[#5E7266] border-[#E0E8E1]';
    }
  };

  const barFill = (level, dv) => {
    if (level === 'high' || (dv != null && dv >= 25 && level !== 'positive')) return 'bg-[#C95C4C]';
    if (level === 'moderate') return 'bg-[#D69236]';
    if (level === 'positive' || level === 'low') return 'bg-[#488B5D]';
    return 'bg-[#6F967B]';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4ECE5] bg-[#F8FBF8] p-3.5">
        <div className="inline-flex rounded-xl border border-[#DCE6DD] bg-white p-1">
          {[
            { id: 'per_100g', label: 'Per 100g / 100ml' },
            { id: 'per_serving', label: servingSizeText ? `Per Serving (${servingSizeText})` : 'Per Serving' },
            { id: 'calculator', label: 'Serving Calculator' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === tab.id
                  ? 'bg-[#2E5238] text-white shadow-xs'
                  : 'text-[#4E6357] hover:text-[#143326]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {viewMode === 'calculator' && (
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#426E4D]" />
            <label className="text-xs font-semibold text-[#2E5238]" htmlFor="calc-grams">
              Portion (g/ml):
            </label>
            <input
              id="calc-grams"
              type="number"
              min="1"
              max="2000"
              value={customGrams}
              onChange={(e) => setCustomGrams(e.target.value)}
              className="w-20 rounded-lg border border-[#C9DBC9] bg-white px-2.5 py-1 text-xs font-bold text-[#143326] tabular-nums"
            />
            {[15, 30, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCustomGrams(String(preset))}
                className="hidden rounded-md border border-[#DCE6DD] bg-white px-2 py-1 text-[11px] font-semibold text-[#4B6154] hover:bg-[#EDF5EE] sm:inline-block"
              >
                {preset}g
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'per_serving' && isPerServingCalculated && (
        <p className="text-xs text-[#5E7266]">
          Note: Per-serving values are transparently calculated from per-100g data using the declared serving size ({defaultServingG} g).
        </p>
      )}

      {totalMacroKcal > 0 && (
        <div className="rounded-2xl border border-[#E4ECE5] bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#2E5238]">
            <span>Macronutrient Energy Split</span>
            <span className="text-[#6A7D72]">Estimated from Protein, Carbs &amp; Fat</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#EEF3EE]">
            <div
              style={{ width: `${(proteinKcal / totalMacroKcal) * 100}%` }}
              className="bg-[#3D7A52]"
              title={`Protein: ${Math.round((proteinKcal / totalMacroKcal) * 100)}%`}
            />
            <div
              style={{ width: `${(carbsKcal / totalMacroKcal) * 100}%` }}
              className="bg-[#9AC29F]"
              title={`Carbohydrates: ${Math.round((carbsKcal / totalMacroKcal) * 100)}%`}
            />
            <div
              style={{ width: `${(fatKcal / totalMacroKcal) * 100}%` }}
              className="bg-[#D9A75A]"
              title={`Fat: ${Math.round((fatKcal / totalMacroKcal) * 100)}%`}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-[#4B6154]">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3D7A52]" />
              Protein {Math.round((proteinKcal / totalMacroKcal) * 100)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#9AC29F]" />
              Carbs {Math.round((carbsKcal / totalMacroKcal) * 100)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#D9A75A]" />
              Fat {Math.round((fatKcal / totalMacroKcal) * 100)}%
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {nutrients.map((n) => {
          const val = getVal(n);
          const dv = getDv(n);
          const unavailable = val === null || val === undefined;

          return (
            <div
              key={n.key}
              className="rounded-2xl border border-[#E4ECE5] bg-white p-4 transition hover:border-[#CBE0CE]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#65796D]">
                    {n.label}
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    {unavailable ? (
                      <span className="text-sm font-semibold italic text-[#8A9B90]">
                        Unavailable
                      </span>
                    ) : (
                      <>
                        <span className="font-['Plus_Jakarta_Sans'] text-xl font-extrabold tabular-nums text-[#143326]">
                          {val}
                        </span>
                        <span className="text-xs font-semibold text-[#65796D]">{n.unit}</span>
                      </>
                    )}
                  </div>
                </div>

                {n.flagMessage && !unavailable && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${levelBadge(n.level)}`}>
                    {n.level === 'high' && <AlertTriangle className="h-3 w-3" />}
                    {n.flagMessage}
                  </span>
                )}
              </div>

              {!unavailable && dv !== null && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-[#6A7D72]">
                    <span>Daily Value (2,000 kcal ref)</span>
                    <span className="font-bold tabular-nums text-[#1D4130]">{dv}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDF3EE]">
                    <div
                      className={`h-full rounded-full ${barFill(n.level, dv)}`}
                      style={{ width: `${Math.min(100, dv)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
