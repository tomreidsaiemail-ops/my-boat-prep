import { Wine } from "lucide-react";

const CheersIcon = () => (
  <span className="ml-1 inline-flex items-end align-middle text-amber-600" role="img" aria-label="Cheers" data-testid="bartender-cheers-icon">
    <Wine className="h-5 w-5 -rotate-[18deg]" /><Wine className="-ml-1.5 h-5 w-5 rotate-[18deg]" />
  </span>
);

export const BartenderHelp = () => (
  <div className="flex flex-col gap-1.5 text-left text-sm text-[var(--muted)]" data-testid="bartender-help">
    <p>Photo your gantry (your drink bottles, say vodka) as a drinks boat area.</p>
    <p>and then photo your fridge (for your soft drinks lemons etc) - it can be tagged as food and drinks.</p>
    <p>and then photo anything else the MAGIC BARTENDER might be interested in like your drink shopping on the saloon table. You can allocate a temporary food and drink boat area for that.</p>
    <p data-testid="bartender-skipper-tip"><b className="text-[var(--navy)]">The Skipper&apos;s tip:</b> buy a cheap DC ice maker <CheersIcon /></p>
  </div>
);
