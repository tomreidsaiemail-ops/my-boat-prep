import { BookOpen, Siren, Radio } from "lucide-react";

const INTROS = {
  shipsLog: {
    cls: "border-sky-200 bg-sky-50 text-sky-950", Icon: BookOpen, testId: "log-instructions",
    text: "A Ship's Log can be as simple as editing the departure details below. The offline mode lets you do that at sea. Once reached your destination, print off this log and add it to the Ship's Log binder on board.",
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
  const { cls, Icon, title, text, testId } = intro;
  return (
    <div className={`mbp-pop flex gap-3 rounded-lg border-[1.5px] p-4 ${cls}`} data-testid={testId}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm leading-relaxed">
        {title && <div className="mb-0.5 font-display text-base font-extrabold tracking-wide">{title}</div>}
        {text}
      </div>
    </div>
  );
};
