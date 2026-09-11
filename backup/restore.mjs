import { resolve } from 'node:path';
import { loadEnv, settings, ROOT, archives, verify, restoreArgs, withConfig, run, acquireLock } from './common.mjs';
loadEnv();
let release;
try {
  const args=process.argv.slice(2);
  if(args.includes('--list')) {
    const dir=resolve(ROOT,process.env.BACKUP_DIR || 'backup/backups');
    console.log(archives(dir,process.env.BACKUP_DB || 'test').join('\n') || 'No verified-format backups found.');
  } else {
    const allowed=new Set(['--file','--target-db','--execute']);
    const values={};
    for(let i=0;i<args.length;i++) {
      if(!allowed.has(args[i]) || values[args[i]]) throw Error('Unknown or duplicate restore option');
      const key=args[i]; values[key]=key==='--execute'?true:args[++i];
      if(!values[key] || String(values[key]).startsWith('--')) throw Error(`Missing value for ${key}`);
    }
    if(!values['--file'] || !values['--target-db']) throw Error('Usage (from project root): node backup/restore.mjs --file backup/backups/FILE.archive.gz --target-db academy_restore_test [--execute]');
    const config=settings();
    // File is consistently resolved from project root regardless of working directory.
    const file=resolve(ROOT,values['--file']);
    const toolArgs=restoreArgs(config,file,values['--target-db'],values['--execute']);
    release=acquireLock(config.dir);
    await verify(file,config.sourceDb);
    console.log(`[restore] ${values['--execute'] ? 'EXECUTING' : 'PREVIEW'} ${config.sourceDb}.* -> ${values['--target-db']}.*`);
    await withConfig(config,path=>run(config.restore,[`--config=${path}`,...toolArgs]));
    console.log(values['--execute']?'[restore] SUCCESS. Compare collection counts, indexes, and application records before relying on this backup.':'[restore] Preview passed. Add --execute to restore into the test target. Existing collections are never dropped.');
  }
} catch(error) {console.error(`[restore] ${error.message}`);process.exitCode=1;}
finally {if(release) release();}
