import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;

let clientPromise = null;
let connectionFailed = false;

function getClientPromise() {
  if (connectionFailed) return null;
  if (clientPromise) return clientPromise;

  if (!MONGODB_URI || MONGODB_URI.includes('username:password') || MONGODB_URI.includes('your_')) {
    console.warn('⚠ MongoDB: No valid MONGODB_URI configured. DB features disabled.');
    connectionFailed = true;
    return null;
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    clientPromise = client.connect().catch((err) => {
      console.error('⚠ MongoDB connection failed:', err.message);
      connectionFailed = true;
      clientPromise = null;
      return null;
    });
    return clientPromise;
  } catch (err) {
    console.error('⚠ MongoDB client creation failed:', err.message);
    connectionFailed = true;
    return null;
  }
}

export default function getClientPromiseExport() {
  return getClientPromise();
}

export async function getDb() {
  const promise = getClientPromise();
  if (!promise) return null;
  const client = await promise;
  if (!client) return null;
  return client.db();
}

export function isDbAvailable() {
  return !connectionFailed && !!MONGODB_URI && !MONGODB_URI.includes('username:password');
}
