// src/db/mongo.ts
import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI ?? '';
if (!uri) {
  throw new Error('MONGODB_URI env variable not set');
}

let client: MongoClient;
let db: Db;

export const connectMongo = async (): Promise<void> => {
  if (client && db) return; // already connected
  client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true } as any);
  await client.connect();
  db = client.db();
  console.log('✅ Connected to MongoDB');
};

export const getDb = (): Db => {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongo() first.');
  }
  return db;
};

export const getUserCollection = (): Collection => {
  return getDb().collection('users');
};

// Graceful shutdown helper
export const closeMongo = async (): Promise<void> => {
  if (client) await client.close();
};
