import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ClipboardList, Siren, Radio } from "lucide-react";

const INTROS = {
  shipsLog: {
    cls: "border-sky-200 bg-sky-50 text-sky-950", Icon: BookOpen, testId: "log-instructions",
    text: "A Ship's Log can be as simple as editing the departure details below filling out Date Time Destination and Persons on Board. However, you can add other note worthy logs as you decide. The offline mode lets you do that at sea. The idea here is that once you have reached your destination you can print off this log and add it to the Ship's Log binder on board.",
    tip: "complete Ship's Log below for this voyage then click Email Ship's Log below when back at the dock, accumulate the Ship's Logs in your Ship's Logs email folder and then bulk print them at your local print shop, and then add them to the binder onboard.",
    hideKey: "mbp_log_help_hidden", showLabel: "Show Ship's Log help",
  },
  myTodo: {
    cls: "border-emerald-200 bg-emerald-50 text-emerald-950", Icon: ClipboardList, testId: "todo-instructions",
    text: "My To Do List is for the little issues you notice as you go, like a sticky winch, a blown nav light bulb, a frayed sheet or a dripping tap. Add each one below as soon as you spot it, even offline at sea, so nothing gets forgotten. Tick items off when they're fixed and delete them when you no longer need them. Tick \"Show List Ordering Icons\" below the list to number your items, then tap the flag to mark one urgent (it jumps to the top and turns red), use the up and down arrows, or tap a number to move an item straight to that spot.",
    tip: "before your next trip to the chandlery or a visit from your marine engineer, use Export Current or Email PDF to take the list with you.",
    hideKey: "mbp_todo_help_hidden", showLabel: "Show My To Do List help",
  },
  mayDay: {
    cls: "border-[var(--red)] bg-[var(--red)] text-white", Icon: Siren, testId: "mayday-banner",
    title: "MAYDAY · VHF Channel 16", text: "Grave and imminent danger to vessel or life. Read each line aloud, tick as you go.",
    confirm: "I, the Skipper, have checked the May Day list below and confirm it is a valid May Day call for the waters I am in.",
  },
  panPan: {
    cls: "border-[var(--amber)] bg-[var(--amber)] text-white", Icon: Radio, testId: "panpan-banner",
    title: "PAN PAN · VHF Channel 16", text: "Urgent situation, no immediate danger to life. Read each line aloud, tick as you go.",
    confirm: "I, the Skipper, have checked the Pan Pan list below and confirm it is a valid Pan Pan call for the waters I am in.",
  },
};

export const ListIntro = ({ listId, canHide, onLockedHide, skipperChecked, onSkipperCheck }) => {
  const intro = INTROS[listId];
  const [stored, setHidden] = useState(() => !!intro?.hideKey && localStorage.getItem(intro.hideKey) === "1");
  const hidden = stored && canHide;
  if (!intro) return null;
  const { cls, Icon, title, text, tip, testId, hideKey, showLabel, confirm } = intro;
  const collapsible = !!hideKey;
  const prefix = listId === "shipsLog" ? "log" : "todo";
  const setHide = (v) => {
    if (v && !canHide) { onLockedHide(); return; }
    setHidden(v);
    localStorage.setItem(hideKey, v ? "1" : "0");
  };
  if (collapsible && hidden) {
    return (
      <button type="button" onClick={() => setHide(false)} data-testid={`${prefix}-help-show-btn`}
        className={`flex min-h-[48px] items-center justify-between gap-2 rounded-lg border-[1.5px] px-4 text-sm font-bold [transition:filter_.15s] hover:brightness-95 ${cls}`}>
        <span className="flex items-center gap-2"><Icon className="h-5 w-5" /> {showLabel}</span>
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
        {confirm && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-md border-2 border-white/70 bg-white/10 p-3 font-bold" data-testid={`${listId}-skipper-check-label`}>
            <input type="checkbox" checked={!!skipperChecked} onChange={(e) => onSkipperCheck(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-white" data-testid={`${listId}-skipper-check`} />
            <span>{confirm}</span>
          </label>
        )}
        {tip && <p className="mt-2" data-testid={`${prefix}-skipper-tip`}><b className="text-[var(--blue)]">Skipper's Tip:</b> {tip}</p>}
        {collapsible && (
          <button type="button" onClick={() => setHide(true)} data-testid={`${prefix}-help-hide-btn`}
            className="mt-2 inline-flex min-h-[40px] items-center gap-1 font-bold text-[var(--blue)] hover:underline">
            <ChevronUp className="h-4 w-4" /> Hide help
          </button>
        )}
      </div>
    </div>
  );
};
