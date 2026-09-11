import { mkdirSync, openSync, closeSync, unlinkSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { loadEnv, settings, run, withConfig, digest, checkGzip, verify, retain } from './common.mjs';
loadEnv();
let config, lock, partial;
try {
  config=settings(); mkdirSync(config.dir,{recursive:true});
  const lockPath=resolve(config.dir,'.backup.lock');
  try {lock=openSync(lockPath,'wx',0o600);} catch {throw Error('Backup lock exists; another run is active, or a previous run crashed. Inspect before removing the lock.');}
  writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  const createdAt=new Date().toISOString();
  const name=`academy-${config.sourceDb}-${createdAt.replace(/[:.]/g,'-')}-${randomBytes(4).toString('hex')}.archive.gz`;
  const file=resolve(config.dir,name); partial=`${file}.partial`;
  console.log(`[backup] reading only ${config.sourceDb}`);
  await withConfig(config,path=>run(config.dump,[`--config=${path}`,`--db=${config.sourceDb}`,`--archive=${partial}`,'--gzip']));
  await checkGzip(partial);
  const manifest={version:1,file:name,sourceDb:config.sourceDb,createdAt,size:statSync(partial).size,sha256:await digest(partial)};
  renameSync(partial,file); partial=null;
  writeFileSync(`${file}.json`,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  await verify(file,config.sourceDb,config.maxAge);
  if(config.cloud) {
    // copyto never synchronizes/deletes unrelated files. Verify downloaded bytes before pruning.
    for(const nameToCopy of [name,`${name}.json`]) {
      const local=resolve(config.dir,nameToCopy);
      await run(config.rclone,['copyto',local,`${config.destination}/${nameToCopy}`]);
    }
    await run(config.rclone,['check',config.dir,config.destination,'--one-way','--download','--include',name,'--include',`${name}.json`]);
    await run(config.rclone,['delete',config.destination,'--min-age',`${config.cloudRetention}d`,'--include',`academy-${config.sourceDb}-????-??-??T*Z-*.archive.gz`,'--include',`academy-${config.sourceDb}-????-??-??T*Z-*.archive.gz.json`]);
  }
  await retain(config,file);
  writeFileSync(resolve(config.dir,'last-backup-status.json'),JSON.stringify({success:true,createdAt,file:name,cloudUploaded:config.cloud},null,2));
  console.log(`[backup] SUCCESS ${name}; checksum and gzip verified${config.cloud ? '; cloud verified' : ''}`);
} catch(error) {
  console.error(`[backup] ${error.message}`);
  if(config && lock!==undefined) writeFileSync(resolve(config.dir,'last-backup-status.json'),JSON.stringify({success:false,at:new Date().toISOString(),error:error.message}));
  process.exitCode=1;
} finally {
  if(partial) {try{unlinkSync(partial);}catch{}}
  if(lock!==undefined) {closeSync(lock);unlinkSync(resolve(config.dir,'.backup.lock'));}
}
