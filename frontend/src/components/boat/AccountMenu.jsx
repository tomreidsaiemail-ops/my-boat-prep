import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Crown, ListChecks, LogOut, MapPinned, Settings, ShieldCheck, TicketPercent, UserRound } from "lucide-react";
import { MySettingsDialog } from "@/components/boat/MySettingsDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useUpgrade } from "@/context/UpgradeContext";
import { SignOutDialog } from "@/components/boat/SignOutDialog";
import { ConfirmDelete } from "@/components/boat/ConfirmDelete";
import { pendingAgreement, pendingPhone, pendingRsvp } from "@/lib/pendingAgreement";
import { PhoneReminderDialog } from "@/components/boat/PhoneReminderDialog";
import { SignOutRsvpDialog } from "@/components/boat/crew/SignOutRsvpDialog";
import { MagicBalance } from "@/components/boat/MagicBalance";

const unsyncedCount = () => Number(localStorage.getItem("mbp_outbox_v3") || 0);

const TIER = { free: "Free", beta_tester: "Beta", pro: "Pro" };

export const TierBadge = ({ role, launchFree }) => (
  <span data-testid="tier-badge" title={launchFree && role === "free" ? "Pro is free for everyone during the FIRST200 launch" : undefined} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
    role === "pro" || (launchFree && role === "free") ? "bg-amber-100 text-amber-900" : role === "beta_tester" ? "bg-sky-100 text-sky-900" : "bg-slate-200 text-slate-700"}`}>
    {launchFree && role === "free" ? "Pro (launch)" : TIER[role] || role}
  </span>
);

export const AccountMenu = () => {
  const { user, logout } = useAuth();
  const { openPlan } = useUpgrade();
  const navigate = useNavigate();
  const [warnCount, setWarnCount] = useState(0);
  const [termsFor, setTermsFor] = useState("");
  const [rsvpSend, setRsvpSend] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [askPhone, setAskPhone] = useState(null);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    const open = () => setSettings(true);
    window.addEventListener("mbp:open-settings", open);
    return () => window.removeEventListener("mbp:open-settings", open);
  }, []);
  if (!user) return null;
  const leave = () => { const n = unsyncedCount(); if (n > 0) setWarnCount(n); else logout(); };
  const afterTerms = () => { const save = pendingPhone(); if (save) setAskPhone(() => save); else leave(); };
  const afterRsvp = () => { const v = pendingAgreement(); if (v) setTermsFor(v); else afterTerms(); };
  const signOut = () => { const ask = pendingRsvp(); if (ask) setRsvpSend(ask); else afterRsvp(); };
  // Crew on several trips are asked about each one they haven't answered.
  const nextRsvp = () => { setRsvpSend(null); setTimeout(() => { const ask = pendingRsvp(); if (ask) setRsvpSend(ask); else afterRsvp(); }, 150); };
  return (
    <>
    <DropdownMenu onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account" data-testid="account-menu-btn"
          className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--navy)] bg-white [transition:transform_.1s] active:scale-95">
          {user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            : <UserRound className="m-auto h-5 w-5 text-[var(--navy)]" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" data-testid="account-menu">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2"><span className="truncate" data-testid="account-name">{user.name || "Skipper"}</span><TierBadge role={user.role} launchFree={user.launch_free && !user.is_admin} /></span>
          <span className="truncate text-xs font-normal text-[var(--muted)]" data-testid="account-email">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <MagicBalance open={menuOpen} /><DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openPlan} data-testid="account-plan-item"><Crown className="mr-2 h-4 w-4" />{user.premium ? "My plan" : "Upgrade to Pro"}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setSettings(true)} data-testid="account-settings-item"><Settings className="mr-2 h-4 w-4" />My settings</DropdownMenuItem>
        {user.shore_contact && <DropdownMenuItem onSelect={() => navigate("/shore")} data-testid="account-shore-map-item"><MapPinned className="mr-2 h-4 w-4" />Shore contact map</DropdownMenuItem>}
        {user.is_admin && <DropdownMenuItem onSelect={() => navigate("/admin/analytics")} data-testid="account-analytics-item"><BarChart3 className="mr-2 h-4 w-4" />Analytics dashboard</DropdownMenuItem>}
        {user.is_admin && <DropdownMenuItem onSelect={() => navigate("/admin")} data-testid="account-admin-item"><ShieldCheck className="mr-2 h-4 w-4" />Manage user tiers</DropdownMenuItem>}
        {user.is_admin && <DropdownMenuItem onSelect={() => navigate("/admin/templates")} data-testid="account-templates-item"><ListChecks className="mr-2 h-4 w-4" />Manage template lists</DropdownMenuItem>}
        {user.is_admin && <DropdownMenuItem onSelect={() => navigate("/admin/promos")} data-testid="account-promos-item"><TicketPercent className="mr-2 h-4 w-4" />Manage promo codes and coupons</DropdownMenuItem>}
        <DropdownMenuItem onSelect={signOut} data-testid="account-logout-item"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SignOutRsvpDialog ask={rsvpSend} onDone={nextRsvp} onClose={() => setRsvpSend(null)} />
    <ConfirmDelete item={termsFor ? {} : null} testId="signout-terms" title="Boat Terms and Conditions not accepted yet"
      note={`You haven't accepted ${termsFor}'s Boat Terms and Conditions yet. Please come back and do this, including the Boat Walk Through.`}
      confirmLabel="Sign out anyway" cancelLabel="Stay" onConfirm={() => { setTermsFor(""); afterTerms(); }} onClose={() => setTermsFor("")} />
    <MySettingsDialog open={settings} onClose={() => setSettings(false)} />
    <PhoneReminderDialog save={askPhone} unsynced={unsyncedCount} onLeave={() => { setAskPhone(null); leave(); }} onClose={() => setAskPhone(null)} />
    <SignOutDialog open={warnCount > 0} pending={warnCount} onConfirm={() => { setWarnCount(0); logout(); }} onClose={() => setWarnCount(0)} />
    </>
  );
};
