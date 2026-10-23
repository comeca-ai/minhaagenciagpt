import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {workspaceResponse} from '../../../server/d1-workspace.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request){
  const user=await getChatGPTUser();
  return workspaceResponse(request,{userId:user?.userId,db:(env as unknown as {DB:D1Database}).DB});
}
export const GET=handle;
export const PUT=handle;
