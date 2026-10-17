import { AlertTriangle } from "lucide-react";
import { TERMS_SECTIONS, TERMS_UPDATED } from "@/lib/terms";

export const TermsContent = () => (
  <article className="flex flex-col gap-5 text-[15px] leading-relaxed" data-testid="terms-content">
    <p className="text-sm text-[var(--muted)]" data-testid="terms-updated">Last updated: {TERMS_UPDATED}</p>
    <div className="flex gap-3 rounded-lg border-2 border-[var(--red)] bg-red-50 p-4 text-sm font-semibold text-red-950" data-testid="terms-summary">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red)]" />
      <p>In short: My Boat Prep is a reference and checklist tool. It does not replace your VHF radio, EPIRB, flares or other safety equipment, or proper training. The Skipper is always responsible for checking the information and for the safety of the vessel and crew.</p>
    </div>
    {TERMS_SECTIONS.map((s) => (
      <section key={s.id} className="flex flex-col gap-2" data-testid={`terms-section-${s.id}`}>
        <h2 className="font-display text-lg font-extrabold tracking-tight">{s.title}</h2>
        {s.body.map((p, i) => <p key={i} className={s.important && i === 0 ? "font-semibold" : ""}>{p}</p>)}
      </section>
    ))}
  </article>
);
