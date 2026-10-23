// Server only. No audio, credentials, or provider bodies are logged or persisted.
import {transcribeAudio,MAX_AUDIO_BYTES} from './deepgram.mjs';
export {MAX_AUDIO_BYTES};
const supported=new Set(['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/mpeg']);
const recent=new Map();
export const json=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}});
export async function transcribe(request,{key,authorized,identity='session',fetcher=fetch,rateLimit=true}={}){
 if(!authorized)return json(401,{error:'Entre na agência para transcrever.'});
 if(request.method!=='POST')return json(405,{error:'Use uma gravação de áudio.'},{Allow:'POST'});
 if(request.headers.get('origin')!==new URL(request.url).origin)return json(403,{error:'Origem não autorizada.'});
 if(!key)return json(503,{error:'A transcrição ainda não está configurada no servidor.'});
 const type=(request.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!supported.has(type))return json(415,{error:'Formato de áudio não suportado. Tente gravar neste navegador novamente.'});
 if(Number(request.headers.get('content-length'))>MAX_AUDIO_BYTES)return json(413,{error:'Grave um áudio menor que 25 MB.'});
 if(rateLimit){const now=Date.now();for(const [id,value]of recent)if(value.until<=now)recent.delete(id);let entry=recent.get(identity);if(!entry){if(recent.size>=5000)return json(429,{error:'Aguarde um minuto para transcrever.'});entry={count:0,until:now+60000};recent.set(identity,entry)}if(entry.count>=5)return json(429,{error:'Aguarde um minuto antes de outra transcrição.'},{'Retry-After':'60'});entry.count++}
 try{
  const reader=request.body?.getReader();if(!reader)return json(400,{error:'Nenhum áudio recebido.'});
  const parts=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_AUDIO_BYTES){await reader.cancel();return json(413,{error:'Grave um áudio menor que 25 MB.'})}parts.push(value)}
  if(!size)return json(400,{error:'A gravação está vazia.'});
  const audio=new Uint8Array(size);let offset=0;for(const part of parts){audio.set(part,offset);offset+=part.length}
  return json(200,await transcribeAudio(audio,type,{key,fetcher}));
 }catch(error){return json(error.status||502,{error:error.status?error.message:'A transcrição não terminou. Verifique a conexão e tente novamente.'})}
}

export function voiceConfig({authorized,key}={}){return authorized?json(200,{available:!!key,maxSeconds:600,maxBytes:MAX_AUDIO_BYTES}):json(401,{error:'Entre na agência para transcrever.'})}
