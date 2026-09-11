import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
process.env.NODE_ENV='production';
process.env.MONGO_URI='mongodb://127.0.0.1:27017/unused_production_check';
process.env.JWT_SECRET='SyntheticProductionCheckOnly-1234567890';
process.env.CLIENT_URL='https://academy.example';
const {default:app}=await import('../app.js');
test('production health, security headers and secure readable CSRF cookie',async()=>{
  const r=await request(app).get('/api/health');
  assert.equal(r.status,200);assert.equal(r.body.env,'production');
  assert.ok(r.headers['content-security-policy']);
  const cookie=r.headers['set-cookie'].find(c=>c.startsWith('ams_csrf='));
  assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);assert.doesNotMatch(cookie,/HttpOnly/);
});
test('production serves built SPA routes and keeps unknown API paths JSON',async()=>{
  const page=await request(app).get('/students');
  assert.equal(page.status,200);assert.match(page.headers['content-type'],/text\/html/);
  const api=await request(app).get('/api/does-not-exist');
  assert.equal(api.status,404);assert.match(api.headers['content-type'],/application\/json/);
});
test('production blocks mutations without CSRF and login from an unrelated origin',async()=>{
  assert.equal((await request(app).post('/api/students').send({})).status,403);
  assert.equal((await request(app).post('/api/auth/login').set('Origin','https://unrelated.example').send({username:'synthetic',password:'synthetic'})).status,403);
});
test('production refuses weak JWT configuration before connecting to a database',()=>{
  const r=spawnSync(process.execPath,['--input-type=module','-e','import "./config/env.js"'],{cwd:new URL('../',import.meta.url),env:{...process.env,JWT_SECRET:'secret'},encoding:'utf8',windowsHide:true});
  assert.notEqual(r.status,0);assert.match(r.stderr,/JWT_SECRET/);
});
