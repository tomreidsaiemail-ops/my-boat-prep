import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RolePicker } from "@/components/boat/RolePicker";

export const EditRolesDialog = ({ member, options, onSave, onClose }) => {
  const [roles, setRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (member) setRoles(member.roles || []); }, [member]);
  const save = async () => { setBusy(true); if (await onSave(roles)) onClose(); setBusy(false); };
  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-lg border-2 border-[var(--navy)]" data-testid="edit-roles-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Roles for {member?.name || member?.email}</DialogTitle>
          <DialogDescription className="text-left text-sm">Tap to add or remove a role, or type a new one.</DialogDescription>
        </DialogHeader>
        <RolePicker options={options} selected={roles} onChange={setRoles} />
        <div className="flex gap-2">
          <button type="button" className="btn-ghost h-11 flex-1 justify-center" onClick={onClose} data-testid="edit-roles-cancel-btn">Cancel</button>
          <button type="button" className="btn-solid h-11 flex-1 justify-center gap-2" disabled={busy} onClick={save} data-testid="edit-roles-save-btn">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save roles
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
