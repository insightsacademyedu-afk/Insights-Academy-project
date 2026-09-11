import { config } from '../config/env.js';
import mongoose from 'mongoose';
import { readdirSync } from 'node:fs';
import { sourceDatabase } from '../../backup/common.mjs';
const args=process.argv.slice(2);
try {
  const expected=args[args.indexOf('--confirm-db')+1];
  if(!args.includes('--confirm-db')) throw Error('Specify --confirm-db EXACT_DATABASE; add --apply after reviewing the preview');
  sourceDatabase(config.mongoUri,expected);
  await mongoose.connect(config.mongoUri,{autoIndex:false,serverSelectionTimeoutMS:15000});
  for(const name of readdirSync(new URL('../models/',import.meta.url))) if(name.endsWith('.js')) await import(new URL('../models/'+name,import.meta.url));
  const apply=args.includes('--apply');
  const collection=mongoose.connection.collection('expenses');
  let indexes=[];
  try{indexes=await collection.indexes();}catch(error){if(error.code!==26)throw error;}
  const legacy=indexes.find(index=>index.name==='sourceSalaryPayment_1' && index.unique && index.sparse && index.key.sourceSalaryPayment===1 && Object.keys(index.key).length===1);
  console.log(`[database] ${apply?'APPLY':'PREVIEW'} database=${expected}`);
  if(legacy) {
    console.log('[database] Replace legacy salary-expense sparse index with an ObjectId-only partial unique index');
    if(apply) await collection.dropIndex(legacy.name);
  }
  for(const model of Object.values(mongoose.models)) {
    console.log(`[database] ensure indexes: ${model.collection.name}`);
    if(apply) await model.createIndexes();
  }
  // Pre-create the tiny shared lock used to serialize current-session selection.
  if(apply) await mongoose.connection.collection('academysystemlocks').updateOne({_id:'current-academic-session'},{$setOnInsert:{version:0}},{upsert:true});
  console.log(apply?'[database] index preparation complete':'[database] preview only. Back up, pause writes, then rerun with --apply.');
} catch(error){ console.error('[database] preparation failed:',error.code || error.name,'Check configuration, connectivity, permissions and existing duplicate data.');process.exitCode=1; }
finally {await mongoose.disconnect();}
