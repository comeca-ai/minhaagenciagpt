import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sqliteAIStore} from '../server/ai-store.mjs';
import {budget,estimateRequest,MODEL} from '../server/ai-budget.mjs';
import {prepareRun,executeRun} from '../server/ai-engine.mjs';
import {agentsResponse} from '../server/ai-http.mjs';
import {meteredModel} from '../server/ai-model.mjs';

const fixture=()=>({studio:{projects:[{id:'p',name:'Jornal',description:'',audience:'',tone:'Direto',notes:''}],people:[{id:'d',name:'Marina',role:'Diretora',status:'Aprovado',projects:[],capacity:1},{id:'c',name:'Caio',role:'Redator',status:'Em definição',projects:[],capacity:1}],tasks:[{id:'t',title:'Texto de teste',brief:'Escreva um texto sobre revisar textos.',project:'p',director:'d',minutes:2,format:'Texto curto'}]}});
function setup(t){const db=new DatabaseSync(':memory:'),store=sqliteAIStore(db);t.after(()=>db.close());return {db,store};}
const director={id:'d',name:'Marina',capacity:10};
async function claim(ledger,id='r',owner='u',taskId=id){return ledger.claim({id,owner,taskId,requestId:'request-'+id,deadline:Date.now()+60000,director});}

test('one dollar remains shared and atomic across simultaneous directors and restarts',async t=>{
 const {store}=setup(t),ledger=budget(store);
 for(let n=0;n<10;n++)await claim(ledger,'r'+n);
 const reservations=await Promise.allSettled(Array.from({length:20},(_,n)=>ledger.reserve('r'+(n%10),'call'+n,100000)));
 assert.equal(reservations.filter(r=>r.status==='fulfilled').length,10);
 assert.equal((await budget(store).summary()).remainingMicros,0);
 await assert.rejects(ledger.reserve('r0','overflow',1));
 await assert.rejects(claim(ledger,'eleventh'));
});
test('settlement is idempotent and unknown charges stay counted',async t=>{
 const {store}=setup(t),ledger=budget(store);await claim(ledger);
 await ledger.reserve('r','c',10000);await ledger.settle('c',null);await ledger.settle('c',0);
 assert.equal((await ledger.summary()).chargedMicros,10000);
 assert.equal((await ledger.runCost('r')).uncertain,true);
});
test('same request reuses run and capacity follows contracted profile',async t=>{
 const {store}=setup(t),ledger=budget(store),p={...director,capacity:1};
 const first={id:'one',owner:'u',taskId:'t',requestId:'request-one',deadline:Date.now()+60000,director:p};
 await ledger.claim(first);
 assert.equal((await ledger.claim({...first,id:'other'})).id,'one');
 await assert.rejects(ledger.claim({...first,id:'two',taskId:'other',requestId:'request-two'}),/capacidade/);
 await ledger.finish('one');await ledger.claim({...first,id:'two',taskId:'other',requestId:'request-two'});
});
test('expired tasks and paid tools cannot reach provider',async t=>{
 const {store}=setup(t),ledger=budget(store,{clock:()=>200});
 await ledger.claim({id:'r',owner:'u',taskId:'t',requestId:'request-one',deadline:100,director});
 await assert.rejects(ledger.reserve('r','x',5000),/prazo/);
 assert.throws(()=>estimateRequest({model:MODEL,tools:[{type:'web_search'}],max_output_tokens:100}));
 assert.throws(()=>estimateRequest({model:'expensive',max_output_tokens:100}));
 assert.throws(()=>estimateRequest({model:MODEL,max_output_tokens:9000}));
});
test('real SDK transport accounts usage and rejects repeated network traffic',async t=>{
 const {store}=setup(t),ledger=budget(store);await claim(ledger);let calls=0;
 const model=meteredModel({key:'sk-test',ledger,runId:'r',fetchImpl:async(url,init)=>{
  calls++;const body=JSON.parse(init.body);assert.equal(body.model,MODEL);assert.equal(body.store,false);assert.ok(body.max_output_tokens<=6000);
  return Response.json({id:'resp_test',object:'response',created_at:1,status:'completed',model:MODEL,output:[{type:'message',id:'msg_test',role:'assistant',status:'completed',content:[{type:'output_text',text:'Material produzido.',annotations:[]}]}],usage:{input_tokens:100,output_tokens:20,total_tokens:120},parallel_tool_calls:false,tools:[],metadata:{}});
 }});
 assert.equal(await model({name:'Criadora',instructions:'Produza texto.',input:'Um título.',maxTokens:100}),'Material produzido.');
 assert.equal(calls,1);assert.equal((await ledger.summary()).chargedMicros,35);
});
test('SDK provider failures are never retried and keep the reservation',async t=>{
 const {store}=setup(t),ledger=budget(store);await claim(ledger);let calls=0;
 const model=meteredModel({key:'sk-test',ledger,runId:'r',fetchImpl:async()=>{calls++;return Response.json({error:{message:'private detail'}},{status:500});}});
 await assert.rejects(model({name:'Diretora',instructions:'Teste',input:'Teste',maxTokens:100}));
 assert.equal(calls,1);assert.ok((await ledger.summary()).chargedMicros>0);
});
test('director delegates fresh prompts and saves material with evaluations',async t=>{
 const {store}=setup(t),prepared=await prepareRun({store,workspace:fixture(),owner:'u',taskId:'t',requestId:'request-one',key:'sk-test'});
 const outputs=[{summary:'Um texto curto.',mode:'parallel',assignments:[{agentId:'c',prompt:'Escreva uma abertura concreta sobre revisão.',minutes:.5}],toolRequests:[]},'Rascunho original.','Material integrado.',{evaluations:['d','c'].map(agentId=>({agentId,scores:{objective:4,quality:4,evidence:4,format:4,timing:4,business:4},evidence:'Há material original.',improvement:'Revisão humana.',decision:'approved',critical:'none'}))}];
 const calls=[];await executeRun({...prepared,store,key:'sk-test',modelFactory:()=>async args=>{calls.push(args);return outputs.shift();}});
 const saved=await store.run(prepared.run.id,'u');assert.equal(saved.status,'completed');assert.equal(saved.material,'Material integrado.');assert.equal(saved.evaluations.length,2);assert.match(calls[1].instructions,/abertura concreta/);assert.equal(calls.length,4);
 assert.equal(await store.run(saved.id,'other'),null);
});
test('essential tool request stops execution before specialists',async t=>{
 const {store}=setup(t),prepared=await prepareRun({store,workspace:fixture(),owner:'u',taskId:'t',requestId:'request-one',key:'sk-test'});let calls=0;
 await executeRun({...prepared,store,key:'sk-test',modelFactory:()=>async()=>{calls++;return {summary:'Faltam dados atuais.',mode:'sequential',assignments:[],toolRequests:[{tool:'Pesquisa',reason:'São necessários dados atuais.',essential:true}]};}});
 assert.equal(prepared.run.status,'needs_input');assert.equal(calls,1);
});
test('agents endpoint requires identity and origin, and never accepts model or budget from client',async t=>{
 const {store}=setup(t),deps={owner:'u',store,workspace:{read:async()=>({state:fixture()})},key:'sk-test'};
 assert.equal((await agentsResponse(new Request('https://studio/api/agents'),{...deps,owner:null})).status,401);
 assert.equal((await agentsResponse(new Request('https://studio/api/agents',{method:'POST',headers:{origin:'https://other','content-type':'application/json'},body:'{}'}),deps)).status,403);
 const response=await agentsResponse(new Request('https://studio/api/agents'),deps),data=await response.json();assert.equal(data.budget.limitMicros,1000000);assert.equal(data.available,true);
});

test('technical verification is counted in the shared pilot before any new call',async t=>{
 const {store}=setup(t),ledger=budget(store,{initialMicros:2138,initialRuns:1});
 assert.equal((await ledger.summary()).remainingMicros,997862);
 for(let i=0;i<9;i++)await claim(ledger,'r'+i);
 await assert.rejects(claim(ledger,'last'),/dez testes/);
 assert.equal((await ledger.summary()).runs,10);
});
test('D1 migration and compare-and-swap preserve the same accounting contract',async t=>{
 const {readFileSync}=await import('node:fs');const {d1AIStore}=await import('../server/ai-store.mjs');
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec(readFileSync('drizzle/0001_long_inertia.sql','utf8'));
 const d1={prepare:q=>({bind:(...p)=>({first:async()=>db.prepare(q).get(...p)||null,run:async()=>db.prepare(q).run(...p),all:async()=>({results:db.prepare(q).all(...p)})})})};
 const store=d1AIStore(d1),ledger=budget(store);await claim(ledger);
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>ledger.reserve('r','d1-'+i,20000)));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,5);assert.equal((await ledger.summary()).reservedMicros,100000);
});
test('parallel specialists overlap and still share the absolute deadline',async t=>{
 const {store}=setup(t),workspace=fixture();workspace.studio.people.push({...workspace.studio.people[1],id:'c2',name:'Lia'});
 const prepared=await prepareRun({store,workspace,owner:'u',taskId:'t',requestId:'parallel-test',key:'sk-test'});let active=0,peak=0;
 const modelFactory=()=>async({name})=>{
  if(name.includes('Direção'))return {summary:'Duas partes independentes.',mode:'parallel',assignments:['c','c2'].map(agentId=>({agentId,prompt:'Escreva sua parte.',minutes:.5})),toolRequests:[]};
  if(name.includes('Criação')){active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,15));active--;return 'Parte produzida.';}
  if(name.includes('Integração'))return 'Entrega final.';
  return {evaluations:['d','c','c2'].map(agentId=>({agentId,scores:{objective:4,quality:4,evidence:4,format:4,timing:4,business:4},evidence:'Material presente.',improvement:'Revisão humana.',decision:'approved',critical:'none'}))};
 };
 await executeRun({...prepared,store,key:'sk-test',modelFactory});assert.equal(peak,2);assert.equal(prepared.run.status,'completed');
 assert.ok(prepared.run.steps.every(s=>Date.parse(s.deadlineAt)<=Date.parse(prepared.run.deadlineAt)));
});
test('an expired shared deadline prevents calls while preserving the run',async t=>{
 const {store}=setup(t),prepared=await prepareRun({store,workspace:fixture(),owner:'u',taskId:'t',requestId:'expired-test',key:'sk-test'});let calls=0;
 prepared.run.deadlineAt=new Date(Date.now()-1).toISOString();
 await executeRun({...prepared,store,key:'sk-test',modelFactory:()=>async()=>{calls++;return '';}});
 assert.equal(calls,0);assert.equal(prepared.run.status,'timeout');assert.equal((await store.run(prepared.run.id,'u')).status,'timeout');
});
test('SSE stores the completed run and a repeated POST cannot execute twice',async t=>{
 const {store}=setup(t);let calls=0;
 const deps={owner:'u',store,workspace:{read:async()=>({state:fixture()})},key:'sk-test',execute:async({run,store,ledger,onUpdate})=>{calls++;run.status='completed';run.material='Teste';await store.saveRun(run);await ledger.finish(run.id);await onUpdate({...run,snapshot:undefined});}};
 const request=()=>new Request('https://studio/api/agents',{method:'POST',headers:{origin:'https://studio','content-type':'application/json'},body:JSON.stringify({taskId:'t',requestId:'sse-test-001'})});
 const first=await agentsResponse(request(),deps);assert.match(first.headers.get('content-type'),/event-stream/);assert.match(await first.text(),/"done":true/);
 const second=await agentsResponse(request(),deps);assert.equal((await second.json()).existing,true);assert.equal(calls,1);
});
