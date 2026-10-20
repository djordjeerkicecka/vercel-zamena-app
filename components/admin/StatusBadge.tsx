import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/constants";
import type { TicketStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
