import mongoose from 'mongoose';
import { seedDatabase } from '@/lib/seed';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/officecli_saas';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
      console.log('Connected to MongoDB');
      await seedDatabase();
      const tasks = mongoose.connection.collection('tasks');
      const taskCollectionExists = await mongoose.connection.db
        .listCollections({ name: 'tasks' }, { nameOnly: true })
        .hasNext();
      if (taskCollectionExists) {
        await tasks.updateMany({ expiresAt: { $exists: true } }, { $unset: { expiresAt: '' } });
        try {
          await tasks.dropIndex('expiresAt_1');
        } catch (error) {
          if (error.codeName !== 'IndexNotFound' && error.code !== 27) throw error;
        }
      }
      return mongoose;
    });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
