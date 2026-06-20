import Badge from "react-bootstrap/Badge";
import { statusVariant } from "./format";

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  return (
    <Badge bg={statusVariant(status)} className="text-uppercase" style={{ letterSpacing: "0.03em" }}>
      {label}
    </Badge>
  );
}
