import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Siren, Radio } from "lucide-react";

const HIDE_KEY = "mbp_log_help_hidden";

const INTROS = {
  shipsLog: {
    cls: "border-sky-200 bg-sky-50 text-sky-950", Icon: BookOpen, testId: "log-instructions",
    text: "A Ship's Log can be as simple as editing the departure details below filling out Date Time Destination and Persons on Board. However, you can add other note worthy logs as you decide. The offline mode lets you do that at sea. The idea here is that once you have reached your destination you can print off this log and add it to the Ship's Log binder on board.",
    tip: "complete Ship's Log below for this voyage then click Email Ship's Log below when back at the dock, accumulate the Ship's Logs in your Ship's Logs email folder and then bulk print them at your local print shop, and then add them to the binder onboard.",
  },
  mayDay: {
    cls: "border-[var(--red)] bg-[var(--red)] text-white", Icon: Siren, testId: "mayday-banner",
    title: "MAYDAY · VHF Channel 16", text: "Grave and imminent danger to vessel or life. Read each line aloud, tick as you go.",
  },
  panPan: {
    cls: "border-[var(--amber)] bg-[var(--amber)] text-white", Icon: Radio, testId: "panpan-banner",
    title: "PAN PAN · VHF Channel 16", text: "Urgent situation, no immediate danger to life. Read each line aloud, tick as you go.",
  },
};

export const ListIntro = ({ listId }) => {
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === "1");
  const intro = INTROS[listId];
  if (!intro) return null;
  const { cls, Icon, title, text, tip, testId } = intro;
  const collapsible = listId === "shipsLog";
  const setHide = (v) => { setHidden(v); localStorage.setItem(HIDE_KEY, v ? "1" : "0"); };
  if (collapsible && hidden) {
    return (
      <button type="button" onClick={() => setHide(false)} data-testid="log-help-show-btn"
        className="flex min-h-[48px] items-center justify-between gap-2 rounded-lg border-[1.5px] border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-950 [transition:background-color_.15s] hover:bg-sky-100">
        <span className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Show Ship&apos;s Log help</span>
        <ChevronDown className="h-5 w-5" />
      </button>
    );
  }
  return (
    <div className={`mbp-pop flex gap-3 rounded-lg border-[1.5px] p-4 ${cls}`} data-testid={testId}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <div className="mb-0.5 font-display text-base font-extrabold tracking-wide">{title}</div>}
        {text}
        {tip && <p className="mt-2" data-testid="log-skipper-tip"><b className="text-[var(--blue)]">Skipper's Tip:</b> {tip}</p>}
        {collapsible && (
          <button type="button" onClick={() => setHide(true)} data-testid="log-help-hide-btn"
            className="mt-2 inline-flex min-h-[40px] items-center gap-1 font-bold text-[var(--blue)] hover:underline">
            <ChevronUp className="h-4 w-4" /> Hide help
          </button>
        )}
      </div>
    </div>
  );
};
