import { createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function loadEnv() {
  const path = resolve(ROOT, 'backup/.env');
  if (existsSync(path)) process.loadEnvFile(path);
}
export function dbName(value) {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(value || '') || ['admin','local','config'].includes(value.toLowerCase())) throw Error('An explicit non-system database name is required (letters, numbers, underscore, hyphen only)');
  return value;
}
export function sourceDatabase(uri, expected) {
  // Supports SRV and replica-set host lists, without logging credentials.
  const m = /^(mongodb(?:\+srv)?):\/\/[^/]+\/([^?]*)(?:\?.*)?$/.exec(uri || '');
  if (!m) throw Error('MONGO_URI must include an explicit database path');
  let name;
  try { name = decodeURIComponent(m[2]); } catch { throw Error('Invalid database encoding'); }
  dbName(name);
  if (expected !== name) throw Error('BACKUP_DB must exactly match the database in MONGO_URI');
  return name;
}
function positive(value, fallback, name) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number <= 0) throw Error(`${name} must be positive`);
  if (name.endsWith('_DAYS') && !Number.isInteger(number)) throw Error(`${name} must be a whole number of days (at least 1)`);
  return number;
}
export function acquireLock(dir) {
  mkdirSync(dir,{recursive:true});
  const path=resolve(dir,'.backup.lock');
  let fd;
  try {fd=openSync(path,'wx',0o600);} catch {throw Error('Backup/restore lock exists; inspect active or crashed runs before removing it.');}
  try {writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}
  catch(error) {closeSync(fd);unlinkSync(path);throw error;}
  return () => {closeSync(fd);unlinkSync(path);};
}
export function settings(env = process.env) {
  const sourceDb = sourceDatabase(env.MONGO_URI, env.BACKUP_DB);
  if (env.UPLOAD_TO_CLOUD && !['true','false'].includes(env.UPLOAD_TO_CLOUD)) throw Error('UPLOAD_TO_CLOUD must be true or false');
  const cloud = env.UPLOAD_TO_CLOUD === 'true';
  const remote = env.RCLONE_REMOTE || '';
  const path = env.RCLONE_PATH || '';
  if (cloud && (!/^[A-Za-z0-9_-]+$/.test(remote) || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path))) throw Error('Cloud upload requires RCLONE_REMOTE and a dedicated RCLONE_PATH');
  return { uri:env.MONGO_URI, sourceDb, dir:resolve(ROOT,env.BACKUP_DIR || 'backup/backups'),
    retention:positive(env.BACKUP_RETENTION_DAYS,30,'BACKUP_RETENTION_DAYS'),
    maxAge:positive(env.BACKUP_MAX_AGE_HOURS,26,'BACKUP_MAX_AGE_HOURS'),
    cloudRetention:positive(env.CLOUD_RETENTION_DAYS,30,'CLOUD_RETENTION_DAYS'),
    cloud, destination:`${remote}:${path}/${sourceDb}`,
    dump:env.MONGODUMP_BIN || 'mongodump', restore:env.MONGORESTORE_BIN || 'mongorestore', rclone:env.RCLONE_BIN || 'rclone' };
}
export function run(command,args) {
  return new Promise((ok,fail) => {
    const child=spawn(command,args,{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe']});
    // Do not echo database-tool errors: they may contain connection credentials.
    child.stdout.resume(); child.stderr.resume();
    const timer=setTimeout(() => { child.kill(); fail(Error(`${basename(command)} timed out`)); }, 60*60*1000);
    child.on('error',() => {clearTimeout(timer);fail(Error(`${basename(command)} could not start; check installation and permissions`));});
    child.on('close',code => {clearTimeout(timer);code===0?ok():fail(Error(`${basename(command)} failed (exit ${code}); check tool version, network and database permissions`));});
  });
}
export async function withConfig(config, callback) {
  const { mkdtempSync, rmSync }=await import('node:fs');
  mkdirSync(config.dir,{recursive:true});
  const temp=mkdtempSync(resolve(config.dir,'.connection-'));
  const file=resolve(temp,'config.yml');
  try {
    // JSON strings are valid YAML scalars; passwords never enter command arguments.
    writeFileSync(file,`uri: ${JSON.stringify(config.uri)}\n`,{mode:0o600});
    return await callback(file);
  } finally { rmSync(temp,{recursive:true,force:true}); }
}
export async function digest(file) {
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function checkGzip(file) {
  let size=0;
  await pipeline(createReadStream(file),createGunzip(),new Writable({write(chunk,encoding,done){size+=chunk.length;done();}}));
  if (!size) throw Error('Archive is empty');
}
export async function verify(file, sourceDb, maxAge = Infinity) {
  const manifest=JSON.parse(readFileSync(`${file}.json`,'utf8'));
  const stats=statSync(file);
  if (manifest.version!==1 || manifest.sourceDb!==sourceDb || manifest.file!==basename(file) || stats.size!==manifest.size || !stats.size) throw Error('Archive metadata does not match the selected academy database/file');
  const created=Date.parse(manifest.createdAt);
  if (!Number.isFinite(created) || created>Date.now()+300000 || Date.now()-created>maxAge*3600000) throw Error('Backup is stale or has an invalid timestamp');
  if (await digest(file)!==manifest.sha256) throw Error('Archive SHA-256 verification failed');
  await checkGzip(file);
  return manifest;
}
export function archives(dir, sourceDb) {
  if (!existsSync(dir)) return [];
  const prefix=`academy-${sourceDb}-`;
  return readdirSync(dir).filter(name=>name.startsWith(prefix) && /^academy-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]+\.archive\.gz$/.test(name) && existsSync(resolve(dir,`${name}.json`))).sort().reverse();
}
export async function retain(config, newest) {
  for (const name of archives(config.dir,config.sourceDb)) {
    if(name===basename(newest)) continue;
    const file=resolve(config.dir,name);
    let manifest;
    try { manifest=await verify(file,config.sourceDb); } catch { continue; }
    if(Date.now()-Date.parse(manifest.createdAt)>config.retention*86400000) {unlinkSync(file);unlinkSync(`${file}.json`);}
  }
}
export function restoreArgs(config,file,target,execute=false) {
  dbName(target);
  if(target.toLowerCase()===config.sourceDb.toLowerCase() || !/_restore_test(?:_[A-Za-z0-9_-]+)?$/.test(target)) throw Error('Target must be a separate database ending in _restore_test or _restore_test_SUFFIX');
  return [`--archive=${file}`,'--gzip',`--nsInclude=${config.sourceDb}.*`,`--nsFrom=${config.sourceDb}.*`,`--nsTo=${target}.*`,'--stopOnError', ...(execute?[]:['--dryRun'])];
}
