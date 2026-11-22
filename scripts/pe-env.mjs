// Pushes environment variables to the live ProductEcho application.
// Values are read from .productecho/env.local (gitignored) so they never have to
// be pasted into chat. Names are printed, values never are.
//
//   node scripts/pe-env.mjs --dry-run          show what would change + checks
//   node scripts/pe-env.mjs                    validate, then push and restart
//   node scripts/pe-env.mjs --force            push even if a check fails
import fs from 'node:fs';
import path from 'node:path';
import { callTool } from './pe-client.mjs';

const APP = 'cairo-art-ops';
const FILE = path.resolve(process.env.PE_ENV_FILE || '.productecho/env.local');
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const WHATSAPP = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'];

function parseEnvFile(file) {
  const out = {};
  out.__remove = [];
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    if (!value) continue;
    /* A single dash means "delete this variable from the app". */
    if (value === '-') {
      out.__remove.push(match[1]);
      continue;
    }
    out[match[1]] = value;
  }
  return out;
}

/* Format checks: catch a half-copied value before it takes the app down. */
function validate(env) {
  const errors = [];
  const warnings = [];
  const has = (k) => typeof env[k] === 'string' && env[k].length > 0;

  if (has('INITIAL_MANAGER_PASSWORD') && env.INITIAL_MANAGER_PASSWORD.length < 10) {
    errors.push('INITIAL_MANAGER_PASSWORD must be at least 10 characters.');
  }
  if (has('SHARE_SECRET') && !/^[0-9a-fA-F]{64}$/.test(env.SHARE_SECRET)) {
    errors.push('SHARE_SECRET must be 64 hex characters (openssl rand -hex 32).');
  }

  const waSet = WHATSAPP.filter(has);
  if (waSet.length > 0 && waSet.length < WHATSAPP.length) {
    const missing = WHATSAPP.filter((k) => !has(k));
    errors.push(`WhatsApp needs all four variables; missing: ${missing.join(', ')}.`);
  }
  if (has('WHATSAPP_TOKEN') && (/\s/.test(env.WHATSAPP_TOKEN) || env.WHATSAPP_TOKEN.length < 60)) {
    warnings.push('WHATSAPP_TOKEN looks short or contains spaces — copy the whole access token.');
  }
  if (has('WHATSAPP_PHONE_NUMBER_ID') && !/^\d{5,25}$/.test(env.WHATSAPP_PHONE_NUMBER_ID)) {
    warnings.push('WHATSAPP_PHONE_NUMBER_ID should be digits only (not the phone number itself).');
  }
  if (has('WHATSAPP_APP_SECRET') && !/^[0-9a-fA-F]{32}$/.test(env.WHATSAPP_APP_SECRET)) {
    warnings.push('WHATSAPP_APP_SECRET should be 32 hex characters.');
  }
  if (has('WHATSAPP_VERIFY_TOKEN') && (/\s/.test(env.WHATSAPP_VERIFY_TOKEN) || env.WHATSAPP_VERIFY_TOKEN.length < 6)) {
    warnings.push('WHATSAPP_VERIFY_TOKEN should be at least 6 characters with no spaces.');
  }

  if (has('AI_BASE_URL') && !/^https?:\/\//.test(env.AI_BASE_URL)) {
    errors.push('AI_BASE_URL must start with https://');
  }
  if (has('OPENAI_API_KEY') && env.OPENAI_API_KEY.startsWith('AIza') && !env.AI_BASE_URL?.includes('generativelanguage')) {
    errors.push('Google keys (AIza…) need AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/');
  }
  if (has('OPENAI_API_KEY') && env.OPENAI_API_KEY.startsWith('gsk_') && !env.AI_BASE_URL?.includes('api.groq.com')) {
    errors.push('Groq keys (gsk_…) need AI_BASE_URL=https://api.groq.com/openai/v1');
  }
  if (has('OPENAI_API_KEY') && !has('AI_BASE_URL')) {
    warnings.push('No AI_BASE_URL: the key will be sent to Freebuff\'s paid API. Set AI_BASE_URL to stay on a free tier.');
  }
  if (has('AI_BASE_URL') && !has('OPENAI_API_KEY')) {
    warnings.push('AI_BASE_URL is set but OPENAI_API_KEY is empty, so AI stays on the free rules engine.');
  }

  if (has('DEMO_ACCOUNTS')) errors.push('DEMO_ACCOUNTS must never be set on the live app.');
  if (has('SEED_DEMO')) warnings.push('SEED_DEMO is set: sample catalog/orders would be copied into the live database.');

  return { errors, warnings };
}

const wanted = parseEnvFile(FILE);
const remove = wanted.__remove ?? [];
delete wanted.__remove;
const names = Object.keys(wanted);
if (names.length === 0 && remove.length === 0) {
  console.error(`No values found in ${path.relative(process.cwd(), FILE)}. Fill it in first.`);
  process.exit(1);
}

const { errors, warnings } = validate(wanted);
console.log(`Checked ${names.length} value(s) from ${path.relative(process.cwd(), FILE)}:`);
for (const name of names) console.log(`  ok  ${name}`);
for (const warning of warnings) console.log(`  warn  ${warning}`);
for (const error of errors) console.log(`  fail  ${error}`);

if (errors.length > 0 && !FORCE) {
  console.error('Fix the failed checks, or re-run with --force to push anyway.');
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`Would set ${names.length} variable(s): ${names.join(', ') || 'none'}`);
  if (remove.length) console.log(`Would remove: ${remove.join(', ')}`);
  process.exit(0);
}

const current = await callTool('get_application_env', { application_name: APP });
const merged = { ...(current.env_vars ?? {}), ...wanted };
for (const name of remove) delete merged[name];

const result = await callTool('update_application_env', {
  application_name: APP,
  env_vars: merged,
  redeploy: true,
});

console.log(`Set ${names.length} variable(s): ${names.join(', ') || 'none'}`);
if (remove.length) console.log(`Removed: ${remove.join(', ')}`);
console.log(`Deployment: ${result.deployment_id ?? result.status ?? 'started'}`);
if (names.includes('INITIAL_MANAGER_PASSWORD')) {
  console.log('Remember: delete INITIAL_MANAGER_PASSWORD after the first sign-in.');
}
