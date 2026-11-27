import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowRight,
  Info,
  ShieldAlert,
  ExternalLink,
  Database,
} from 'lucide-react';
import { ScoreRing, getNovaStyle, getVerdictStyle } from './ScoreBadge';
import NutritionCharts from './NutritionCharts';
import IngredientDecoderPanel from './IngredientDecoderPanel';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'nutrition', label: 'Nutrition Facts' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'assessment', label: 'Food Assessment' },
  { id: 'alternatives', label: 'Better Alternatives' },
  { id: 'sources', label: 'Data Sources' },
];

export default function ProductDetailTabs({
  product,
  assessment,
  betterAlternatives = [],
  nutriScoreGrade = null,
  rawCategories = [],
  isExternal = false,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const { getMatchedAllergens } = useAuth();

  if (!product || !assessment) return null;

  const matchedUserAllergens = getMatchedAllergens(
    product.allergens,
    assessment.ingredientsDecoded?.detectedAllergens
  );
  const verdictStyle = getVerdictStyle(assessment.verdict, assessment.grade);

  return (
    <div className="space-y-6">
      {matchedUserAllergens.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#EAB8B0] bg-[#FDF2F0] p-4 text-[#8E2F23]">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Personal Allergen Alert</p>
            <p className="mt-0.5 text-xs">
              Matches allergen(s) in your preferences: <strong>{matchedUserAllergens.join(', ')}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Horizontal Tab Bar */}
      <div className="overflow-x-auto border-b border-[#DCE6DD]">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'border-[#2E5238] text-[#143326]'
                  : 'border-transparent text-[#5E7266] hover:text-[#143326]'
              }`}
            >
              {tab.label}
              {tab.id === 'ingredients' && assessment.ingredientsDecoded?.totalCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[#EAF3EB] px-1.5 py-0.5 text-[10px] font-bold text-[#2E5238]">
                  {assessment.ingredientsDecoded.totalCount}
                </span>
              )}
              {tab.id === 'alternatives' && betterAlternatives.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#EAF3EB] px-1.5 py-0.5 text-[10px] font-bold text-[#2E5238]">
                  {betterAlternatives.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className={`rounded-3xl border p-6 ${verdictStyle.bg} ${verdictStyle.border}`}>
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {product.category && (
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#2E5238]">
                      {product.category}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${getNovaStyle(assessment.nova?.group)}`}>
                    <Layers className="h-3.5 w-3.5" />
                    {assessment.nova?.label}
                  </span>
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#5E7266]">
                    Data: {assessment.dataCompleteness}
                  </span>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-[#2C4739]">
                  {assessment.verdictSummary}
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-2xs">
                <ScoreRing
                  score={assessment.healthScore}
                  grade={assessment.grade}
                  verdict={assessment.verdict}
                  size="lg"
                />
              </div>
            </div>

            {assessment.highNutrientAlerts?.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-black/5 pt-4">
                {assessment.highNutrientAlerts.map((alert) => (
                  <span
                    key={alert}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#EEC6BE] bg-white px-3 py-1 text-xs font-bold text-[#96382C]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {alert}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#DCE9DD] bg-white p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#1E5631]">
                <CheckCircle2 className="h-5 w-5 text-[#428858]" />
                Positive Nutritional Factors
              </h3>
              {assessment.positiveFactors?.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-[#355243]">
                  {assessment.positiveFactors.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#488B5D]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#6A7D72]">
                  No standout positive nutritional attributes detected from available values.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#EED9D5] bg-white p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#96382C]">
                <XCircle className="h-5 w-5 text-[#C85546]" />
                Nutritional &amp; Processing Concerns
              </h3>
              {assessment.negativeFactors?.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-[#4A3532]">
                  {assessment.negativeFactors.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C85546]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#6A7D72]">
                  No major nutritional red flags triggered on available values.
                </p>
              )}
            </div>
          </div>

          {assessment.missingNutrients?.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-[#DCE6DD] bg-white p-4 text-xs text-[#4B6154]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5A8B66]" />
              <div>
                <span className="font-bold text-[#143326]">Unavailable Nutrients: </span>
                {assessment.missingNutrients.join(', ')}. Missing label data is kept explicitly unavailable and never treated as zero.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NUTRITION FACTS */}
      {activeTab === 'nutrition' && (
        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-[#143326]">Nutrition Analysis &amp; Daily Value Context</h2>
            <p className="text-xs text-[#5E7266]">
              Compare per 100g/ml, per serving, or calculate any custom portion against FSSAI / ICMR-NIN 2,000 kcal adult daily references.
            </p>
          </div>
          <NutritionCharts
            nutrients={assessment.nutrients}
            defaultServingG={product.servingSizeG}
            servingSizeText={product.servingSize}
            evaluationBasis={assessment.evaluationBasis}
            isPerServingCalculated={assessment.isPerServingCalculated}
          />
        </section>
      )}

      {/* TAB 3: INGREDIENTS */}
      {activeTab === 'ingredients' && (
        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-[#143326]">Ingredient Decoder</h2>
            <p className="text-xs text-[#5E7266]">
              Plain-language breakdown of every ingredient, additive, preservative, sweetener, and colourant in order of weight.
            </p>
          </div>
          <IngredientDecoderPanel decoded={assessment.ingredientsDecoded} />
        </section>
      )}

      {/* TAB 4: FOOD ASSESSMENT */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#143326]">NOVA Processing Classification</h2>
            <p className="mt-1 text-xs text-[#5E7266]">{assessment.nova?.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { g: 1, title: 'NOVA 1', sub: 'Minimally Processed' },
                { g: 2, title: 'NOVA 2', sub: 'Culinary Ingredients' },
                { g: 3, title: 'NOVA 3', sub: 'Processed Foods' },
                { g: 4, title: 'NOVA 4', sub: 'Ultra-Processed' },
              ].map((step) => {
                const active = assessment.nova?.group === step.g;
                return (
                  <div
                    key={step.g}
                    className={`rounded-xl border p-3 transition ${
                      active
                        ? `${getNovaStyle(step.g)} ring-2 ring-[#426E4D]/30 ring-offset-1`
                        : 'border-[#E8EFE9] bg-[#FAFDF9] text-[#7A8C81]'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{step.title}</div>
                    <div className="text-[11px] font-medium">{step.sub}</div>
                  </div>
                );
              })}
            </div>
            {assessment.nova?.triggers?.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#5E7266]">Detected markers:</span>
                {assessment.nova.triggers.map((t) => (
                  <span key={t} className="rounded-full bg-[#F3F6F3] px-2.5 py-0.5 text-xs font-medium text-[#2E5238]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </section>

          {assessment.scoreBreakdown?.length > 0 && (
            <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
              <h2 className="text-lg font-extrabold text-[#143326]">Transparent Score Breakdown</h2>
              <p className="mt-1 text-xs text-[#5E7266]">{assessment.methodologyNote}</p>
              <div className="mt-4 divide-y divide-[#EEF3EE]">
                {assessment.scoreBreakdown.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <div>
                      <span className="font-semibold text-[#143326]">{b.rule}</span>
                      <p className="text-xs text-[#5E7266]">{b.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold tabular-nums ${
                        b.sentiment === 'positive'
                          ? 'bg-[#E7F4EA] text-[#1F5932]'
                          : b.sentiment === 'negative'
                            ? 'bg-[#FDF0ED] text-[#96382C]'
                            : 'bg-[#F2F5F2] text-[#4B6154]'
                      }`}
                    >
                      {b.sentiment === 'neutral' ? `${b.pointsDelta} base` : b.pointsDelta > 0 ? `+${b.pointsDelta}` : b.pointsDelta}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 5: BETTER ALTERNATIVES */}
      {activeTab === 'alternatives' && (
        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
          <h2 className="text-lg font-extrabold text-[#143326]">
            Better Alternatives {product.category ? `in ${product.category}` : ''}
          </h2>
          <p className="mt-1 text-xs text-[#5E7266]">
            Comparable packaged foods with stronger deterministic nutrition profiles when reliable data is available.
          </p>

          {betterAlternatives.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {betterAlternatives.map((alt) => (
                <Link
                  key={alt.productId}
                  to={`/products/${alt.productId}`}
                  className="group flex flex-col justify-between rounded-2xl border border-[#DCE9DD] bg-[#FAFDF9] p-4 transition hover:-translate-y-0.5 hover:border-[#9EC4A4] hover:bg-white hover:shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-[#E8F4EB] px-2.5 py-0.5 text-xs font-extrabold text-[#1E5631] tabular-nums">
                        Score {alt.healthScore}
                      </span>
                      {alt.novaGroup && (
                        <span className="text-[11px] font-semibold text-[#5E7266]">NOVA {alt.novaGroup}</span>
                      )}
                    </div>
                    <h3 className="mt-2.5 text-sm font-bold text-[#143326] group-hover:text-[#356844]">
                      {alt.productName}
                    </h3>
                    {alt.brand && <p className="text-xs text-[#6A7D72]">{alt.brand}</p>}
                    <p className="mt-2 text-xs font-medium text-[#356844]">{alt.improvementReason}</p>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#2E5238]">
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[#D4E2D5] bg-[#FAFDF9] p-8 text-center text-sm text-[#5E7266]">
              No higher-scoring verified alternatives are currently available in this category, or this product already ranks at the top of its peer group.
            </div>
          )}
        </section>
      )}

      {/* TAB 6: DATA SOURCES */}
      {activeTab === 'sources' && (
        <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
            <Database className="h-5 w-5 text-[#426E4D]" />
            Product Data Provenance &amp; Completeness
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4 space-y-1.5">
              <div className="text-xs font-bold uppercase text-[#5E7266]">Primary Source</div>
              <div className="font-bold text-[#143326]">{product.dataSource || 'NutriLens Database'}</div>
              {isExternal && (
                <div className="text-xs text-[#5E7266]">Retrieved live via external food API</div>
              )}
              {product.offProductUrl && (
                <a
                  href={product.offProductUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5238] hover:underline"
                >
                  Open external source record <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4 space-y-1.5">
              <div className="text-xs font-bold uppercase text-[#5E7266]">Record Details</div>
              <div className="text-xs text-[#4B6154]">Barcode: <strong className="text-[#143326]">{product.barcode || 'Unavailable'}</strong></div>
              <div className="text-xs text-[#4B6154]">Nutri-Score (Source): <strong className="text-[#143326]">{nutriScoreGrade || 'Unavailable'}</strong></div>
              <div className="text-xs text-[#4B6154]">Data Completeness: <strong className="text-[#143326]">{assessment.dataCompleteness}</strong></div>
            </div>
          </div>

          {rawCategories?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase text-[#5E7266]">Source Category Tags</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rawCategories.map((c) => (
                  <span key={c} className="rounded-full bg-[#F4F7F4] px-2.5 py-0.5 text-xs text-[#4B6154]">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="rounded-2xl border border-[#F0D9AE] bg-[#FFF9ED] p-4 text-xs leading-relaxed text-[#704C13]">
            Data sourced from Open Food Facts and/or USDA FoodData Central. Missing fields remain marked Unavailable and are never treated as zero. Always verify ingredients and allergens on the physical package.
          </p>
        </section>
      )}
    </div>
  );
}
