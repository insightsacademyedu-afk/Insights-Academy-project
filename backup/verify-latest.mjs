import { resolve } from 'node:path';
import { loadEnv, settings, archives, verify } from './common.mjs';
loadEnv();
try {
  const config=settings(); const name=archives(config.dir,config.sourceDb)[0];
  if(!name) throw Error('No completed backup with metadata exists');
  const manifest=await verify(resolve(config.dir,name),config.sourceDb,config.maxAge);
  console.log(`[verify] OK ${name}; ${manifest.size} bytes; SHA-256 and full gzip integrity passed. A test restore is still required.`);
} catch(error) {console.error(`[verify] ${error.message}`);process.exitCode=1;}
