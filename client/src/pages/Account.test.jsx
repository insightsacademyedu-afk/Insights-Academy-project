import {test,expect,vi,beforeEach} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Account from './Account';
import {changePassword} from '../api/auth';
let role='admin';
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{username:'account-user',role},isAdmin:role==='admin',logout:vi.fn()})}));
vi.mock('../api/auth',()=>({changePassword:vi.fn()}));
beforeEach(()=>vi.clearAllMocks());
function form(current='OldPassword123!',next='NewPassword456!',confirm=next){
 render(<MemoryRouter><Account/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Current password'),{target:{value:current}});
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:next}});
 fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:confirm}});
 fireEvent.click(screen.getByRole('button',{name:'Change password'}));
}
for(const accountRole of ['admin','staff'])test(`${accountRole} can submit account password form and fields clear on success`,async()=>{
 role=accountRole;changePassword.mockResolvedValue({message:'Password changed. Other sessions have been signed out.'});
 form();expect(await screen.findByRole('status')).toHaveTextContent('Password changed');
 expect(changePassword).toHaveBeenCalledWith({currentPassword:'OldPassword123!',newPassword:'NewPassword456!',confirmPassword:'NewPassword456!'});
 expect(screen.getByLabelText('Current password')).toHaveValue('');
});
test('mismatch is explained without sending credentials',()=>{form('OldPassword123!','NewPassword456!','Mismatched123!');expect(screen.getByRole('alert')).toHaveTextContent('do not match');expect(changePassword).not.toHaveBeenCalled();});
test('server rejection is visible and allows correction',async()=>{changePassword.mockRejectedValue(new Error('Current password is incorrect.'));form();expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');expect(screen.getByRole('button',{name:'Change password'})).toBeEnabled();});
