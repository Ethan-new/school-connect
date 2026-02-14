/**
 * Test MongoDB connection. Run with: npx tsx scripts/test-db-connection.ts
 * Requires .env.local with MONGODB_URI
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI_DIRECT || process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set in .env.local");
  process.exit(1);
}

const options = {
  autoSelectFamily: false,
  family: 4 as const,
  serverSelectionTimeoutMS: 10000,
};

async function test() {
  const client = new MongoClient(uri!, options);
  try {
    await client.connect();
    const db = client.db("school-connect");
    await db.command({ ping: 1 });
    console.log("✓ Successfully connected to MongoDB");
  } catch (err) {
    console.error("✗ Connection failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

test();
