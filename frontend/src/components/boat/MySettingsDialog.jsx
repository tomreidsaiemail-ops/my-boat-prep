import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import useAdminLists from "@/hooks/useAdminLists";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TIDE_WARNING } from "@/components/boat/navigator/TideWarning";
import { TrainingProgress } from "@/components/boat/TrainingProgress";

const WARNING = "Admin - Help Panel - Ignore 300 metre warning";
const FeatureToggle = ({ id, name, note, user, busy, online, save, green = false }) => (
  <label className={`flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm ${green && user?.[id] ? "bg-green-100" : ""}`} data-testid={`feature-${id}-label`}>
    <input type="checkbox" checked={!!user?.[id]} disabled={busy || !online} onChange={(e) => save("/me/features", { [id]: e.target.checked }, e.target.checked ? `${name} will show` : `${name} is hidden`)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`feature-${id}-checkbox`} />
    <span><b>Show {name}.</b>{note && <span className="block text-xs text-[var(--muted)]">{note}</span>}</span>
  </label>
);
const SHOW_FEATURES = [
  ["show_print_cards", "\"Print cards\" after zones on Boat Inventory", ""],
  ["show_hide_area", "\"Hide Area filter\" checkbox at bottom of lists", "While this is off, the Area filter stays hidden."],
];
const MAGIC_ICONS = [
  ["show_fish_icon", "\"Magic Fish Whisperer\" icon on home page", "The Magic Fish Whisperer is always in the menu."],
  ["show_bar_icon", "\"Magic Bartender\" icon on home page", "The Magic Bartender is always in the menu."],
];
// On unless the skipper turns them off; a ticked one sits on light green.
const MAGIC_ON = [
  ["show_magic_provisions", "Magic Provisioning Assistant on Provisions node", ""],
  ["show_magic_meal_plan", "Magic Provisioning Assistant and Make Shopping List on Meal Plan - Sample node", ""],
  ["show_magic_doctor", "MAGIC MARINE DOCTOR on First Aid nodes", ""],
  ["show_magic_electrical", "MAGIC MARINE ENGINEER on Electrical Service node", ""],
  ["show_magic_engine", "MAGIC MARINE ENGINEER on Engine Service node", ""],
  ["show_magic_budget", "MAGIC MARINER BUDGETING COMMENTS on Boat Budget node", ""],
];
const MAGIC_MORE = [
  ["show_nav_ask", "\"ASK THE MAGIC MARINE NAVIGATOR\" after START and DESTINATION in Trip Planning", ""],
  ["show_weather_photos", "\"WEATHER AND ROUTING PHOTOS\" after START and DESTINATION in Trip Planning", ""],
  ["show_topup", "\"Ask The Magic Mariner what's missing from the list\" at the bottom of lists", ""],
];

// The warning text comes from the admin Help Panel list, so it can be edited without a new release.
export const Ignore300Warning = ({ online }) => {
  const panels = useAdminLists("Admin - Help Panel - ", online);
  const items = panels.find((p) => p.name.trim().toLowerCase() === WARNING.toLowerCase())?.items || [];
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" role="alert" data-testid="ignore-300-warning">
      <p className="flex items-center gap-1.5 font-extrabold"><ShieldAlert className="h-4 w-4 shrink-0" /> Warning</p>
      {items.map((i, k) => (
        <p key={k} className={i.indent ? "relative pl-5 before:absolute before:left-1.5 before:content-['•']" : ""} data-testid={`ignore-300-warning-line-${k}`}>{i.label}</p>
      ))}
    </div>
  );
};

export const MySettingsDialog = ({ open, onClose }) => {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    window.addEventListener("online", up); window.addEventListener("offline", up);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);
  const save = async (path, body, done) => {
    setBusy(true);
    try {
      const { data } = await api.put(path, body);
      setUser(data);
      toast.success(done);
    } catch (e) { toast.error(apiError(e, "Couldn't save that setting, please try again")); }
    setBusy(false);
  };
  const toggle = (on) => save("/me/privacy", { ignore_300: on }, on ? "Broadcasting to your shore contact on or near land too" : "Positions on or near land are kept private again");
  const datum = user?.tide_datum || "CD";
  const showTides = (on) => save("/me/preferences", { show_tides: on }, on ? "High and low tide approximations will show" : "Tides are hidden");
  const tides = (d) => d !== datum && save("/me/preferences", { tide_datum: d }, d === "MSL" ? "Tides now show from Mean Sea Level (MSL)" : "Tides now show above Chart Datum (CD)");
  const footer = (on) => save("/me/features", { show_list_footer: on }, on ? "Reset All and the export buttons will show at the bottom of every list" : "Reset All and the exports are in the menu only");
  const sundowners = (on) => save("/me/features", { show_sundowners: on }, on ? "Sundowner time will show from sunset" : "Sundowner time is hidden");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent guard={false} className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg border-2 border-[var(--navy)] bg-white" data-testid="my-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-black text-[var(--navy)]"><Settings className="h-5 w-5" /> My settings</DialogTitle>
          <DialogDescription className="text-sm text-slate-700">Settings for you, on every boat.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="prefs" className="flex flex-col gap-3">
        <TabsList className="grid h-auto grid-cols-4 gap-1 bg-[var(--navy)]/10 p-1" data-testid="my-settings-tabs">
          {[["prefs", "User Preferences"], ["privacy", "Privacy Settings"], ["features", "Feature Settings"], ["training", "Training Progress"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="whitespace-normal px-1 py-1.5 text-[11px] font-extrabold uppercase leading-tight data-[state=active]:bg-[var(--navy)] data-[state=active]:text-white" data-testid={`my-settings-tab-${v}`}>{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="prefs" className="mt-0">
        <section className="flex flex-col gap-3" data-testid="user-preferences">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">User Preferences</h3>
          <label className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid="show-tides-label">
            <input type="checkbox" checked={!!user?.show_tides} disabled={busy || !online} onChange={(e) => showTides(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="show-tides-checkbox" />
            <span><b>Show high and low tide approximations</b> <span className="block text-xs text-[var(--muted)]">In Trip Planning and the Magic Marine Navigator.</span></span>
          </label>
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-[var(--red)]" data-testid="tide-settings-warning">{TIDE_WARNING}</p>
          {user?.show_tides && <>
          {[["CD", "Show High and Low Tides as CD (Chart Datum / Lowest Astronomical Tide)", "e.g. High 03:59 (2.72 m above CD)"], ["MSL", "Show High and Low Tides as MSL (Mean Sea Level)", "e.g. High 03:59 (+0.7 m MSL)"]].map(([d, label, eg]) => (
            <label key={d} className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid={`tide-datum-${d.toLowerCase()}-label`}>
              <input type="checkbox" checked={datum === d} disabled={busy || !online} onChange={(e) => tides(e.target.checked ? d : d === "CD" ? "MSL" : "CD")} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid={`tide-datum-${d.toLowerCase()}-checkbox`} />
              <span><b>{label}</b> <span className="block text-xs text-[var(--muted)]">{eg}</span></span>
            </label>
          ))}
          <p className="text-xs text-[var(--muted)]">Pick one. Where a tide station doesn't publish Chart Datum, heights show as MSL and say so.</p>
          </>}
          {!online && <p className="text-xs text-[var(--muted)]">Go online to change this setting.</p>}
        </section>
        </TabsContent>
        <TabsContent value="privacy" className="mt-0">
        <section className="flex flex-col gap-3" data-testid="privacy-settings">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">Privacy Settings</h3>
          <label className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid="ignore-300-label">
            <input type="checkbox" checked={!!user?.ignore_300} disabled={busy || !online} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="ignore-300-checkbox" />
            <span><b>Ignore 300 metre from land shore contact broadcast.</b> I want to broadcast to my shore contact and am aware of this privacy setting.</span>
            {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          </label>
          {!online && <p className="text-xs text-[var(--muted)]">Go online to change this setting.</p>}
          <Ignore300Warning online={online} />
        </section>
        </TabsContent>
        <TabsContent value="features" className="mt-0">
        <section className="flex flex-col gap-3" data-testid="feature-settings">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-[var(--navy)]">Feature Settings</h3>
          <label className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid="show-list-footer-label">
            <input type="checkbox" checked={!!user?.show_list_footer} disabled={busy || !online} onChange={(e) => footer(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="show-list-footer-checkbox" />
            <span><b>Reset All, Export button set List Footer.</b> Show Reset All..., Export Current, Export All and Export to Excel... at the bottom of every list. They are always in the menu under Reset all... and Export/Import...</span>
          </label>
          {SHOW_FEATURES.map(([key, name, note]) => <FeatureToggle key={key} id={key} name={name} note={note} user={user} busy={busy} online={online} save={save} />)}
          <h3 className="field-label pt-2" data-testid="racing-features-heading">Racing features</h3>
          <FeatureToggle id="show_post_departure" name="Post Departure, Start date and time" note="Shows Start date and time (optional) in Trip Planning, for a race start after you leave the dock." user={user} busy={busy} online={online} save={save} />
          <h3 className="field-label pt-2" data-testid="magic-features-heading">Magic features</h3>
          {MAGIC_ICONS.map(([key, name, note]) => <FeatureToggle key={key} id={key} name={name} note={note} user={user} busy={busy} online={online} save={save} />)}
          <label className="flex items-start gap-3 rounded-md border-[1.5px] border-[var(--navy)] p-3 text-sm" data-testid="show-sundowners-label">
            <input type="checkbox" checked={!!user?.show_sundowners} disabled={busy || !online} onChange={(e) => sundowners(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--navy)]" data-testid="show-sundowners-checkbox" />
            <span><b>Show Sundowners.</b> From sunset, show the SUNDOWNER TIME cocktail pick from the Magic Bartender.</span>
          </label>
          {MAGIC_MORE.map(([key, name, note]) => <FeatureToggle key={key} id={key} name={name} note={note} user={user} busy={busy} online={online} save={save} />)}
          {MAGIC_ON.map(([key, name, note]) => <FeatureToggle key={key} id={key} name={name} note={note} user={user} busy={busy} online={online} save={save} green />)}
          {!online && <p className="text-xs text-[var(--muted)]">Go online to change this setting.</p>}
        </section>
        </TabsContent>
        <TabsContent value="training" className="mt-0">
          <TrainingProgress uid={user?.user_id} online={online} />
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
