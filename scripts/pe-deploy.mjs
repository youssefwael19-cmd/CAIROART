// Uploads artifacts/source.zip to the ProductEcho build bucket and starts the deploy.
// The Postgres URL is read from .productecho/db.env and never printed.
import fs from 'node:fs';
import path from 'node:path';
import { callTool } from './pe-client.mjs';

const APP = 'cairo-art-ops';
const archive = path.resolve('artifacts/source.zip');

function readDatabaseUrl() {
  const file = path.resolve('.productecho/db.env');
  const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL missing from .productecho/db.env');
  return line.slice('DATABASE_URL='.length).trim();
}

const envVars = {
  NODE_ENV: 'production',
  DATA_DIR: '/data',
  PORT: '8080',
  TRUST_PROXY: '1',
  DATABASE_URL: readDatabaseUrl(),
};

const base = {
  application_name: APP,
  domain_prefix: APP,
  deployment_target: 'container',
  container_port: 8080,
  volume_path: '/data',
  env_vars: envVars,
};

const form = await callTool('deploy_application', base);
if (form.action !== 'upload_required') {
  console.log('unexpected first reply:', JSON.stringify({ ...form, env_vars: undefined }));
  process.exit(1);
}

const size = fs.statSync(archive).size;
if (size > form.max_size_bytes) throw new Error(`archive ${size} exceeds ${form.max_size_bytes}`);
console.log(`uploading ${(size / 1024).toFixed(0)} KB to ${form.s3_key}`);

const body = new FormData();
for (const [name, value] of Object.entries(form.upload_fields)) body.append(name, value);
body.append('file', new Blob([fs.readFileSync(archive)], { type: 'application/zip' }), 'source.zip');

const upload = await fetch(form.upload_url, { method: 'POST', body });
if (upload.status !== 204 && upload.status !== 200) {
  console.error('upload failed', upload.status, (await upload.text()).slice(0, 400));
  process.exit(2);
}
console.log('upload ok');

const deploy = await callTool('deploy_application', { ...base, s3_key: form.s3_key });
const shown = { ...deploy };
if (shown.env_vars) shown.env_vars = Object.keys(shown.env_vars);
console.log(JSON.stringify(shown, null, 2));
