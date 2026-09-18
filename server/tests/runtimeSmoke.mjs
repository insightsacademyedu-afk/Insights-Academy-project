// Real local HTTP + MongoDB smoke test. Never uses an external database.
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
let repl,server;
async function stop(){await new Promise(done=>server?server.close(done):done());await mongoose.disconnect();await repl?.stop();}
try {
  repl=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});
  Object.assign(process.env,{NODE_ENV:'test',MONGO_URI:repl.getUri('academy_smoke'),JWT_SECRET:'synthetic-runtime-only-secret-not-for-deployment',CLIENT_URL:'http://localhost:5010',COOKIE_NAME:'ams_runtime'});
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
  await api('/settings',{academyName:'Smoke Academy',academyPhone:'000-000'},'PUT');
  await api('/reports/expenses');await api('/dashboard/admin-summary');
  console.log('[runtime] real HTTP login, setup, enrollment, payments, salary expense, marks, settings and reports passed');
  if(process.argv.includes('--serve')) {
    console.log('[runtime] browser fixture ready at http://localhost:5010 (smoke-admin / LocalSmokeOnly123!), synthetic data only');
    await new Promise(done=>{const timer=setTimeout(done,15*60*1000);for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{clearTimeout(timer);done();});process.stdin.on('data',()=>{clearTimeout(timer);done();});});
  }
} catch(error){console.error('[runtime]',error);process.exitCode=1;}
finally{await stop();}
