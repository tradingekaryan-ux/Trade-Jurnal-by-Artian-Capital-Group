import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { closeTenantDb, dataDir } from "@/db";
import { sql } from "./pg";
import { forgetRestored } from "./snapshot";

/**
 * Explicit cascading deletion. Supabase also has ON DELETE CASCADE foreign
 * keys, but doing the deletes here (in order, in one transaction) means every
 * endpoint can report exactly what was removed — and no orphan rows survive.
 */
export interface DeletionCounts {
  [table: string]: number;
}

// postgres.js exposes the affected row count as a property on the result array.
const count = (result: { count?: number | string }[]): number =>
  Number((result as { count?: number | string }).count ?? result[0]?.count ?? 0);

const value = (row: Record<string, unknown> | undefined, key: string): number =>
  Number(row?.[key] ?? 0);

/** Delete one journal mode with every image reference attached to its trades. */
export async function deleteJournalCascade(userId: string, mode: string): Promise<DeletionCounts> {
  return sql.begin(async (tx) => {
    const ids = await tx`select id from cfd_trades where owner_id = ${userId} and mode = ${mode}`;
    const tradeIds = ids.map((row) => String(row.id));
    let images = 0;
    if (tradeIds.length) {
      const removed = await tx`delete from image_attachments
        where owner_id = ${userId} and owner_type = 'cfd-trade' and owner_ref = any(${tradeIds}::text[])`;
      images = count(removed);
    }
    const removedTrades = await tx`delete from cfd_trades
      where owner_id = ${userId} and mode = ${mode}`;
    return { trades: count(removedTrades), images };
  });
}

/** Delete a single trade together with its image references. */
export async function deleteTradeCascade(userId: string, id: string): Promise<DeletionCounts> {
  return sql.begin(async (tx) => {
    const images = await tx`delete from image_attachments
      where owner_id = ${userId} and owner_type = 'cfd-trade' and owner_ref = ${id}`;
    const trades = await tx`delete from cfd_trades where id = ${id} and owner_id = ${userId}`;
    return { trades: count(trades), images: count(images) };
  });
}

/** Delete a promo/trade idea with all votes cast on it. */
export async function deletePostCascade(id: string): Promise<DeletionCounts> {
  const votes = count(await sql`delete from promo_votes where promo_id = ${id}`);
  const posts = count(await sql`delete from promos where id = ${id}`);
  return { votes, posts };
}

/**
 * Delete an account and absolutely everything attached to it:
 * trades, images, posts, votes (both received and cast), profile, sessions,
 * quota, login throttles, the Supabase journal snapshot and the local DB file.
 */
export async function deleteUserCascade(userId: string): Promise<DeletionCounts> {
  const rows = await sql`select username from users where id = ${userId} limit 1`;
  if (rows.length === 0) return {};

  const username = String(rows[0]!.username);
  const [stats] = await sql`
    select
      (select count(*) from cfd_trades where owner_id = ${userId})::int as trades,
      (select count(*) from image_attachments where owner_id = ${userId})::int as images,
      (select count(*) from promos where user_id = ${userId})::int as posts,
      (select count(*) from promo_votes
        where promo_id in (select id from promos where user_id = ${userId}))::int as received_votes,
      (select count(*) from promo_votes where user_id = ${userId})::int as cast_votes,
      (select count(*) from sessions where user_id = ${userId})::int as sessions,
      (select count(*) from ai_usage where user_id = ${userId})::int as ai_usage,
      (select count(*) from profiles where user_id = ${userId})::int as profiles,
      (select count(*) from journal_snapshots where user_id = ${userId})::int as snapshots
  `;

  await sql.begin(async (tx) => {
    // Votes the account received on its own posts and votes it cast on others.
    await tx`delete from promo_votes
      where user_id = ${userId}
         or promo_id in (select id from promos where user_id = ${userId})`;
    await tx`delete from promos where user_id = ${userId}`;
    await tx`delete from image_attachments where owner_id = ${userId}`;
    await tx`delete from cfd_trades where owner_id = ${userId}`;
    await tx`delete from journal_snapshots where user_id = ${userId}`;
    await tx`delete from profiles where user_id = ${userId}`;
    await tx`delete from sessions where user_id = ${userId}`;
    await tx`delete from ai_usage where user_id = ${userId}`;
    await tx`delete from login_attempts where key like ${`login:%:${username}`}`;
    await tx`delete from users where id = ${userId}`;
  });

  // The local SQLite cache is per-user in production; remove its files so no
  // notebook/playbook/legacy-journal rows are left behind on the server.
  closeTenantDb(userId);
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = join(dataDir(), "users", `${userId}.db${suffix}`);
    if (existsSync(file)) unlinkSync(file);
  }
  forgetRestored(userId);

  return {
    trades: value(stats, "trades"),
    images: value(stats, "images"),
    posts: value(stats, "posts"),
    receivedVotes: value(stats, "received_votes"),
    castVotes: value(stats, "cast_votes"),
    sessions: value(stats, "sessions"),
    aiUsage: value(stats, "ai_usage"),
    profiles: value(stats, "profiles"),
    snapshots: value(stats, "snapshots"),
  };
}
