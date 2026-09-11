import {test,expect,vi} from 'vitest';
vi.mock('./client',()=>({default:{get:vi.fn()}}));
import api from './client';
import {createResourceApi} from './resource';
test('large dropdown lookups include later capped pages',async()=>{
  api.get.mockResolvedValueOnce({data:{items:[{_id:'first'}],totalPages:2,total:101}}).mockResolvedValueOnce({data:{items:[{_id:'last'}],totalPages:2}});
  const data=await createResourceApi('/classes').list({limit:500});
  expect(data.items.map(x=>x._id)).toEqual(['first','last']);
  expect(api.get).toHaveBeenLastCalledWith('/classes',{params:{limit:500,page:2}});
});
