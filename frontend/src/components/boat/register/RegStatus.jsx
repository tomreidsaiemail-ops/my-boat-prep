import { CheckCircle2, Clock, Circle } from "lucide-react";
import { STATUS } from "@/lib/crewRegister";

const ICONS = { registered: CheckCircle2, pending: Clock, unregistered: Circle };

export const RegStatus = ({ status = "unregistered", testId }) => {
  const s = STATUS[status] || STATUS.unregistered;
  const Icon = ICONS[status] || Circle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${s.cls}`} data-testid={testId} data-status={status}>
      <Icon className={`h-3.5 w-3.5 ${status === "registered" ? "text-[var(--green)]" : ""}`} /> {s.label}
    </span>
  );
};
