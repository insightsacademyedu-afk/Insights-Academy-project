import { loadEnv, run } from './common.mjs';
loadEnv();
for(const [name,command,required] of [['mongodump',process.env.MONGODUMP_BIN || 'mongodump',true],['mongorestore',process.env.MONGORESTORE_BIN || 'mongorestore',true],['rclone',process.env.RCLONE_BIN || 'rclone',process.env.UPLOAD_TO_CLOUD==='true']]) {
  try {await run(command,['--version']);console.log(`[check] OK ${name}`);}
  catch {console.log(`[check] ${required?'FAIL':'WARN'} ${name} unavailable`);if(required)process.exitCode=1;}
}
