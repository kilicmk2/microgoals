import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { goals } from "./schema";
import { getSeedGoals } from "../seed-goals";
import { count } from "drizzle-orm";

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Add it to .env.local");
    process.exit(1);
  }

  const sql = neon(url);
  const db = drizzle(sql);

  // Check if goals already exist
  const [existing] = await db.select({ count: count() }).from(goals);
  if (existing.count > 0) {
    console.log(`Database already has ${existing.count} goals. Skipping seed.`);
    return;
  }

  const seedGoals = getSeedGoals();
  console.log(`Seeding ${seedGoals.length} company goals...`);

  for (const goal of seedGoals) {
    await db.insert(goals).values({
      userId: null, // company goals
      title: goal.title,
      description: goal.description,
      status: goal.status,
      horizon: goal.horizon,
      category: goal.category,
      owner: goal.owner,
      parentId: null,
      reasoning: goal.reasoning,
      pinned: goal.pinned,
      order: goal.order,
    });
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
