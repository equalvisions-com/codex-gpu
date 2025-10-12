import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// User CPU favorites table - stores which CPU instances users have favorited
export const userCpuFavorites = pgTable("user_cpu_favorites", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  cpuUuid: text("cpu_uuid").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent duplicate favorites for the same user + CPU combination
  userCpuUnique: uniqueIndex("user_cpu_unique").on(table.userId, table.cpuUuid),
  // Optimize queries for getting all CPU favorites for a user
  userIdIndex: index("user_cpu_favorites_user_id_idx").on(table.userId),
}));
