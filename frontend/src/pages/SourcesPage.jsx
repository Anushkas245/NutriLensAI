import { Database, AlertTriangle, ExternalLink } from 'lucide-react';

export default function SourcesPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="border-b border-[#E3ECE4] pb-5">
        <span className="text-xs font-bold uppercase tracking-wider text-[#426E4D]">
          Transparency
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-[#143326]">
          Data Sources &amp; Disclaimer
        </h1>
        <p className="mt-2 text-sm text-[#4B6154]">
          Every product profile and nutritional benchmark in NutriLens AI traces back to open food databases and published public-health references.
        </p>
      </div>

      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
          <Database className="h-5 w-5 text-[#426E4D]" />
          Primary Data &amp; Regulatory References
        </h2>

        <div className="space-y-3 text-sm text-[#4B6154]">
          <div className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4">
            <div className="flex items-center justify-between">
              <strong className="text-[#143326]">Open Food Facts (ODbL)</strong>
              <a
                href="https://world.openfoodfacts.org/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5238] hover:underline"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-1 text-xs">
              Used for packaged product metadata, barcodes, product imagery, ingredient paragraphs, and per-100g nutrition tables.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4">
            <strong className="text-[#143326]">FSSAI &amp; ICMR-NIN Dietary Guidelines (India)</strong>
            <p className="mt-1 text-xs">
              Used for 2,000 kcal adult daily reference values, HFSS (High Fat, Sugar, Salt) thresholds, Indian food labelling conventions, and INS additive codes.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4">
            <strong className="text-[#143326]">WHO &amp; NOVA Food Classification</strong>
            <p className="mt-1 text-xs">
              Used for free sugar, sodium (&lt; 2,000 mg/day), trans-fat (&lt; 1% energy) guidance, and 4-group processing classification.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#F0D9AE] bg-[#FFF9ED] p-6 space-y-2">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-[#8B5A12]">
          <AlertTriangle className="h-5 w-5" />
          Important Informational Disclaimer
        </h2>
        <p className="text-sm leading-relaxed text-[#6E4911]">
          NutriLens AI is an informational packaged-food label analysis tool and does not provide medical, clinical, or personalized dietetic advice. Always verify ingredients, allergens, and serving sizes directly on the physical food package—manufacturers may reformulate products without immediate database updates. AI-extracted text can contain OCR mistakes, which is why manual review is built into every scan.
        </p>
      </section>
    </div>
  );
}
