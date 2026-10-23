import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull(),
  snapshot: text('snapshot').notNull(),
});
// Bounded chunks preserve existing workspaces with uploaded profile portraits.
export const workspaceChunks = sqliteTable('workspace_chunks', {
  userId: text('user_id').notNull(),
  snapshot: text('snapshot').notNull(),
  part: integer('part').notNull(),
  payload: text('payload').notNull(),
}, table => [primaryKey({columns: [table.userId, table.snapshot, table.part]})]);
