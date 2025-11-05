import { db } from "./src/db/client";
import { aiModels } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({ id: aiModels.id, shortName: aiModels.shortName, name: aiModels.name, provider: aiModels.provider })
    .from(aiModels)
    .orderBy(sql`lower(${aiModels.shortName})`)
    .limit(50);
  for (const row of rows) {
    console.log(`${row.shortName} | ${row.name} | ${row.provider}`);
  }
  await db.$client.end?.();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
