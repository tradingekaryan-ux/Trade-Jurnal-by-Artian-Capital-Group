export const USER_ROLES = ["owner", "admin", "staff", "company", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  company: "Company",
  member: "Member",
};

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);

/** Only the owner can create accounts and assign roles. */
export const canManageUsers = (role: UserRole) => role === "owner";
/** Owner and admin may manage the AI model catalog. */
export const canAccessAdmin = (role: UserRole) => role === "owner" || role === "admin";
/** Staff can moderate every promo; company accounts manage only their own posts. */
export const canModeratePromos = (role: UserRole) =>
  role === "owner" || role === "admin" || role === "staff";
export const canEditPromo = (_role: UserRole, ownerId: string, userId: string) =>
  canModeratePromos(_role) || ownerId === userId;
/** Any authenticated account may publish a promo. */
export const canCreatePromo = (_role: UserRole) => true;
