import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {openStore,validWorkspace} from './store.mjs';
import {transcribeAudio,MAX_AUDIO_BYTES,AUDIO_TYPES,audioType} from './deepgram.mjs';

const maxBytes=8_000_000;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
export function createAgencyServer({database=process.env.JHONEME_DB_PATH||'/agency/jhoneme.sqlite',staticRoot='/srv',secure=process.env.JHONEME_MODE==='https',verifyCredentials,authFingerprint,deepgramKey=process.env.DEEPGRAM_API_KEY,transcriber=transcribeAudio}={}){
 const fingerprint=authFingerprint??createHash('sha256').update((process.env.JHONEME_ADMIN_USER||'')+'\0'+(process.env.JHONEME_PASSWORD_HASH||'')).digest('hex');
 const store=openStore(database,fingerprint),attempts=new Map();let activeLogins=0;
 let activeAudio=0,audioWindow={until:0,count:0};
 const verify=verifyCredentials||async function(username,password){const auth=Buffer.from(username+':'+password).toString('base64');const result=await fetch('http://127.0.0.1:8082/verify',{headers:{Authorization:'Basic '+auth},signal:AbortSignal.timeout(10000)});return result.status===200};
 const cookie=(token,clear=false)=>`jhoneme_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:28800}${secure?'; Secure':''}`;
 const tokenOf=req=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('jhoneme_session='))?.slice(16)||'';
 function send(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
 async function body(req){if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Use JSON.'),{status:415});let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('Dados maiores que 8 MB.'),{status:413});parts.push(chunk)}try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{throw Object.assign(new Error('JSON inválido.'),{status:400})}}
 function originOK(req){const proto=secure?'https':'http';return req.headers.origin===proto+'://'+req.headers.host}
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  let path;try{path=decodeURIComponent(new URL(req.url,'http://agency').pathname)}catch{return send(res,400,{error:'Endereço inválido.'})}
  try{
   if(path==='/healthz'&&req.method==='GET'){store.read();return send(res,200,{ok:true})}
   if(path==='/runtime-config.js'&&req.method==='GET'){res.writeHead(200,{'Content-Type':mime['.js']});return res.end('window.JHONEME_SERVER=true;')}
   if(path.startsWith('/api/')&&!['GET','HEAD'].includes(req.method)&&!originOK(req))return send(res,403,{error:'Origem não autorizada.'});
   if(path==='/api/login'&&req.method==='POST'){
    const data=await body(req),username=data?.username,password=data?.password;
    if(typeof username!=='string'||typeof password!=='string'||username.length>40||Buffer.byteLength(password)>72)return send(res,400,{error:'Informe usuário e senha.'});
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];const now=Date.now();
    for(const [key,value]of attempts)if(value.until<=now)attempts.delete(key);
    let entry=attempts.get(ip);if(!entry){if(attempts.size>=5000)return send(res,429,{error:'Tente novamente em um minuto.'});entry={count:0,until:now+60000};attempts.set(ip,entry)}
    if(entry.count>=6||activeLogins>=4)return send(res,429,{error:'Muitas tentativas. Aguarde um minuto.'},{'Retry-After':'60'});
    entry.count++;activeLogins++;let ok;try{ok=await verify(username,password)}finally{activeLogins--}
    if(!ok)return send(res,401,{error:'Usuário ou senha inválidos.'});
    attempts.delete(ip);return send(res,200,{ok:true},{'Set-Cookie':cookie(store.createSession())});
   }
   const token=tokenOf(req),authorized=store.hasSession(token);
   const publicFiles=new Set(['/login','/login.html','/login.css','/login.js','/assets/studio.png']);
   if(!authorized&&!publicFiles.has(path)){
    if(path.startsWith('/api/'))return send(res,401,{error:'Entre na agência para continuar.'});
    res.writeHead(302,{Location:'/login'});return res.end();
   }
   if(path==='/api/session'&&req.method==='GET')return send(res,200,{authenticated:true});
   if(path==='/api/voice-config'&&req.method==='GET')return send(res,200,{available:!!deepgramKey,maxSeconds:600,maxBytes:MAX_AUDIO_BYTES});
   if(path==='/api/transcribe'&&req.method==='POST'){
    if(!deepgramKey)return send(res,503,{error:'Configure o Deepgram no servidor para usar a gravação.'});
    if(!AUDIO_TYPES.has(audioType(req.headers['content-type'])))return send(res,415,{error:'Formato de áudio não suportado.'});
    if(Number(req.headers['content-length'])>MAX_AUDIO_BYTES)return send(res,413,{error:'Limite de 25 MB por gravação.'});
    const now=Date.now();if(audioWindow.until<=now)audioWindow={until:now+600000,count:0};
    if(activeAudio>=2||audioWindow.count>=12)return send(res,429,{error:'Limite de gravações atingido. Aguarde alguns minutos.'});
    activeAudio++;audioWindow.count++;
    try{let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>MAX_AUDIO_BYTES)throw Object.assign(new Error('Limite de 25 MB por gravação.'),{status:413});parts.push(chunk)}const result=await transcriber(Buffer.concat(parts),req.headers['content-type'],{key:deepgramKey});return send(res,200,result)}finally{activeAudio--}
   }
   if(path==='/api/logout'&&req.method==='POST'){store.deleteSession(token);return send(res,200,{ok:true},{'Set-Cookie':cookie('',true)})}
   if(path==='/api/workspace'&&req.method==='GET')return send(res,200,store.read());
   if(path==='/api/workspace'&&req.method==='PUT'){
    const data=await body(req);if(!validWorkspace(data?.state)||!Number.isInteger(data.expectedRevision)||data.expectedRevision<0)return send(res,400,{error:'Formato de dados inválido.'});
    const revision=store.write(data.state,data.expectedRevision);if(revision===null)return send(res,409,{error:'Outra sessão alterou a agência. Recarregue antes de salvar.',revision:store.read().revision});
    return send(res,200,{revision});
   }
   if(path.startsWith('/api/'))return send(res,404,{error:'Operação não encontrada.'});
   if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Método não permitido.'},{Allow:'GET, HEAD'});
   if(path==='/'||path==='/index.html')path='/index.html';if(path==='/login')path='/login.html';
   if(path.split('/').some(x=>x.startsWith('.'))||path.includes('\0')||path.includes('\\'))return send(res,404,{error:'Arquivo não encontrado.'});
   const base=await realpath(staticRoot),candidate=resolve(base,'.'+path);
   if(!candidate.startsWith(base+sep))return send(res,404,{error:'Arquivo não encontrado.'});
   let actual,bytes;try{actual=await realpath(candidate);if(!actual.startsWith(base+sep))throw Error('path');bytes=await readFile(actual)}catch{return send(res,404,{error:'Arquivo não encontrado.'})}
   res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){send(res,error.status||503,{error:error.status?error.message:'Serviço temporariamente indisponível. Tente novamente.'})}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 server.on('close',()=>store.close());
 return {server,store};
}
