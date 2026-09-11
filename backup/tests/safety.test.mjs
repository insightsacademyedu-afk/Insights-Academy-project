import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sourceDatabase, settings, restoreArgs, digest, verify, archives, retain, checkGzip, withConfig, acquireLock } from '../common.mjs';
const env={MONGO_URI:'mongodb://localhost:27017/test',BACKUP_DB:'test'};
test('explicit academy database required; cluster-wide, mismatched, system and wildcard databases rejected',()=>{
  assert.equal(sourceDatabase(env.MONGO_URI,'test'),'test');
  assert.equal(sourceDatabase('mongodb://host1:27017,host2:27017/test?replicaSet=rs','test'),'test');
  for(const [uri,db] of [['mongodb://host/','test'],['mongodb://host/test','academy'],['mongodb://host/admin','admin'],['mongodb://host/%2A','*'],['mongodb://host/test',undefined]]) assert.throws(()=>sourceDatabase(uri,db));
});
test('restore maps only academy namespace, previews by default and never drops collections',()=>{
  const c=settings(env), args=restoreArgs(c,'example.archive.gz','academy_restore_test');
  assert.ok(args.includes('--nsInclude=test.*'));
  assert.ok(args.includes('--nsFrom=test.*'));
  assert.ok(args.includes('--nsTo=academy_restore_test.*'));
  assert.ok(args.includes('--dryRun'));
  assert.ok(!args.includes('--drop'));
  assert.ok(!restoreArgs(c,'a','academy_restore_test_2026',true).includes('--dryRun'));
});
test('restore rejects source database, arbitrary production names and system databases',()=>{
  const c=settings(env);
  for(const target of ['test','TEST','production','admin','config','local','test.*','../academy_restore_test']) assert.throws(()=>restoreArgs(c,'a',target,true));
  assert.throws(()=>restoreArgs({...c,sourceDb:'academy_restore_test'},'a','ACADEMY_restore_test',true));
});
test('invalid retention or cloud configuration fails closed',()=>{
  for(const key of ['BACKUP_RETENTION_DAYS','CLOUD_RETENTION_DAYS']) assert.throws(()=>settings({...env,[key]:'0.001'}));
  for(const options of [{BACKUP_RETENTION_DAYS:'0'},{BACKUP_MAX_AGE_HOURS:'oops'},{CLOUD_RETENTION_DAYS:'-1'},{UPLOAD_TO_CLOUD:'yes'},{UPLOAD_TO_CLOUD:'true',RCLONE_REMOTE:'drive',RCLONE_PATH:''},{UPLOAD_TO_CLOUD:'true',RCLONE_REMOTE:'drive',RCLONE_PATH:'../other'}]) assert.throws(()=>settings({...env,...options}));
});
test('backup and restore share an exclusive lock and release allows the next run',()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'academy-lock-'));
  try {
    const release=acquireLock(dir);
    assert.throws(()=>acquireLock(dir),/lock exists/);
    release();
    acquireLock(dir)();
    assert.equal(existsSync(resolve(dir,'.backup.lock')),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
async function fixture(dir,{age=0,sourceDb='test',suffix='abc123'}={}) {
  const createdAt=new Date(Date.now()-age*86400000).toISOString();
  const name=`academy-${sourceDb}-${createdAt.replace(/[:.]/g,'-')}-${suffix}.archive.gz`;
  const file=resolve(dir,name), bytes=gzipSync('fixture archive content (not a MongoDB archive)');
  writeFileSync(file,bytes);
  const manifest={version:1,file:name,sourceDb,createdAt,size:bytes.length,sha256:await digest(file)};
  writeFileSync(`${file}.json`,JSON.stringify(manifest));
  return {file,name,manifest};
}
test('verification checks source, hash, full gzip, metadata, age and timestamp',async()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'academy-verify-'));
  try {
    const {file,manifest}=await fixture(dir);
    assert.equal((await verify(file,'test',26)).sha256,manifest.sha256);
    await assert.rejects(verify(file,'other'));
    for(const update of [{sha256:'bad'},{size:0},{createdAt:'invalid'},{createdAt:new Date(Date.now()+86400000).toISOString()},{createdAt:'2000-01-01'}]) {
      writeFileSync(`${file}.json`,JSON.stringify({...manifest,...update}));
      await assert.rejects(verify(file,'test',26));
    }
    writeFileSync(file,Buffer.from('broken')); await assert.rejects(checkGzip(file));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('retention keeps newest, unrelated databases, unmanaged files and corrupt backups',async()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'academy-retention-'));
  try {
    const old=await fixture(dir,{age:40});
    const newest=await fixture(dir);
    const other=await fixture(dir,{sourceDb:'other',age:40});
    const corrupt=await fixture(dir,{age:45,suffix:'bad123'});writeFileSync(corrupt.file,'broken');
    writeFileSync(resolve(dir,'personal.archive.gz'),'personal');
    assert.equal(archives(dir,'test').length,3);
    await retain({...settings(env),dir},newest.file);
    assert.equal(existsSync(old.file),false);
    for(const file of [newest.file,other.file,corrupt.file,resolve(dir,'personal.archive.gz')]) assert.ok(existsSync(file));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('temporary connection configuration is removed on tool failure',async()=>{
  const dir=mkdtempSync(resolve(tmpdir(),'academy-config-'));let configFile;
  try {
    await assert.rejects(withConfig({...settings(env),dir},path=>{configFile=path;assert.ok(existsSync(path));throw Error('tool failed');}));
    assert.equal(existsSync(configFile),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
