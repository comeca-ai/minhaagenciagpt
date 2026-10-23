import {validWorkspace} from './workspace-validation.mjs';

export function d1Store(db,userId){
  return {
    async read(){
      const {results}=await db.prepare('SELECT w.revision,c.payload FROM workspaces w LEFT JOIN workspace_chunks c ON c.user_id=w.user_id AND c.snapshot=w.snapshot WHERE w.user_id=? ORDER BY c.part').bind(userId).all();
      return results.length?{revision:results[0].revision,state:JSON.parse(results.map(r=>r.payload).join(''))}:{revision:0,state:null};
    },
    async write(state,revision){
      const payload=JSON.stringify(state),snapshot=crypto.randomUUID(),chunks=[];
      for(let i=0;i<payload.length;){let end=Math.min(i+200000,payload.length);if(end<payload.length&&/[\uD800-\uDBFF]/.test(payload[end-1]))end--;chunks.push(payload.slice(i,end));i=end;}
      const statements=[db.prepare('INSERT INTO workspaces(user_id,revision,snapshot) SELECT ?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM workspaces WHERE user_id=? AND revision=?) ON CONFLICT(user_id) DO UPDATE SET revision=workspaces.revision+1,snapshot=excluded.snapshot WHERE workspaces.revision=? RETURNING revision').bind(userId,snapshot,revision,userId,revision,revision)];
      chunks.forEach((chunk,part)=>statements.push(db.prepare('INSERT INTO workspace_chunks(user_id,snapshot,part,payload) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM workspaces WHERE user_id=? AND snapshot=?)').bind(userId,snapshot,part,chunk,userId,snapshot)));
      statements.push(db.prepare('DELETE FROM workspace_chunks WHERE user_id=? AND snapshot<>? AND EXISTS(SELECT 1 FROM workspaces WHERE user_id=? AND snapshot=?)').bind(userId,snapshot,userId,snapshot));
      const results=await db.batch(statements);
      return results[0].results[0]?.revision??null;
    }
  };
}

export async function workspaceResponse(request,{userId,db}){
  const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if(!userId)return json({error:'Entre na agência para continuar.'},401);
  const store=d1Store(db,userId);
  if(request.method==='GET')return json(await store.read());
  if(request.method!=='PUT')return json({error:'Método inválido.'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON.'},415);
  const limit=8*1024*1024;
  if(Number(request.headers.get('content-length'))>limit)return json({error:'Registro muito grande.'},413);
  const reader=request.body?.getReader();if(!reader)return json({error:'Registro vazio.'},400);
  const decoder=new TextDecoder();let body='',bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();return json({error:'Registro muito grande.'},413)}body+=decoder.decode(value,{stream:true})}body+=decoder.decode();}catch{return json({error:'Não foi possível ler o registro.'},400)}
  let data;try{data=JSON.parse(body)}catch{return json({error:'JSON inválido.'},400)}
  if(!validWorkspace(data?.state)||!Number.isInteger(data.expectedRevision)||data.expectedRevision<0)return json({error:'Registro inválido.'},400);
  const revision=await store.write(data.state,data.expectedRevision);
  return revision===null?json({error:'Outra sessão atualizou este registro.'},409):json({revision});
}
