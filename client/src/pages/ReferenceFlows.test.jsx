import {vi, beforeEach, test, expect} from 'vitest';
import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import AcademicSessions from './AcademicSessions';
import Subjects from './Subjects';
import Designations from './Designations';
import Staff from './Staff';
import Reports from './Reports';
import Classes from './Classes';
import Salaries from './Salaries';
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{username:'admin',role:'admin'},isAdmin:true,logout:vi.fn()})}));
vi.mock('../context/ToastContext',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
vi.mock('../api/academicSetup',()=>{
  const api=()=>({list:vi.fn(),create:vi.fn(),update:vi.fn(),remove:vi.fn()});
  return {academicSessionsApi:api(),subjectsApi:api(),designationsApi:api(),classesApi:api(),sectionsApi:api()};
});
vi.mock('../api/staff',()=>({staffApi:{list:vi.fn(),create:vi.fn()}}));
vi.mock('../api/teacherAssignments',()=>({teacherAssignmentsApi:{list:vi.fn()}}));
vi.mock('../api/reports',()=>({fetchStudentsReport:vi.fn(),fetchFeeCollectionReport:vi.fn(),fetchOutstandingFeesReport:vi.fn(),fetchExpensesReport:vi.fn(),downloadReportCsv:vi.fn()}));
vi.mock('../api/salaries',()=>({salariesApi:{list:vi.fn(),create:vi.fn(),bulkGenerate:vi.fn(),markPaid:vi.fn()}}));
vi.mock('../api/expenses',()=>({expensesApi:{list:vi.fn()}}));
vi.mock('../api/expenseCategories',()=>({expenseCategoriesApi:{list:vi.fn()}}));
import * as setup from '../api/academicSetup';
import {staffApi} from '../api/staff';
import {teacherAssignmentsApi} from '../api/teacherAssignments';
import * as reports from '../api/reports';
import {salariesApi} from '../api/salaries';
import {expensesApi} from '../api/expenses';
import {expenseCategoriesApi} from '../api/expenseCategories';
const empty={items:[],total:0,totalPages:1};
beforeEach(()=>{
  vi.clearAllMocks();
  for(const api of [...Object.values(setup),staffApi,teacherAssignmentsApi,salariesApi,expensesApi,expenseCategoriesApi]) api.list.mockResolvedValue(empty);
  reports.fetchStudentsReport.mockResolvedValue(empty);
  reports.fetchFeeCollectionReport.mockResolvedValue({...empty,count:0});
  reports.fetchOutstandingFeesReport.mockResolvedValue({...empty,totalOutstanding:0,count:0});
  reports.fetchExpensesReport.mockResolvedValue({...empty,count:0});
});
function mount(Page){return render(<MemoryRouter><Page/></MemoryRouter>);}
test('academic-session filter uses the archived status accepted by the API',async()=>{
  mount(AcademicSessions);
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Filter by status'}),'archived');
  await waitFor(()=>expect(setup.academicSessionsApi.list).toHaveBeenCalledWith(expect.objectContaining({status:'archived'})));
});
test('session creation sends form dates and refreshes the list',async()=>{
  mount(AcademicSessions);const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'New session'}));
  await user.type(screen.getByLabelText(/^Name/),'2027-2028');
  fireEvent.change(screen.getByLabelText(/^Start date/),{target:{value:'2027-01-01'}});
  fireEvent.change(screen.getByLabelText(/^End date/),{target:{value:'2027-12-31'}});
  await user.click(screen.getByRole('button',{name:'Create session'}));
  await waitFor(()=>expect(setup.academicSessionsApi.create).toHaveBeenCalledWith(expect.objectContaining({name:'2027-2028',startDate:'2027-01-01',endDate:'2027-12-31'})));
});
test('subject creation exposes backend validation errors without closing form',async()=>{
  setup.subjectsApi.create.mockRejectedValueOnce(new Error('Passing marks exceed maximum'));
  mount(Subjects);const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'New subject'}));
  await user.type(screen.getByLabelText(/^Name/),'Math');await user.type(screen.getByLabelText(/^Code/),'MATH');
  await user.click(screen.getByRole('button',{name:'Create subject'}));
  expect(await screen.findByText('Passing marks exceed maximum')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Create subject'})).toBeTruthy();
});
test('designation create flow sends title',async()=>{
  mount(Designations);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'New designation'}));
  await user.type(screen.getByLabelText(/^Title/),'Teacher');await user.click(screen.getByRole('button',{name:'Create designation'}));
  await waitFor(()=>expect(setup.designationsApi.create).toHaveBeenCalledWith(expect.objectContaining({title:'Teacher'})));
});
test('staff directory and assignment tabs load their respective data',async()=>{
  mount(Staff);await waitFor(()=>expect(staffApi.list).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button',{name:'Teacher assignments'}));
  await waitFor(()=>expect(teacherAssignmentsApi.list).toHaveBeenCalled());
});
test('new staff salary starts blank and saves only the entered amount',async()=>{
  mount(Staff);const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'New staff'}));
  const salary=screen.getByLabelText('Basic salary');
  expect(salary).toHaveValue(null);
  await user.type(screen.getByLabelText(/^Full name/),'Teacher One');
  await user.type(salary,'4000');
  expect(salary).toHaveValue(4000);
  await user.click(screen.getByRole('button',{name:'Create staff'}));
  await waitFor(()=>expect(staffApi.create).toHaveBeenCalledWith(expect.objectContaining({basicSalary:4000})));
});
test('reports switch endpoints and export the selected report',async()=>{
  mount(Reports);await waitFor(()=>expect(reports.fetchStudentsReport).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button',{name:'Outstanding Fees'}));
  await waitFor(()=>expect(reports.fetchOutstandingFeesReport).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button',{name:/Download CSV/}));
  await waitFor(()=>expect(reports.downloadReportCsv).toHaveBeenCalledWith('/reports/outstanding-fees',{},'outstanding-fees-report.csv'));
});
test('classes show a clear prerequisite when no academic session exists',async()=>{
  mount(Classes);expect(await screen.findByText(/Create an academic session first/)).toBeTruthy();
});
test('salaries, expenses and categories load separately',async()=>{
  mount(Salaries);await waitFor(()=>expect(salariesApi.list).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button',{name:'Expenses'}));await waitFor(()=>expect(expensesApi.list).toHaveBeenCalled());
  await userEvent.click(screen.getByRole('button',{name:'Categories'}));await waitFor(()=>expect(expenseCategoriesApi.list).toHaveBeenCalled());
});
test('bulk salary generation sends the shared period adjustments',async()=>{
  salariesApi.bulkGenerate.mockResolvedValue({createdCount:2,skippedCount:0,created:[],skipped:[]});
  mount(Salaries);const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Bulk generate'}));
  await user.type(screen.getByPlaceholderText('e.g. 2026-01'),'2026-08');
  await user.type(screen.getByLabelText('Bonus for each staff member'),'1000');
  await user.type(screen.getByLabelText('Deduction for each staff member'),'500');
  await user.type(screen.getByLabelText('Notes'),'Monthly payroll');
  await user.click(screen.getByRole('button',{name:'Generate salaries'}));
  await waitFor(()=>expect(salariesApi.bulkGenerate).toHaveBeenCalledWith({period:'2026-08',bonuses:1000,deductions:500,notes:'Monthly payroll'}));
});
