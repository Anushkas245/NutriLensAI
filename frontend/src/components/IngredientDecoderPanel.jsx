import { useState } from 'react';
import { ShieldAlert, CheckCircle2, Info } from 'lucide-react';

export default function IngredientDecoderPanel({ decoded }) {
  const [filter, setFilter] = useState('all');

  if (!decoded || !decoded.items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D6E3D7] bg-[#FAFDF9] p-6 text-center text-sm text-[#5E7266]">
        No ingredient list is available for this product. Missing ingredient details are never guessed.
      </div>
    );
  }

  const filtered = decoded.items.filter((item) => {
    if (filter === 'additives') return item.isAdditive || item.isPreservative;
    if (filter === 'sweeteners') return item.isSweetener || item.isArtificialColour;
    if (filter === 'watch') return item.concernLevel === 'watch' || item.concernLevel === 'moderate';
    return true;
  });

  const concernBadge = (level) => {
    if (level === 'watch') return 'bg-[#FBE8E5] text-[#96382C] border-[#F0C9C2]';
    if (level === 'moderate') return 'bg-[#FDF4E1] text-[#8B5A12] border-[#EFD9AE]';
    return 'bg-[#E9F4EC] text-[#1F5932] border-[#C5E2CC]';
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[#E4ECE5] bg-white p-3">
          <span className="text-[11px] font-semibold uppercase text-[#6B7D72]">Ingredients</span>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#143326]">{decoded.totalCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4ECE5] bg-white p-3">
          <span className="text-[11px] font-semibold uppercase text-[#6B7D72]">Additives</span>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#143326]">{decoded.additiveCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4ECE5] bg-white p-3">
          <span className="text-[11px] font-semibold uppercase text-[#6B7D72]">Preservatives</span>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#143326]">{decoded.preservativeCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4ECE5] bg-white p-3">
          <span className="text-[11px] font-semibold uppercase text-[#6B7D72]">Sweeteners</span>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#143326]">{decoded.sweetenerCount}</p>
        </div>
        <div className="rounded-xl border border-[#E4ECE5] bg-white p-3">
          <span className="text-[11px] font-semibold uppercase text-[#6B7D72]">Colours</span>
          <p className="mt-1 text-lg font-extrabold tabular-nums text-[#143326]">{decoded.artificialColourCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: `All (${decoded.items.length})` },
          { id: 'additives', label: `Additives & Preservatives (${decoded.items.filter((i) => i.isAdditive || i.isPreservative).length})` },
          { id: 'sweeteners', label: `Sweeteners & Colours (${decoded.items.filter((i) => i.isSweetener || i.isArtificialColour).length})` },
          { id: 'watch', label: `Flagged / Moderate (${decoded.items.filter((i) => i.concernLevel !== 'low').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === tab.id
                ? 'border-[#2E5238] bg-[#2E5238] text-white'
                : 'border-[#D9E5DA] bg-white text-[#4A6154] hover:bg-[#F3F8F4]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((item) => (
          <div
            key={`${item.orderIndex}-${item.rawName}`}
            className="rounded-2xl border border-[#E4ECE5] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-[#EFF5EF] px-1.5 py-0.5 text-[10px] font-bold text-[#426E4D]">
                    #{item.orderIndex}
                  </span>
                  <h4 className="text-sm font-bold text-[#143326]">{item.normalizedName}</h4>
                  {item.insCode && (
                    <span className="rounded-md bg-[#F2F5F2] px-1.5 py-0.5 text-[10px] font-bold text-[#4A5E53]">
                      {item.insCode}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs font-medium text-[#5A8B66]">{item.category}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${concernBadge(item.concernLevel)}`}>
                {item.concernLevel === 'watch' && <ShieldAlert className="h-3 w-3" />}
                {item.concernLevel === 'moderate' && <Info className="h-3 w-3" />}
                {item.concernLevel === 'low' && <CheckCircle2 className="h-3 w-3" />}
                {item.concernLevel}
              </span>
            </div>

            <p className="mt-2.5 text-xs text-[#2E5238]">
              <strong className="font-semibold">Purpose:</strong> {item.purpose}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#5E7266]">{item.plainExplanation}</p>

            {item.allergenTags?.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {item.allergenTags.map((a) => (
                  <span key={a} className="rounded-full bg-[#FDF0D9] px-2 py-0.5 text-[10px] font-bold text-[#8B5A12]">
                    Allergen: {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
