import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import Staff from '../models/Staff.js';
import FeeInvoice, {computeInvoiceTotal} from '../models/FeeInvoice.js';
import {computeNetSalary} from '../models/SalaryPayment.js';
import {sumMoney} from '../utils/money.js';
import {createAdminSession,createTeacherSession,withCsrf} from './helpers/authHelpers.js';
import {createAcademicChain,createEnrolledStudent} from './helpers/fixtures.js';

for(const [role,make] of [['admin',createAdminSession],['staff',createTeacherSession]]) {
 test(`${role} changes own password, old password and other sessions stop working`,async()=>{
  const {agent,user,csrfToken}=await make(app);
  const other=request.agent(app);
  await other.post('/api/auth/login').send({username:user.username,password:'Password123!'});
  const response=await withCsrf(agent.post('/api/auth/change-password').send({currentPassword:'Password123!',newPassword:'NewSecurePassword456!',confirmPassword:'NewSecurePassword456!'}),csrfToken);
  expect(response.status).toBe(200);expect(response.body.passwordHash).toBeUndefined();
  expect((await agent.get('/api/auth/me')).status).toBe(200);
  expect((await other.get('/api/auth/me')).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({username:user.username,password:'Password123!'})).status).toBe(401);
  expect((await request(app).post('/api/auth/login').send({username:user.username,password:'NewSecurePassword456!'})).status).toBe(200);
  expect((await User.findById(user._id)).tokenVersion).toBe(1);
 });
}
test('password change rejects wrong current password, mismatch, short, reused and overlong UTF-8 values without changing credentials',async()=>{
 const {agent,csrfToken,user}=await createAdminSession(app);
 for(const values of [
  {currentPassword:'wrong',newPassword:'NewSecurePassword456!',confirmPassword:'NewSecurePassword456!'},
  {currentPassword:'Password123!',newPassword:'NewSecurePassword456!',confirmPassword:'different'},
  {currentPassword:'Password123!',newPassword:'short',confirmPassword:'short'},
  {currentPassword:'Password123!',newPassword:'Password123!',confirmPassword:'Password123!'},
  {currentPassword:'Password123!',newPassword:'🔐'.repeat(20),confirmPassword:'🔐'.repeat(20)}
 ])expect((await withCsrf(agent.post('/api/auth/change-password').send(values),csrfToken)).status).toBe(400);
 expect((await User.findById(user._id)).tokenVersion).toBe(0);
 expect((await agent.post('/api/auth/change-password').send({})).status).toBe(403);
});
test('money formulas use paisa and clamp fully discounted totals at zero',()=>{
 expect(sumMoney(0.1,0.2)).toBe(0.3);
 expect(computeInvoiceTotal({monthlyTuition:1000.1,otherFee:0.2,discount:0.3})).toBe(1000);
 expect(computeNetSalary({baseAmount:10000.1,bonuses:0.2,deductions:0.3})).toBe(10000);
 expect(computeNetSalary({baseAmount:100,deductions:200})).toBe(0);
 expect(computeInvoiceTotal({monthlyTuition:1,discount:2})).toBe(0);
 expect(Array.from({length:10000},()=>0.01).reduce((s,v)=>sumMoney(s,v),0)).toBe(100);
});
test('fractional payments, reversals, reports and dashboard agree exactly',async()=>{
 const {agent,csrfToken}=await createAdminSession(app),chain=await createAcademicChain();
 const {student}=await createEnrolledStudent(chain,{feeDetails:{monthlyTuition:0.3}});
 const invoice=await withCsrf(agent.post('/api/fees/invoices').send({student:student._id,academicSession:chain.session._id,period:'2032-01',dueDate:'2032-02-01'}),csrfToken);
 expect(invoice.status).toBe(201);
 for(const amount of [0.1,0.2])expect((await withCsrf(agent.post('/api/fees/payments').send({invoice:invoice.body._id,amount,method:'cash'}),csrfToken)).status).toBe(201);
 expect((await FeeInvoice.findById(invoice.body._id)).status).toBe('paid');
 const reversal=await withCsrf(agent.post('/api/fees/payments').send({invoice:invoice.body._id,amount:-0.1,method:'adjustment'}),csrfToken);
 expect(reversal.status).toBe(201);expect(reversal.body.invoice.amountPaid).toBe(0.2);
 expect((await agent.get('/api/reports/fee-collection')).body.total).toBe(0.2);
 expect((await agent.get('/api/reports/outstanding-fees')).body.totalOutstanding).toBe(0.1);
 const summary=(await agent.get('/api/dashboard/admin-summary')).body;
 expect(summary.fees.totalCollected).toBe(0.2);expect(summary.fees.outstanding).toBe(0.1);
 expect((await agent.get(`/api/fees/students/${student._id}/summary`)).body.outstanding).toBe(0.1);
});
test('monthly bulk tuition excludes one-off fees and preserves discounts',async()=>{
 const {agent,csrfToken}=await createAdminSession(app),chain=await createAcademicChain();
 await createEnrolledStudent(chain,{feeDetails:{monthlyTuition:1000.1,admissionFee:500,examFee:200,otherFee:100,discount:0.1}});
 const r=await withCsrf(agent.post('/api/fees/invoices/bulk-generate').send({class:chain.klass._id,section:chain.section._id,academicSession:chain.session._id,period:'2032-01',dueDate:'2032-02-01'}),csrfToken);
 expect(r.status).toBe(201);expect(r.body.created[0].totalAmount).toBe(1000);expect(r.body.created[0].admissionFee).toBe(0);
});
test('salary paisa matches its linked expense; zero-net salary settles without an expense',async()=>{
 const {agent,csrfToken}=await createAdminSession(app);
 const staff=await Staff.create({fullName:'Paisa Staff',basicSalary:10000.1});
 const category=await ExpenseCategory.create({name:'Paisa Payroll'});
 for(const [period,deductions,expected] of [['2032-01',0.3,10000],['2032-02',20000,0]]){
  const made=await withCsrf(agent.post('/api/salaries').send({staff:staff._id,period,bonuses:0.2,deductions}),csrfToken);
  expect(made.status).toBe(201);expect(made.body.netAmount).toBe(expected);
  const paid=await withCsrf(agent.post(`/api/salaries/${made.body._id}/mark-paid`).send({expenseCategory:category._id}),csrfToken);
  expect(paid.status).toBe(200);expect(paid.body.salary.status).toBe('paid');
  if(expected)expect(paid.body.expense.amount).toBe(expected);else expect(paid.body.expense).toBeNull();
 }
 expect(await Expense.countDocuments()).toBe(1);
});
test('financial entry rejects fractions smaller than a paisa and out-of-range amounts',async()=>{
 const {agent,csrfToken}=await createAdminSession(app);
 const category=await ExpenseCategory.create({name:'Precision'});
 for(const amount of [1.001,1000000001])expect((await withCsrf(agent.post('/api/expenses').send({category:category._id,amount}),csrfToken)).status).toBe(400);
 expect(await Expense.countDocuments()).toBe(0);
});
test('one-off invoice types select only their charge and explicit overrides can combine charges',async()=>{
 const {agent,csrfToken}=await createAdminSession(app),chain=await createAcademicChain();
 const {student}=await createEnrolledStudent(chain,{feeDetails:{monthlyTuition:1000,admissionFee:500,examFee:200,otherFee:100,discount:50}});
 for(const [type,total] of [['tuition',950],['admission',500],['exam',200],['other',100]]){
  const r=await withCsrf(agent.post('/api/fees/invoices').send({student:student._id,academicSession:chain.session._id,period:'2033-01',invoiceType:type,dueDate:'2033-02-01'}),csrfToken);
  expect(r.status).toBe(201);expect(r.body.totalAmount).toBe(total);
 }
 const combined=await withCsrf(agent.post('/api/fees/invoices').send({student:student._id,academicSession:chain.session._id,period:'2033-02',invoiceType:'tuition',dueDate:'2033-03-01',overrides:{admissionFee:500}}),csrfToken);
 expect(combined.status).toBe(201);expect(combined.body.totalAmount).toBe(1450);
});
