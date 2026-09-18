import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
let count=0;
function walk(dir) {
  for(const entry of readdirSync(dir,{withFileTypes:true})) {
    if(['node_modules','dist','local-backups','logs'].includes(entry.name))continue;
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())walk(path);
    else if(/\.(js|mjs)$/.test(entry.name)) {
      const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit',windowsHide:true});
      if(result.status!==0)process.exit(result.status || 1);
      count++;
    }
  }
}
for(const dir of ['server','scripts'])walk(resolve(root,dir));
console.log(`Syntax checks passed: ${count} JavaScript files`);
