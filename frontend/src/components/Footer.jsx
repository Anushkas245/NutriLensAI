import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#E3ECE4] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E7F1E8] text-[#356844]">
                <Leaf className="h-4 w-4" />
              </div>
              <span className="font-['Plus_Jakarta_Sans'] text-base font-extrabold text-[#143326]">
                NutriLens AI
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5E7266]">
              Transparent packaged food intelligence for human food products. Deterministic nutrition analysis, FSSAI daily-value context, NOVA food processing classification, and ingredient decoding.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E5238]">Platform</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#5E7266]">
              <li><Link to="/scanner" className="hover:text-[#143326]">Food Label Scanner</Link></li>
              <li><Link to="/explore" className="hover:text-[#143326]">Explore Food Catalogue</Link></li>
              <li><Link to="/compare" className="hover:text-[#143326]">Compare Products</Link></li>
              <li><Link to="/dashboard" className="hover:text-[#143326]">User Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E5238]">Transparency</h4>
            <ul className="mt-3 space-y-2 text-sm text-[#5E7266]">
              <li><Link to="/methodology" className="hover:text-[#143326]">Scoring Methodology</Link></li>
              <li><Link to="/sources" className="hover:text-[#143326]">Data Sources &amp; Disclaimer</Link></li>
            </ul>
            <p className="mt-3 text-xs text-[#7B8E82]">
              Exclusively for packaged human food.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-[#EEF3EE] pt-6 text-xs leading-relaxed text-[#5E7266]">
          Data sourced from Open Food Facts. Nutritional analysis is informational; consult a healthcare professional for dietary advice.
        </div>
      </div>
    </footer>
  );
}
