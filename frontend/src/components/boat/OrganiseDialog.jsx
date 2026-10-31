import { User, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isUserList } from "@/lib/listCategories";

const ShowBox = ({ checked, mixed, onChange, disabled, label, testId }) => (
  <input type="checkbox" checked={checked} disabled={disabled} aria-label={label} title={label} data-testid={testId}
    ref={(el) => { if (el) el.indeterminate = !!mixed; }} onChange={(e) => onChange(e.target.checked)}
    className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--navy)] disabled:cursor-not-allowed" />
);

const Bubble = ({ row, hidden, readOnly, onPick, onShow }) => (
  <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border-2 py-1 pl-2 pr-1 [transition:background-color_.15s,transform_.1s] ${hidden ? "border-dashed" : "shadow-sm"}`}
    style={hidden ? { backgroundColor: "#FFFFFF", color: "#4B5563", borderColor: row.colours.bg === "#FFFFFF" ? "#9CA3AF" : row.colours.bg }
      : { backgroundColor: row.colours.bg, color: row.colours.fg, borderColor: row.colours.bg === "#FFFFFF" ? "var(--line)" : row.colours.bg }}
    data-hidden={hidden ? "true" : "false"} data-testid={`organise-bubble-${row.list.id}`}>
    <ShowBox checked={!hidden} disabled={readOnly} onChange={(v) => onShow([row.list.id], v)} label={`Show ${row.list.name} in the list menu`} testId={`organise-show-${row.list.id}`} />
    <button type="button" onClick={() => onPick(row.list.id)} data-testid={`organise-pick-${row.list.id}`}
      className={`flex min-h-9 min-w-0 items-center gap-1.5 rounded-full px-2 text-left text-sm font-bold hover:bg-black/10 active:scale-95 ${hidden ? "italic" : ""}`}>
      {row.user && <User className="h-4 w-4 shrink-0" aria-label="Your list" />}
      <span className="break-words">{row.list.name}</span>
    </button>
  </span>
);

const Group = ({ id, name, colours, rows, hidden, readOnly, onPick, onShow }) => {
  const shown = rows.filter((r) => !hidden.includes(r.list.id)).length;
  return (
    <section className="flex flex-col gap-2" data-testid={`organise-group-${id}`}>
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: colours.bg }} aria-hidden="true" />
        <h3 className="min-w-0 flex-1 font-display text-base font-bold text-[var(--navy)]">{name}</h3>
        <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]">
          Show all
          <ShowBox checked={shown === rows.length} mixed={shown > 0 && shown < rows.length} disabled={readOnly} label={`Show every list in ${name}`}
            onChange={(v) => onShow(rows.map((r) => r.list.id), v)} testId={`organise-group-show-${id}`} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => <Bubble key={r.list.id} row={r} hidden={hidden.includes(r.list.id)} readOnly={readOnly} onPick={onPick} onShow={onShow} />)}
      </div>
    </section>
  );
};

const LinkRow = ({ list, current, cats, onLink, readOnly }) => (
  <label className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]" data-testid={`organise-link-row-${list.id}`}>
    <User className="h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1 break-words">{list.name}</span>
    <select value={current} disabled={readOnly} onChange={(e) => onLink(list.id, e.target.value)}
      className="h-10 max-w-[48%] rounded-md border-2 border-[var(--navy)] bg-white px-2 text-sm font-bold" data-testid={`organise-link-${list.id}`} aria-label={`Category for ${list.name}`}>
      <option value="">No category</option>
      {cats.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
    </select>
  </label>
);

export const OrganiseDialog = ({ open, onClose, org, cats, lists, hidden, readOnly, admin, onPick, onShow, onLink }) => {
  const groupProps = { hidden, readOnly, onPick, onShow };
  const mineAll = lists.filter(isUserList);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-lg" data-testid="organise-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-[var(--navy)]"><Wand2 className="h-5 w-5" />Magical Organisation</DialogTitle>
          <DialogDescription>Tap a list to open it. Untick a box to hide that list, or a whole category, from the list menu.</DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-5">
          {org.groups.filter((g) => g.rows.length).map((g, i) => <Group key={g.name} id={i} name={g.name} colours={g.colours} rows={g.rows} {...groupProps} />)}
          {org.loose.length > 0 && <Group id="loose" name="Not categorised" colours={org.loose[0].colours} rows={org.loose} {...groupProps} />}
          {org.mine.length > 0 && <Group id="mine" name="Your lists" colours={org.mine[0].colours} rows={org.mine} {...groupProps} />}
          {admin && org.loose.length > 0 && <p className="text-xs text-[var(--muted)]" data-testid="organise-admin-hint">Admin: add these list names to the private template list "Admin - List Categories" to give them a colour.</p>}
          {mineAll.length > 0 && cats.length > 0 && (
            <section className="flex flex-col gap-2 rounded-lg border-[1.5px] border-[var(--line)] p-3" data-testid="organise-link-section">
              <h3 className="font-display text-base font-bold text-[var(--navy)]">Link your lists to a category</h3>
              {mineAll.map((l) => <LinkRow key={l.id} list={l} current={org.byId[l.id]?.cat >= 0 ? cats[org.byId[l.id].cat].name : ""} cats={cats} onLink={onLink} readOnly={readOnly} />)}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
