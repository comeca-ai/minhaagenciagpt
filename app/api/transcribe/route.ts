import {getChatGPTUser} from '../../chatgpt-auth';
import {transcribe} from '../../../server/transcribe.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();
 return transcribe(request,{key:process.env.DEEPGRAM_API_KEY,authorized:!!user,identity:user?.userId});
}
