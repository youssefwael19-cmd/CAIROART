// Writes the ProductEcho Postgres connection string into .productecho/db.env
// without printing the password, then checks that it accepts a query.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { callTool } from './pe-client.mjs';

const identifier = process.argv[2] || 'cairoa';
const status = await callTool('get_postgres_status', { db_identifier: identifier });
const creds = await callTool('get_postgres_credentials', { db_identifier: identifier });

const user = creds.db_user || status.db_user || 'postgres';
const password = creds.password || creds.db_password || creds.secret?.password;
const host = creds.host || creds.endpoint || status.endpoint;
const port = creds.port || status.port || 5432;
const database = creds.db_name || status.db_name || 'postgres';

if (!password) {
  console.error('No password in the credentials reply; keys were:', Object.keys(creds).join(', '));
  process.exit(1);
}

const url = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=require`;
const dir = path.resolve('.productecho');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'db.env'), `DATABASE_URL=${url}\n`, { mode: 0o600 });

console.log(`saved .productecho/db.env for ${user}@${host}:${port}/${database} (password hidden, ${password.length} chars)`);

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  const { rows } = await client.query('select version() as version, current_database() as db');
  console.log('connected:', rows[0].db, '-', String(rows[0].version).split(',')[0]);
} catch (error) {
  console.error('connection failed:', error.message);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
