// Real local HTTP + MongoDB + Database Tools smoke test. Never uses an external database.
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const backupDir=mkdtempSync(resolve(tmpdir(),'academy-runtime-backup-'));
let repl,server;
function child(script,args=[],extra={}) {
  return new Promise((ok,fail)=>{
    const p=spawn(process.execPath,[resolve(root,script),...args],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,...extra}});
    p.on('error',fail);p.on('close',code=>code===0?ok():fail(Error(`${script} exited ${code}`)));
  });
}
async function stop(){await new Promise(done=>server?server.close(done):done());await mongoose.disconnect();await repl?.stop();rmSync(backupDir,{recursive:true,force:true});}
try {
  repl=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});
  Object.assign(process.env,{NODE_ENV:'test',MONGO_URI:repl.getUri('academy_smoke'),JWT_SECRET:'synthetic-runtime-only-secret-not-for-deployment',CLIENT_URL:'http://localhost:5010',COOKIE_NAME:'ams_runtime',BACKUP_DB:'academy_smoke',BACKUP_DIR:backupDir,UPLOAD_TO_CLOUD:'false',SMTP_HOST:'',SMTP_USER:'',SMTP_PASS:''});
  const {default:app}=await import('../app.js');
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map(model=>model.init()));
  const User=mongoose.model('User');
  await User.create({username:'smoke-admin',email:'smoke@example.invalid',role:'admin',passwordHash:await User.hashPassword('LocalSmokeOnly123!')});
  const web=express();
  web.use(express.static(resolve(root,'client/dist')));
  web.get(/^(?!\/api(?:\/|$)).*/,(_req,res)=>res.sendFile(resolve(root,'client/dist/index.html')));
  web.use(app);
  server=await new Promise((done,fail)=>{const s=web.listen(process.argv.includes('--serve')?5010:0,'127.0.0.1',()=>done(s));s.once('error',fail);});
  const baseUrl=`http://127.0.0.1:${server.address().port}`;
  const jar=new Map();
  async function api(path,body,method=body?'POST':'GET') {
    const res=await fetch(baseUrl+'/api'+path,{method,headers:{'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(jar.get('ams_csrf')?{'x-csrf-token':jar.get('ams_csrf')}:{})},...(body?{body:JSON.stringify(body)}:{})});
    for(const cookie of res.headers.getSetCookie()){const part=cookie.split(';')[0],index=part.indexOf('=');jar.set(part.slice(0,index),part.slice(index+1));}
    const data=await res.json();assert.ok(res.ok,`${method} ${path}: ${res.status} ${data.message}`);return data;
  }
  await api('/auth/login',{username:'smoke-admin',password:'LocalSmokeOnly123!'});
  const session=await api('/academic-sessions',{name:'Smoke 2030',startDate:'2030-01-01',endDate:'2030-12-31',isCurrent:true});
  const klass=await api('/classes',{name:'Smoke Class',academicSession:session._id});
  const section=await api('/sections',{name:'A',class:klass._id});
  const subject=await api('/subjects',{name:'Smoke Math',code:'SM-MATH',maxMarks:100,passingMarks:40});
  const staff=await api('/staff',{fullName:'Smoke Teacher',basicSalary:10000});
  await api(`/staff/${staff._id}/create-login`,{username:'smoke-teacher',email:'teacher@example.invalid',password:'LocalSmokeOnly123!'});
  await api('/teacher-assignments',{teacher:staff._id,class:klass._id,section:section._id,subject:subject._id,academicSession:session._id});
  const enrollment=await api('/students',{admissionNumber:'SM-001',fullName:'Smoke Student',gender:'female',dob:'2015-01-01',guardian:{fullName:'Smoke Guardian',primaryPhone:'00000000000'},enrollment:{class:klass._id,section:section._id,academicSession:session._id,rollNumber:'1'},feeDetails:{monthlyTuition:5000}});
  const invoice=await api('/fees/invoices',{student:enrollment.student._id,academicSession:session._id,period:'2030-01',dueDate:'2030-02-01'});
  await api('/fees/payments',{invoice:invoice._id,amount:1000,method:'cash'});
  const category=await api('/expense-categories',{name:'Salaries'});
  const salary=await api('/salaries',{staff:staff._id,period:'2030-01'});
  await api(`/salaries/${salary._id}/mark-paid`,{expenseCategory:category._id});
  const exam=await api('/tests',{title:'Smoke Exam',class:klass._id,section:section._id,subject:subject._id,academicSession:session._id,createdBy:staff._id,maxMarks:100,passingMarks:40,testDate:'2030-01-10'});
  await api(`/tests/${exam._id}/marks`,{entries:[{student:enrollment.student._id,marksObtained:80}]});
  await api(`/tests/${exam._id}/finalize`,{});
  await api('/notifications',{title:'Local smoke',body:'Synthetic in-app only',channels:['in_app'],audience:{type:'all_staff'}});
  await api('/reports/expenses');await api('/dashboard/admin-summary');
  console.log('[runtime] real HTTP login, setup, enrollment, payments, salary expense, marks, notifications and reports passed');
  // An unrelated database sentinel detects accidental cluster-wide dumps.
  await mongoose.connection.client.db('unrelated_smoke').collection('sentinel').insertOne({keep:true});
  await child('backup/backup.mjs');
  await child('backup/verify-latest.mjs');
  const file=resolve(backupDir,readdirSync(backupDir).find(name=>name.endsWith('.archive.gz')));
  assert.equal(gunzipSync(readFileSync(file)).includes(Buffer.from('unrelated_smoke')),false,'archive must not contain the unrelated database');
  const target='academy_smoke_restore_test';
  await child('backup/restore.mjs',['--file',file,'--target-db',target]);
  assert.equal((await mongoose.connection.client.db(target).listCollections().toArray()).length,0,'preview must not write collections');
  await child('backup/restore.mjs',['--file',file,'--target-db',target,'--execute']);
  const source=mongoose.connection.db, restored=mongoose.connection.client.db(target);
  for(const collection of await source.listCollections({type:'collection'}).toArray()) {
    assert.equal(await source.collection(collection.name).countDocuments(),await restored.collection(collection.name).countDocuments(),`count: ${collection.name}`);
    const normalized=indexes=>indexes.map(({key,unique,sparse,partialFilterExpression})=>({key,unique,sparse,partialFilterExpression})).sort((a,b)=>JSON.stringify(a.key).localeCompare(JSON.stringify(b.key)));
    assert.deepEqual(normalized(await source.collection(collection.name).indexes()),normalized(await restored.collection(collection.name).indexes()),`indexes: ${collection.name}`);
  }
  assert.equal(await restored.collection('sentinel').countDocuments(),0);
  assert.equal(await mongoose.connection.client.db('unrelated_smoke').collection('sentinel').countDocuments(),1);
  console.log('[runtime] actual backup, preview without writes, restored counts/indexes and unrelated database isolation passed');
  if(process.argv.includes('--serve')) {
    console.log('[runtime] browser fixture ready at http://localhost:5010 (smoke-admin / LocalSmokeOnly123!), synthetic data only');
    await new Promise(done=>{const timer=setTimeout(done,15*60*1000);for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{clearTimeout(timer);done();});process.stdin.on('data',()=>{clearTimeout(timer);done();});});
  }
} catch(error){console.error('[runtime]',error);process.exitCode=1;}
finally{await stop();}
