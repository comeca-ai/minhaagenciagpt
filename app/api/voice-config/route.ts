import {getChatGPTUser} from '../../chatgpt-auth';
import {voiceConfig} from '../../../server/transcribe.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getChatGPTUser();
 return voiceConfig({authorized:!!user,key:process.env.DEEPGRAM_API_KEY});
}
