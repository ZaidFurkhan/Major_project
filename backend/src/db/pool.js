import pg from 'pg';

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString || typeof connectionString !== 'string' || connectionString.trim() === '') {
    throw new Error('DATABASE_URL is not set');
  }

  return new Pool({ connectionString });
}
