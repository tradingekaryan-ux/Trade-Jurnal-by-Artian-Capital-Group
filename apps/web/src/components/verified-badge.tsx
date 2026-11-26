import { BadgeCheck } from "lucide-react";
import { isUserRole, type UserRole } from "@/lib/roles";

/**
 * Verification check shown next to privileged accounts.
 * Owner = yellow check, Admin = blue check, everyone else = nothing.
 */
export function VerifiedBadge({
  role,
  className = "",
}: {
  role: string | null | undefined;
  className?: string;
}) {
  if (!isUserRole(role) || (role !== "owner" && role !== "admin")) return null;
  const color =
    role === "owner" ? "text-amber-400 fill-amber-400/20" : "text-sky-500 fill-sky-500/20";
  const label = role === "owner" ? "Owner terverifikasi" : "Admin terverifikasi";
  return (
    <span title={label} className="inline-flex shrink-0">
      <BadgeCheck
        aria-label={label}
        className={`inline-block h-4 w-4 shrink-0 ${color} ${className}`}
      />
    </span>
  );
}

/** Role name rendered with the matching verified color. */
export function RoleName({ role }: { role: string }) {
  const safe: UserRole = isUserRole(role) ? role : "member";
  const color = safe === "owner" ? "text-amber-400" : safe === "admin" ? "text-sky-500" : "";
  const label = safe === "owner" ? "Owner" : safe === "admin" ? "Admin" : "Member";
  return <span className={color}>{label}</span>;
}
