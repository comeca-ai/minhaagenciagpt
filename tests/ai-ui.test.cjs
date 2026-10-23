const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness({flush=async()=>true,fetch:request}={}){
 const task={id:'t',brief:'Briefing',director:'d',project:'p',minutes:2,format:'Texto',strategy:{},status:'Aguardando direção'},panel={innerHTML:'',dataset:{aiPanel:'t'}},clicks=[],saved=[];
 const c={window:{agencySync:{ready:true,blocked:false,flush}},document:{querySelector:()=>panel,querySelectorAll:()=>[panel],addEventListener:(type,fn)=>clicks.push(fn)},CSS:{escape:x=>x},setInterval(){},fetch:request,crypto:require('node:crypto').webcrypto,AbortController,TextDecoder,sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},taskById:()=>task,person:id=>({id,name:id}),personImage:()=>'',evalsComplete:t=>t.execution?.evals.length===2,esc:v=>String(v).replaceAll('<','&lt;'),ico:()=>'',persist:x=>saved.push(x),toast(){},render(){},download(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('public/ai.js','utf8'),c);return {c,task,panel,saved,clicks};
}
const result=()=>({id:'r',taskId:'t',title:'Entrega',status:'completed',phase:'Finalizado',deadlineAt:new Date(Date.now()+120000).toISOString(),createdAt:new Date().toISOString(),model:'teste',promptVersion:'v1',director:{id:'d',name:'Diretora'},people:[{id:'d',name:'Diretora'},{id:'c',name:'Criadora'}],source:{brief:'Briefing',director:'d',project:'p',minutes:2,format:'Texto',strategy:'{}'},cost:{chargedMicros:10,reservedMicros:0,calls:4},plan:{summary:'Plano',mode:'parallel',assignments:[{agentId:'c'}],toolRequests:[]},steps:[],material:'Material real',evaluations:['d','c'].map(agentId=>({agentId,scores:{objective:4,quality:4,evidence:4,format:4,timing:4,business:4},evidence:'Trecho real',improvement:'Revisar',decision:'approved',critical:'none',createdAt:new Date().toISOString()}))});
const response=data=>({ok:true,json:async()=>data,headers:{get:()=> 'application/json'}});
test('one click persists the real delivery and leaves human approval separate',async()=>{
 const r=result();const h=harness({fetch:async(path,options)=>options?.method==='POST'?response({run:r}):response({available:true,budget:{remainingMicros:999990,runs:1},runs:[r]})});
 await h.c.window.JhonemeAI.start('t');assert.equal(h.task.result,'Material real');assert.equal(h.task.status,'Em revisão');assert.equal(h.saved.length,1);assert.equal(h.task.execution.evals.length,2);assert.match(h.panel.innerHTML,/Aprovar entrega/);
 h.clicks[0]({target:{closest:()=>({dataset:{ai:'approve',id:'t'}})}});assert.equal(h.task.status,'Entregue');
});
test('double click while saving cannot trigger two executions',async()=>{
 let unlock,calls=0;const wait=new Promise(r=>unlock=r);const h=harness({flush:()=>wait,fetch:async(path,options)=>{if(options?.method==='POST')calls++;return response(options?.method==='POST'?{run:result()}:{available:true,budget:{remainingMicros:990000,runs:1},runs:[]})}});
 const first=h.c.window.JhonemeAI.start('t');await h.c.window.JhonemeAI.start('t');assert.equal(calls,0);unlock(true);await first;assert.equal(calls,1);
});
test('a revised briefing cannot be overwritten by an older execution',async()=>{
 const r=result();const h=harness({fetch:async(path,options)=>response(options?.method==='POST'?{run:r}:{available:true,budget:{remainingMicros:990000,runs:1},runs:[r]})});h.task.brief='Novo briefing';await h.c.window.JhonemeAI.start('t');assert.equal(h.task.result,undefined);assert.equal(h.saved.length,0);
});
