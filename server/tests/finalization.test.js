import request from "supertest";
import app from "../app.js";
import Staff from "../models/Staff.js";
import FeeInvoice, { computeInvoiceTotal } from "../models/FeeInvoice.js";
import { computeNetSalary } from "../models/SalaryPayment.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import User from "../models/User.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain, createEnrolledStudent, assignTeacher } from "./helpers/fixtures.js";

test("malformed login data returns a client error rather than throwing", async () => {
  for (const password of [123, {}, [], "x".repeat(73)]) {
    expect((await request(app).post("/api/auth/login").send({ username: "admin", password })).status).toBe(400);
  }
});
test("financial formulas handle numeric strings without concatenation", () => {
  expect(computeInvoiceTotal({monthlyTuition:"500",admissionFee:"100",discount:"50"})).toBe(550);
  expect(computeNetSalary({baseAmount:"1000",bonuses:"100",deductions:"50"})).toBe(1050);
});
test("reference-data updates run document validation and preserve stored values after rejection", async () => {
  const {agent,csrfToken}=await createAdminSession(app);
  const chain=await createAcademicChain();
  const res=await withCsrf(agent.put(`/api/classes/${chain.klass._id}`).send({academicSession:"64b000000000000000000000"}),csrfToken);
  expect(res.status).toBe(400);
  const found=await agent.get(`/api/classes/${chain.klass._id}`);
  expect(String(found.body.academicSession._id || found.body.academicSession)).toBe(String(chain.session._id));
});
test("payments reject string amounts and waived invoices; waived summary has zero outstanding",async()=>{
  const {agent,csrfToken}=await createAdminSession(app),chain=await createAcademicChain();
  const {student}=await createEnrolledStudent(chain);
  const invoice=await FeeInvoice.create({student:student._id,academicSession:chain.session._id,period:"2030-01",totalAmount:100,dueDate:"2030-02-01",status:"waived"});
  const send=body=>withCsrf(agent.post('/api/fees/payments').send({invoice:invoice._id,method:'cash',...body}),csrfToken);
  expect((await send({amount:"10"})).status).toBe(400);
  expect((await send({amount:10})).status).toBe(409);
  const summary=await agent.get(`/api/fees/students/${student._id}/summary`);
  expect(summary.status).toBe(200);
  expect(summary.body.outstanding).toBe(0);
});
test("staff CRUD cannot forge login links, and inactive staff lose session access",async()=>{
  const {agent,csrfToken}=await createAdminSession(app);
  const teacher=await createTeacherSession(app);
  const update=await withCsrf(agent.put(`/api/staff/${teacher.staff._id}`).send({user:"64b000000000000000000000"}),csrfToken);
  expect(update.status).toBe(200);
  expect(String((await Staff.findById(teacher.staff._id)).user)).toBe(String(teacher.user._id));
  await Staff.findByIdAndUpdate(teacher.staff._id,{status:'inactive'});
  expect((await teacher.agent.get('/api/auth/me')).status).toBe(403);
});
test("concurrent staff login creation leaves exactly one linked user",async()=>{
  const {agent,csrfToken}=await createAdminSession(app);
  const staff=await Staff.create({fullName:'New teacher'});
  const responses=await Promise.all(['one','two'].map(s=>withCsrf(agent.post(`/api/staff/${staff._id}/create-login`).send({username:`teacher-${s}`,email:`${s}@example.com`,password:'SafePassword123!'}),csrfToken)));
  expect(responses.map(r=>r.status).sort()).toEqual([201,409]);
  expect(await User.countDocuments({staffId:staff._id})).toBe(1);
});
test("invalid later marks do not partially save earlier valid entries",async()=>{
  const teacher=await createTeacherSession(app),chain=await createAcademicChain();
  await assignTeacher(chain,teacher.staff._id);
  const a=await createEnrolledStudent(chain),b=await createEnrolledStudent(chain);
  const exam=await Test.create({title:'Validation',class:chain.klass._id,section:chain.section._id,subject:chain.subject._id,academicSession:chain.session._id,createdBy:teacher.staff._id,maxMarks:100,passingMarks:40,testDate:'2030-01-01'});
  const res=await withCsrf(teacher.agent.post(`/api/tests/${exam._id}/marks`).send({entries:[{student:String(a.student._id),marksObtained:50},{student:String(b.student._id),marksObtained:-1}]}),teacher.csrfToken);
  expect(res.status).toBe(400);
  expect(await TestResult.countDocuments({test:exam._id})).toBe(0);
});
test("CSV exports neutralize spreadsheet formulas",async()=>{
  const {agent}=await createAdminSession(app),chain=await createAcademicChain();
  await createEnrolledStudent(chain,{fullName:'=HYPERLINK("https://example.invalid")'});
  const res=await agent.get('/api/reports/students?format=csv');
  expect(res.status).toBe(200);
  expect(res.text).toContain("'=HYPERLINK");
});
test('teacher assignments include names required by the test-creation form',async()=>{
  const teacher=await createTeacherSession(app),chain=await createAcademicChain();await assignTeacher(chain,teacher.staff._id);
  const res=await teacher.agent.get('/api/teacher-assignments/mine');
  expect(res.status).toBe(200);expect(res.body.items[0].class.name).toBe(chain.klass.name);
  expect(res.body.items[0].subject.name).toBe(chain.subject.name);
  expect(res.body.items[0].academicSession.name).toBe(chain.session.name);
});
test('multiple ordinary expenses can be created and audit fields cannot be forged',async()=>{
  const {agent,csrfToken,user}=await createAdminSession(app);
  const category=await withCsrf(agent.post('/api/expense-categories').send({name:'Utilities'}),csrfToken);
  for(let i=0;i<2;i++) {
    const res=await withCsrf(agent.post('/api/expenses').send({category:category.body._id,amount:10,recordedBy:'64b000000000000000000000',sourceSalaryPayment:'64b000000000000000000000'}),csrfToken);
    expect(res.status).toBe(201);expect(res.body.sourceSalaryPayment).toBeNull();expect(res.body.recordedBy).toBe(String(user._id));
  }
});
test('selecting a new current session clears the previous selection',async()=>{
  const {agent,csrfToken}=await createAdminSession(app);
  for(const name of ['2027','2028']) {
    const res=await withCsrf(agent.post('/api/academic-sessions').send({name,startDate:`${name}-01-01`,endDate:`${name}-12-31`,isCurrent:true}),csrfToken);
    expect(res.status).toBe(201);
  }
  const res=await agent.get('/api/academic-sessions?isCurrent=true');
  expect(res.body.items).toHaveLength(1);expect(res.body.items[0].name).toBe('2028');
});
