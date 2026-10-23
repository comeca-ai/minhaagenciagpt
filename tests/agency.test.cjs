const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
function boot(saved){
 const elements=new Map(),handlers=new Map(),storage=new Map();if(saved)storage.set('agencia-jhonata-workspace-v1',JSON.stringify(saved));
 const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)};
 const context={structuredClone,URL,Blob,FormData,setTimeout(){},clearTimeout(){},crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,addEventListener(event,fn){if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(fn)}},window:{scrollTo(){},addEventListener(){}},location:{hash:''},console};
 vm.createContext(context);for(const f of ['studio.js','agency.js','quality.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
 const run=s=>vm.runInContext(s,context);return {run,el,storage,handlers};
}
const {run,el,storage,handlers}=boot();
assert.equal(run('isState(initial)'),true);
assert.equal(run('isState(state)'),true);
for(const page of ['reception','team','room','projects','tasks','approvals','overview','map','agents','flows','adjustments','settings']){run(`nav('${page}')`);assert.ok(el('app').innerHTML.includes('<main'),page);assert.ok(!el('app').innerHTML.includes('undefined'),page);}
// Old backups remain usable without replacing any user customization.
const legacy=run('structuredClone(initial)');legacy.areas[0].name='Direção escolhida pelo usuário';
const migrated=boot(legacy);assert.equal(migrated.run('state.areas[0].name'),'Direção escolhida pelo usuário');assert.equal(migrated.run('state.studio.people.length'),4);assert.equal(migrated.run('state.studio.tasks.length'),0);
// Capture form submission logic without a browser to exercise business validation.
run("let captured;studioForm=(title,label,body,submit)=>{captured={title,label,body,submit};return {}};");
run("state.studio.people.find(p=>p.id==='marina').status='Aprovado';taskForm();");
assert.ok(run('captured.body').includes('Quanto tempo'));
assert.ok(!run('captured.body').includes('name="creator"'));
function form(data){const f=new FormData();for(const [k,v]of Object.entries(data)){for(const x of Array.isArray(v)?v:[v])f.append(k,x)}return f}
const data={title:'Campanha teste',project:'pr-isenta',director:'marina',brief:'Objetivo real',format:'Um roteiro',duration:'45',unit:'min'};
const submit=run('captured.submit');assert.ok(submit(form({...data,duration:'0'})).error);assert.ok(submit(form({...data,duration:'1.5'})).error);assert.equal(run('studio().tasks.length'),0);
assert.ok(submit(form(data)).action);assert.equal(run('studio().tasks[0].minutes'),45);assert.equal(run('studio().tasks[0].creators.length'),0);assert.equal(run('studio().tasks[0].status'),'Aguardando direção');
run('taskForm()');run('captured.submit')(form({...data,title:'Segundo prazo',duration:'2',unit:'hour'}));assert.equal(run('studio().tasks[0].minutes'),120);
run("studio().people.push({...structuredClone(studio().people[2]),id:'extra',name:'Extra'});taskPlan(studio().tasks[0].id)");
const plan=run('captured.submit');assert.ok(plan(form({creator:['helena','caio','lia','extra'],plan:'Plano',status:'Em criação'})).error);assert.equal(run('studio().tasks[0].creators.length'),0);
assert.ok(plan(form({creator:['caio','lia'],plan:'Redação e design com revisão',status:'Em criação'})).action);assert.equal(run('studio().tasks[0].creators.length'),2);
run('taskResult(studio().tasks[0].id)');assert.ok(run('captured.submit')(form({result:'  ',status:'Entregue'})).error);assert.equal(run('studio().tasks[0].status'),'Em criação');
assert.ok(run('captured.submit')(form({result:'Material efetivamente produzido.',status:'Entregue'})).error);
run("for(const id of ['marina','caio','lia']){const t=studio().tasks[0];executionOf(t).evals.push({agent:id,scores:{objective:4,quality:5,evidence:4,format:5,timing:4},evidence:'Material real revisado',comment:'Manter clareza',createdAt:new Date().toISOString()})}");
run('captured.submit')(form({result:'Material efetivamente produzido.',status:'Entregue'}));assert.equal(run('studio().tasks[0].status'),'Entregue');
run('toolRequest(studio().tasks[0].id)');assert.ok(run('captured.submit')(form({by:'lia',tool:'Ferramenta',reason:'Exportar arte',cost:'R$ 10',impact:'5 minutos'})).action);
assert.equal(run('pendingTools().length'),1);
const taskId=run('studio().tasks[0].id'),requestId=run('studio().tasks[0].requests[0].id');
handlers.get('click').forEach(fn=>fn({target:{closest(sel){return sel==='[data-agency]'?{dataset:{agency:'approve-tool',id:requestId,task:taskId}}:null}}}));
assert.equal(run('pendingTools().length'),0);assert.equal(run('studio().tasks[0].requests[0].status'),'Aprovada');
run("studio().projects[0].archived=true;persist('Verificação');");assert.equal(run('isState(state)'),true);assert.ok(run('taskExport(studio().tasks[0])').includes('R$ 10'));assert.ok(run('summary()').includes('Material efetivamente produzido.'));
assert.equal(JSON.parse(storage.values().next().value).studio.tasks.length,2);
// Rendering remains safe even with hostile input saved in user records.
run("studio().tasks[0].title='<img src=x onerror=alert(1)>';nav('tasks')");assert.ok(el('app').innerHTML.includes('&lt;img'));assert.ok(!el('app').innerHTML.includes('<img src=x'));
for(const attack of ["s.studio.tasks[0].creators=['helena','caio','lia','extra']","s.studio.tasks[0].minutes=-1","s.studio.people[0].photo='javascript:alert(1)'","s.studio.tasks[0].director='absent'","s.studio.tasks[0].result=''","s.studio.tasks[0].requests[0].status='Executed'"]){assert.equal(run(`(()=>{const s=structuredClone(state);${attack};return isState(s)})()`),false,attack)}
assert.equal(run("esc('<script>alert(1)</script>')"),'&lt;script&gt;alert(1)&lt;/script&gt;');
run('qualityForm(studio().tasks[0].id)');const qp=run('captured.submit');assert.ok(qp(form({review:'30','time-caio':'60','time-lia':'60','prompt-caio':'Redigir','prompt-lia':'Desenhar'})).error);assert.ok(qp(form({review:'20','time-caio':'50','time-lia':'50','prompt-caio':'Redigir','prompt-lia':'Desenhar'})).action);assert.equal(run('isState(state)'),true);assert.ok(run("promptFor(studio().tasks[0],'caio',50)").includes('Não reinicie o prazo'));
console.log('OK — 12 telas; migração sem perda; prazo por tarefa; diretora responsável; limite de 3 criadores; entrega exige material; autorização registrada; exportação; dados inválidos e injeção rejeitados.');
