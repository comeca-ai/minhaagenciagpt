import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {agentsResponse} from '../../../server/ai-http.mjs';
import {d1AIStore} from '../../../server/ai-store.mjs';
import {d1Store} from '../../../server/d1-workspace.mjs';
export const dynamic='force-dynamic';
async function handle(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:'Entre na agência para continuar.'},{status:401});
  const db=(env as unknown as {DB:D1Database}).DB;
  return agentsResponse(request,{owner:user.userId,store:d1AIStore(db),workspace:d1Store(db,user.userId),key:process.env.OPENAI_API_KEY,initialMicros:Number(process.env.JHONEME_AI_INITIAL_MICROS||0),initialRuns:Number(process.env.JHONEME_AI_INITIAL_RUNS||0)});
}
export const GET=handle;
export const POST=handle;
