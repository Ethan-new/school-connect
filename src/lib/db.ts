import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

const options = {};

declare global {
  // eslint-disable-next-line no-var -- required for Next.js connection caching
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

if (uri) {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, options).connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri, options).connect();
  }
}

export function isDbConfigured(): boolean {
  return Boolean(uri);
}

export async function getDb(databaseName = "school-connect"): Promise<Db> {
  if (!clientPromise) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local to use MongoDB. Get a free cluster at https://www.mongodb.com/atlas"
    );
  }
  const client = await clientPromise;
  return client.db(databaseName);
}
