/**
 * Roles: owner (site configuration), admin (all data + account deletion),
 * member (ordinary account). Owner is provisioned once and cannot be created
 * or removed through the admin UI.
 */
export const USER_ROLES = ["owner", "admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);

/** Owner and admin are privileged; member has no staff powers. */
export const isPrivileged = (role: UserRole) => role === "owner" || role === "admin";

/** Only the owner may create accounts and assign roles. */
export const canManageUsers = (role: UserRole) => role === "owner";
/** Only the owner may change site-wide configuration (Discord link, etc.). */
export const canManageSite = (role: UserRole) => role === "owner";
/** Owner and admin may access the admin page and the AI model catalog. */
export const canAccessAdmin = (role: UserRole) => isPrivileged(role);
/** Owner and admin can read every journal and every member's data. */
export const canReadAllData = (role: UserRole) => isPrivileged(role);
/** Owner and admin may delete member accounts (the owner can never be deleted). */
export const canDeleteAccounts = (role: UserRole) => isPrivileged(role);
/** Owner and admin moderate all posts; members moderate only their own. */
export const canModeratePromos = (role: UserRole) => isPrivileged(role);
export const canEditPromo = (role: UserRole, ownerId: string, userId: string) =>
  canModeratePromos(role) || ownerId === userId;
/** Any authenticated account may publish a promo or trade idea. */
export const canCreatePromo = (_role: UserRole) => true;
