import { BookOpen, Siren, Radio } from "lucide-react";

const INTROS = {
  shipsLog: {
    cls: "border-sky-200 bg-sky-50 text-sky-950", Icon: BookOpen, testId: "log-instructions",
    text: "A Ship's Log can be as simple as editing the departure details below filling out Date Time Destination and Persons on Board. However, you can add other note worthy logs as you decide. The offline mode lets you do that at sea. The idea here is that once you have reached your destination you can print off this log and add it to the Ship's Log binder on board.",
    tip: "export and email ship's logs, accumulate them and then bulk print them at your local print shop.",
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
  const intro = INTROS[listId];
  if (!intro) return null;
  const { cls, Icon, title, text, tip, testId } = intro;
  return (
    <div className={`mbp-pop flex gap-3 rounded-lg border-[1.5px] p-4 ${cls}`} data-testid={testId}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <div className="mb-0.5 font-display text-base font-extrabold tracking-wide">{title}</div>}
        {text}
        {tip && <p className="mt-2" data-testid="log-skipper-tip"><b className="text-[var(--blue)]">Skipper's Tip:</b> {tip}</p>}
      </div>
    </div>
  );
};
