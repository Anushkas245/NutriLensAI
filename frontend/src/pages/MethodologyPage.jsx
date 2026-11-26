import { ShieldCheck, Layers, FlaskConical, Cpu } from 'lucide-react';

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-[#E3ECE4] pb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[#426E4D]">
          About &amp; Methodology
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-[#143326]">
          How NutriLens AI Evaluates Packaged Foods
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4B6154]">
          NutriLens AI is built exclusively for human packaged food products. Every score and classification is computed deterministically in our ASP.NET Core engine using transparent rules—separate from AI vision transcription and optional AI plain-language commentary.
        </p>
      </div>

      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
          <ShieldCheck className="h-5 w-5 text-[#426E4D]" />
          1. Deterministic Nutrition Scoring (0–100)
        </h2>
        <p className="text-sm leading-relaxed text-[#4B6154]">
          Products are evaluated primarily on a standardized <strong>per 100g / 100ml</strong> basis (falling back to per-serving only when per-100g is unavailable). Starting from a packaged-food baseline of 78 points, transparent adjustments are applied:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#4B6154]">
          <li><strong>Sugars &amp; Added Sugars:</strong> Deductions when exceeding 5g (moderate) or 15g/100g (&gt;10g/100ml for beverages).</li>
          <li><strong>Sodium:</strong> Deductions above 250mg, 600mg (high), and 900mg per 100g against the 2,000mg daily limit.</li>
          <li><strong>Saturated &amp; Trans Fats:</strong> Deductions above 1.5g and 5g saturated fat per 100g, plus trans fat &gt; 0.2g/100g.</li>
          <li><strong>Positive Nutrients:</strong> Bonuses for meaningful dietary fiber (≥ 3g and ≥ 6g/100g) and protein (≥ 6g and ≥ 12g/100g).</li>
          <li><strong>Processing &amp; Additives:</strong> Adjustments for NOVA 1 (+8), NOVA 4 (-14), artificial colours (-6), and chemical preservatives (-4).</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
          <Layers className="h-5 w-5 text-[#426E4D]" />
          2. NOVA Processing Classification (Groups 1–4)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { g: 'NOVA 1', title: 'Unprocessed / Minimally Processed', d: 'Plain oats, plain milk, foxnuts, or whole seeds with no added salt, sugar, or industrial additives.' },
            { g: 'NOVA 2', title: 'Processed Culinary Ingredients', d: 'Butter, oils, salt, or sugar extracted from whole foods for cooking.' },
            { g: 'NOVA 3', title: 'Processed Foods', d: 'Whole ingredients combined with salt, sugar, oil, or simple preservation without industrial cosmetic additives.' },
            { g: 'NOVA 4', title: 'Ultra-Processed Foods (UPF)', d: 'Industrial formulations with maltodextrin, invert sugar, hydrogenated fats, emulsifiers, flavour enhancers (INS 627/631), or synthetic dyes.' },
          ].map((item) => (
            <div key={item.g} className="rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] p-4">
              <span className="text-xs font-extrabold text-[#2E5238]">{item.g}</span>
              <h3 className="mt-0.5 text-sm font-bold text-[#143326]">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5E7266]">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
          <Cpu className="h-5 w-5 text-[#426E4D]" />
          3. Separation of AI Vision from Nutrition Math
        </h2>
        <p className="text-sm leading-relaxed text-[#4B6154]">
          Local AI vision (Qwen via Ollama) is used strictly for transcribing label images into structured fields and rejecting non-food items. Users always review and edit extracted values before deterministic scoring runs. Missing values remain marked <strong>Unavailable</strong> and are never treated as zero.
        </p>
      </section>

      <section className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#143326]">
          <FlaskConical className="h-5 w-5 text-[#426E4D]" />
          4. Ingredient &amp; INS Additive Decoder
        </h2>
        <p className="text-sm leading-relaxed text-[#4B6154]">
          Ingredient paragraphs are tokenized cleanly (including nested seasoning blends and parenthetical INS/E-codes) and mapped against our FSSAI/Codex-aligned additive dictionary to explain technological purpose, allergen presence, and concern tiers.
        </p>
      </section>
    </div>
  );
}
