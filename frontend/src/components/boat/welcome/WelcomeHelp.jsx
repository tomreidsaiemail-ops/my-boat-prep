import { useEffect, useRef, useState } from "react";
import { Ship } from "lucide-react";
import { FoldHeader } from "@/components/boat/navigator/FoldHeader";
import { glow, previewHome, previewList, wait } from "@/lib/glow";

const P = ({ children, testId }) => <p className="text-sm" data-testid={testId}>{children}</p>;
const ShowMe = ({ onClick, testId }) => (
  <button type="button" onClick={onClick} className="ml-1 inline rounded border border-[var(--navy)] bg-white px-1.5 align-baseline text-sm font-bold text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white" data-testid={testId}>Show me</button>
);
const showHome = () => Promise.all([glow("boat-details-home-btn", 5000), glow("set-home-list-btn", 5000)]);
const showCross = (pulse) => { const done = previewList("Boat Inventory", 5000, pulse === true); setTimeout(() => { glow("list-selector-preview", 4950); glow("set-home-list-btn", 4950); }, 50); return done; };

// The Home button and Model Vessel help: a short yellow-highlight tour, then folded into one line once the skipper ticks "Thanks".
export const WelcomeHelp = ({ welcomeHome, ack, onAck, onSwitchModel, startOpen, onOpen }) => {
  const [open, setOpen] = useState(!ack || !!startOpen);
  const [homeOpen, setHomeOpen] = useState(true);
  const [mvNote, setMvNote] = useState(false);
  const ran = useRef(false);
  const tour = async () => {
    if (welcomeHome) { await glow("boat-details-home-btn", 2000); await glow("set-home-list-btn", 2000); }
    else await glow("set-home-list-btn", 1000);
    await wait(400);
    await Promise.all([previewHome("Boat Inventory", "cross", 1000), glow("boat-details-home-btn", 1000), glow("set-home-list-btn", 1000)]);
    await wait(300);
    await Promise.all([previewHome("Trip Planning", "cross", 1000), glow("boat-details-home-btn", 1000), glow("set-home-list-btn", 1000)]);
    await wait(300);
    await glow("boat-crew-btn", 2000);
    await glow("boat-selector", 1000);
    setMvNote(true);
  };
  useEffect(() => { if (!ack && !ran.current) { ran.current = true; tour(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const thanks = () => { onAck(); setOpen(false); setTimeout(() => glow("welcome-help-toggle", 2000), 100); };
  return (
    <section className="flex flex-col gap-3 rounded-md border-[1.5px] border-[var(--navy)] bg-white p-3" data-testid="welcome-help">
      <FoldHeader open={open} onToggle={() => { if (!open) onOpen?.(); setOpen((o) => !o); }} testId="welcome-help-toggle">Home button and Model Vessel Help</FoldHeader>
      {open && <>
        <FoldHeader open={homeOpen} onToggle={() => setHomeOpen((o) => !o)} testId="welcome-home-toggle">HOME button setting</FoldHeader>
        {homeOpen && <div className="flex flex-col gap-2 border-l-4 border-amber-400 pl-3" data-testid="welcome-home-help">
          {welcomeHome
            ? <>
              <P testId="welcome-home-made">The Welcome screen has been made your home screen.<ShowMe onClick={showHome} testId="welcome-show-home-btn" /></P>
              <P testId="welcome-home-cross">Selecting Boat Inventory the home icon would get a cross.<ShowMe onClick={showCross} testId="welcome-show-cross-btn" /></P>
              <P testId="welcome-home-remains">Welcome remains your home screen.<ShowMe onClick={() => glow("boat-details-home-btn", 5000)} testId="welcome-show-remains-btn" /></P>
              <P testId="welcome-home-set-new">If cross icon showing, click it sets new home.<ShowMe onClick={() => showCross(true)} testId="welcome-show-set-new-btn" /></P>
            </>
            : <P testId="welcome-home-other">This will be showing the Home icon with a cross, not a tick. It will change to your Home icon with a tick and the &quot;Welcome&quot; button will change to your list.</P>}
        </div>}
        <P testId="welcome-crew-help"><b>Do you want to make your crew safer?</b> The crew button (highlighted) is where you can register and invite your crew by cutting and pasting from your crew spreadsheet, or simply typing in a list of names and emails. Take the Model Vessel tutorial &quot;Crew Registration and Invites&quot;: any changes, even crew registrations, happen only on the Model Vessel.</P>
        <P>The Model Vessel is available, just like another boat you own. This is how you switch to it: pick it in the boat list at the top (highlighted).</P>
        {mvNote && <P testId="welcome-mv-green">The Model Vessel is green themed so you will know you are working with it and not your own boat.</P>}
        <P>The Model Vessel tutorials are very quick to go through, and you don&apos;t even have to type in route details: they have a &quot;Do It For Me&quot; feature that fills in what it wants. The Model Vessel comes with a boat schematic showing the galley, saloon and cabin layouts, so it is a great starting point to see how to organise your own schematic, and it can do magic scanning without you taking a photo, as the photos already exist.</P>
        <P>You can switch to the Model Vessel while going through the Welcome screen, or hop out to the Model Vessel or any list like Trip Planning. The Welcome screen opens each time you sign in, right where you left off, until you have been through every section. After that you select it like any other list.</P>
        {onSwitchModel && <button type="button" className="btn-solid h-11 justify-center" onClick={onSwitchModel} data-testid="welcome-switch-model-btn"><Ship className="h-4 w-4" />Switch to the Model Vessel</button>}
        <label className="flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm font-bold" data-testid="welcome-mv-ack">
          <input type="checkbox" checked={!!ack} disabled={!!ack} onChange={thanks} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="welcome-mv-ack-checkbox" />
          <span>Thanks for the info on the Model Vessel, I&apos;ll check it out later by switching to it as if it was another boat I own.</span>
        </label>
      </>}
      {ack && !open && <p className="text-xs text-[var(--muted)]" data-testid="welcome-fold-note">My Boat Prep uses this hide and show, collapse and expand feature in lots of places. So if something appears missing, it may just be hidden or collapsed.</p>}
    </section>
  );
};
