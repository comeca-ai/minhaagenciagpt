export const MAX_AUDIO_BYTES=6_000_000;
export const AUDIO_TYPES=new Set(['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/x-wav','audio/mpeg']);
const failure=(status,message)=>Object.assign(new Error(message),{status});
export function audioType(value){return String(value||'').split(';')[0].trim().toLowerCase()}
export async function transcribeAudio(audio,type,{key=process.env.DEEPGRAM_API_KEY,fetcher=fetch}={}){
 if(!key)throw failure(503,'A transcrição ainda não está configurada nesta instalação.');
 if(!AUDIO_TYPES.has(audioType(type)))throw failure(415,'Use uma gravação WebM, Ogg, MP4, WAV ou MP3.');
 if(!audio?.byteLength)throw failure(400,'A gravação está vazia. Tente novamente.');
 if(audio.byteLength>MAX_AUDIO_BYTES)throw failure(413,'Grave um áudio de até 2 minutos e 6 MB.');
 const url='https://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&smart_format=true&punctuate=true&mip_opt_out=true';
 let response;try{response=await fetcher(url,{method:'POST',headers:{Authorization:'Token '+key,'Content-Type':audioType(type)},body:audio,signal:AbortSignal.timeout(45000)})}catch{throw failure(502,'Não foi possível conectar ao Deepgram. Seu texto anterior continua preservado.')}
 if(!response.ok){await response.body?.cancel();if(response.status===401||response.status===403)throw failure(503,'O Deepgram recusou a credencial. Confira a configuração no servidor.');if(response.status===402)throw failure(503,'Confira o saldo da conta Deepgram.');if(response.status===429)throw failure(429,'O Deepgram está no limite de uso. Aguarde antes de tentar novamente.');throw failure(502,'O Deepgram não conseguiu transcrever este áudio. Tente uma nova gravação.')}
 let result;try{result=await response.json()}catch{throw failure(502,'A resposta da transcrição não pôde ser lida.')}
 const text=result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
 if(typeof text!=='string'||!text.trim())throw failure(422,'Não identifiquei fala no áudio. Confira o microfone e tente novamente.');
 if(text.length>10000)throw failure(413,'A transcrição ficou longa demais. Grave um pedido mais curto.');
 return {transcript:text.trim(),language:'pt-BR'};
}
