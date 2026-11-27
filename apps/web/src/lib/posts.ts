export type PostKind = "promo" | "idea";

/** Shared shape returned by the posts API for both promos and trade ideas. */
export interface Post {
  id: string;
  userId: string;
  author: string;
  /** Role of the author, used for the owner/admin verification badge. */
  authorRole?: string;
  kind: PostKind;
  title: string;
  description: string;
  imageUrl: string | null;
  imageName: string | null;
  hasImage: boolean;
  promoCode?: string | null;
  codeEnabled?: boolean;
  url?: string | null;
  urlEnabled?: boolean;
  createdAt: string;
}
