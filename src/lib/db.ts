import { MongoClient, type Db } from "mongodb";

const directUri = process.env.MONGODB_URI_DIRECT;
const uri = directUri || process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var -- required for Next.js connection caching
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

const options = {
  autoSelectFamily: false,
  family: 4 as const,
  serverSelectionTimeoutMS: 10000,
};

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
