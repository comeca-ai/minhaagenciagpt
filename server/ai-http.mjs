import {budget,fail} from './ai-budget.mjs';
import {prepareRun,executeRun,publicRun} from './ai-engine.mjs';

const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function agentsResponse(request,{owner,store,workspace,key,initialMicros=0,initialRuns=0,limitMicros=1_000_000,execute=executeRun}) {
  if(!owner)return json({error:'Entre na agência para continuar.'},401);
  const ledgerOptions={initialMicros,initialRuns,limitMicros};
  try {
    if(request.method==='GET') {
      const taskId=new URL(request.url).searchParams.get('task');
      const runs=(await store.runs(owner)).filter(r=>!taskId||r.taskId===taskId).map(publicRun);
      return json({available:!!key,budget:await budget(store,ledgerOptions).summary(),runs});
    }
    if(request.method!=='POST')return json({error:'Método inválido.'},405);
    if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Use JSON.'},415);
    const reader=request.body?.getReader();if(!reader)throw fail('Pedido vazio.',400);
    const chunks=[];let bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2048){await reader.cancel();throw fail('Pedido muito grande.',413);}chunks.push(value);}
    const joined=new Uint8Array(bytes);let at=0;for(const c of chunks){joined.set(c,at);at+=c.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(joined));}catch{throw fail('Pedido inválido.',400);}
    const prepared=await prepareRun({store,workspace:(await workspace.read()).state,owner,taskId:body.taskId,requestId:body.requestId,key,ledgerOptions});
    if(prepared.existing)return json({run:publicRun(prepared.run),existing:true});
    const encoder=new TextEncoder(),controller=new AbortController();
    const stream=new ReadableStream({
      start(output) {
        let closed=false;
        const send=event=>{if(!closed)try{output.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));}catch{closed=true;controller.abort();}};
        const heartbeat=setInterval(()=>{if(!closed)try{output.enqueue(encoder.encode(': executando\n\n'));}catch{closed=true;controller.abort();}},10000);
        send({run:publicRun(prepared.run)});
        execute({...prepared,store,key,signal:AbortSignal.any([request.signal,controller.signal]),onUpdate:run=>send({run})})
          .then(async()=>send({budget:await prepared.ledger.summary(),done:true}))
          .catch(()=>send({error:'A conexão foi interrompida. Consulte os registros antes de iniciar outro teste.'}))
          .finally(()=>{clearInterval(heartbeat);if(!closed){closed=true;try{output.close();}catch{}}});
      },
      cancel(){controller.abort();}
    });
    return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
  }catch(error){return json({error:error.publicMessage||'Não foi possível preparar a execução. Consulte os registros antes de tentar novamente.'},error.status||503);}
}
