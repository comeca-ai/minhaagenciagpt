const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'../public');
function boot(saved){
 const elements=new Map(),handlers=new Map(),storage=new Map();if(saved)storage.set('agencia-jhonata-workspace-v1',JSON.stringify(saved));
 const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)};
 const context={structuredClone,URL,Blob,FormData,setTimeout(){},clearTimeout(){},crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,addEventListener(event,fn){if(!handlers.has(event))handlers.set(event,[]);handlers.get(event).push(fn)}},window:{scrollTo(){},addEventListener(){}},location:{hash:''},console};
 vm.createContext(context);for(const f of ['studio.js','agency.js','intake.js','advisor.js','direction.js','prompts.js','quality.js','setup.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
 const run=s=>vm.runInContext(s,context);return {run,el,storage,handlers};
}
const {run,el,storage,handlers}=boot();
assert.equal(run('isState(initial)'),true);
assert.equal(run('isState(state)'),true);
for(const page of ['reception','setup','team','room','projects','tasks','approvals','overview','map','agents','flows','adjustments','settings']){run(`nav('${page}')`);assert.ok(el('app').innerHTML.includes('<main'),page);assert.ok(!el('app').innerHTML.includes('undefined'),page);}
// Old backups remain usable without replacing any user customization.
const legacy=run('structuredClone(initial)');legacy.areas[0].name='Direção escolhida pelo usuário';
const migrated=boot(legacy);assert.equal(migrated.run('state.areas[0].name'),'Direção escolhida pelo usuário');assert.equal(migrated.run('state.studio.people.length'),5);assert.equal(migrated.run('state.studio.tasks.length'),0);
// Capture form submission logic without a browser to exercise business validation.
run("let captured;studioForm=(title,label,body,submit)=>{captured={title,label,body,submit};return {}};");
run("state.studio.people.find(p=>p.id==='marina').status='Aprovado';taskForm();");
assert.ok(run('captured.body').includes('Prazo total'));
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
// New contracts preserve old records while requiring explicit, evidenced approval.
run("taskForm(studio().tasks[0].id)");
const existingId=run('studio().tasks[0].id');
const edit=run('captured.submit');
assert.ok(edit(form({...data,title:'Estratégia teste',duration:'120','strategy-kind':'strategy','strategy-offer':'Assinatura mensal','strategy-channel':'Newsletter','strategy-metric':'Assinaturas pagas confirmadas'})).action);
assert.equal(run('studio().tasks[0].strategy.kind'),'strategy');
let generated=run("promptFor(studio().tasks[0],'caio',40)");
assert.ok(generated.includes('Assinatura mensal'));
assert.ok(generated.includes('Newsletter'));
assert.ok(generated.includes('MONETIZAÇÃO:'));
assert.ok(generated.includes('jhoneme-agency-2.1'));
run("studio().tasks[0].strategy.kind='editorial'");
assert.ok(run("promptFor(studio().tasks[0],'caio',40)").includes('independência editorial'));
run("studio().tasks[0].brief='b'.repeat(10000);studio().tasks[0].strategy.sources='s'.repeat(10000)");
assert.ok(run("promptFor(studio().tasks[0],'caio',40).length")<30000);
assert.equal(run("(()=>{const t=structuredClone(studio().tasks[0]);t.strategy.kind='invented';return strategyValid(t)})()"),false);
run('evalForm(studio().tasks[0].id)');
const evaluate=run('captured.submit');
const evalInput={agent:'caio','score-objective':'4','score-quality':'4','score-evidence':'4',evidence:'Trecho factual conferido','score-format':'4','score-timing':'4','score-business':'4',comment:'Testar oferta real',decision:'approved',critical:'facts'};
// Evidence text and precision score have separate names in the form.
assert.ok(evaluate(form(evalInput)).error);
assert.ok(evaluate(form({...evalInput,decision:'revise'})).action);
assert.equal(run('evalsComplete(studio().tasks[0])'),false);
assert.equal(run('studio().tasks[0].status'),'Em revisão');
assert.ok(evaluate(form({...evalInput,critical:'none'})).action);
assert.equal(run('evalsComplete(studio().tasks[0])'),true);
assert.ok(run("promptFor(studio().tasks[0],'caio',40)").includes('Testar oferta real'));
assert.equal(run('isState(state)'),true);
assert.ok(run('taskExport(studio().tasks[0])').includes('Público, distribuição e negócio'));
// Director replacement preserves deadlines, prior evidence and other projects.
run("studio().people.push({...structuredClone(person('marina')),id:'nova-diretora',name:'Nova diretora',capacity:2,status:'Aprovado'});studio().tasks[0].status='Em criação';const windowStart=new Date().toISOString();studio().tasks[0].execution.startedAt=windowStart;studio().tasks[0].execution.deadlineAt=new Date(Date.parse(windowStart)+studio().tasks[0].minutes*60000).toISOString();");
const originalDeadline=run('studio().tasks[0].execution.deadlineAt');
const originalEvaluations=run('studio().tasks[0].execution.evals.length');
const originalPrompts=run('studio().tasks[0].execution.handoffs.map(h=>h.prompt).join()');
assert.ok(run("changeProjectDirector('pr-isenta','marina','','Encerrar vínculo',false)").error);
assert.equal(run("personOnProject(person('marina'),'pr-isenta')"),true);
assert.ok(run("changeProjectDirector('pr-isenta','marina','nova-diretora','Nova direção criativa',true)").action);
assert.equal(run('studio().tasks[0].director'),'nova-diretora');
assert.equal(run('studio().tasks[0].execution.deadlineAt'),originalDeadline);
assert.equal(run('studio().tasks[0].execution.evals.length'),originalEvaluations);
assert.equal(run('studio().tasks[0].directorHistory[0].handoffs.map(h=>h.prompt).join()'),originalPrompts);
assert.equal(run("personOnProject(person('marina'),'pr-isenta')"),false);
assert.equal(run("personOnProject(person('marina'),'pr-paraibao')"),true);
assert.equal(run('evalsComplete(studio().tasks[0])'),false);
assert.equal(run('isState(state)'),true);
assert.ok(run('taskExport(studio().tasks[0])').includes('Direção anterior: Marina'));
run("projectDirection('pr-isenta')");assert.ok(run('captured.body').includes('Avaliar uma entrega'));
const badDirection=run("(()=>{const s=structuredClone(state);s.studio.tasks={};return isState(s)})()");assert.equal(badDirection,false);
// Advisor migration is idempotent and consultation does not enter production.
assert.equal(run("studio().people.filter(p=>p.id==='nizan-advisor').length"),1);
run('ensureAdvisor(studio())');assert.equal(run("studio().people.filter(p=>p.id==='nizan-advisor').length"),1);
assert.equal(run("personOnProject(person('nizan-advisor'),'pr-paraibao')"),true);
run('taskPlan(studio().tasks[0].id)');assert.ok(!run('captured.body').includes('value="nizan-advisor"'));
const beforeAdvisorDirector=run('studio().tasks[0].director');
run("callAdvisor('pr-paraibao')");
assert.equal(run('studio().meetings[0].project'),'pr-paraibao');
assert.equal(run('studio().meetings[0].participants.join()'),'nizan-advisor');
assert.equal(run('studio().meetings[0].entries.length'),0);
assert.equal(run('studio().tasks[0].director'),beforeAdvisorDirector);
assert.ok(run('meetingExport(studio().meetings[0])').includes('Não entra automaticamente'));
assert.equal(run('isState(state)'),true);
// The shorter flow preserves old progress and blocks production until a request exists.
const guided=boot();guided.run("nav('setup')");
assert.equal(guided.run('setupReady(0)'),false);
assert.equal(guided.run('setupGo(1)'),false);
assert.equal(guided.run('setupSteps.length'),3);
guided.run("studio().setup={step:4,project:'pr-isenta',task:''};setupOf()");
assert.equal(guided.run('setupOf().step'),1);
assert.equal(guided.run('setupOf().version'),2);
assert.equal(guided.run('isState(state)'),true);
// A single request is enough; title and format are optional, never requested twice.
const slim=boot();slim.run("studio().people.find(p=>p.id==='marina').status='Aprovado';let captured;studioForm=(title,label,body,submit)=>{captured={body,submit};return {}};taskForm()");
assert.ok(slim.run('captured.submit')(form({project:'pr-isenta',director:'marina',brief:'Criar três anúncios para captar pedidos de atendimento.',duration:'30',unit:'min'})).action);
assert.equal(slim.run('studio().tasks[0].brief'),'Criar três anúncios para captar pedidos de atendimento.');
assert.equal(slim.run('studio().tasks[0].format'),'Conforme o pedido à diretora');
assert.equal(slim.run('studio().tasks[0].title'),'Criar três anúncios para captar pedidos de atendimento.');
const spoken='Para o Paraibão, quero uma matéria sobre IA. Marina dirige e tem trinta minutos.';
let draft=slim.run(`intakeDraft(${JSON.stringify(spoken)})`);
assert.equal(draft.minutes,30);assert.equal(draft.director,'marina');assert.equal(draft.project,'pr-paraibao');assert.equal(draft.brief,spoken);
draft=slim.run("intakeDraft('Para o Paraibão e o IsentaPCD. Marina tem 30 minutos ou 60 minutos.')");
assert.equal(draft.project,'');assert.equal(draft.minutes,'');assert.ok(draft.warnings.length>=2);
draft=slim.run("intakeDraft('Marina, para o Paraibão quero um vídeo de 3 minutos. Entregue em 45 minutos.')");
assert.equal(draft.minutes,45);
assert.equal(slim.run("intakeDraft('Para o Paraibão, entregar em quarenta e cinco minutos.').minutes"),45);
assert.equal(slim.run("intakeDraft('Entregue em cento e vinte minutos.').minutes"),120);
assert.equal(slim.run("intakeDraft('Entregue em 1,5 horas.').minutes"),90);
assert.equal(slim.run("intakeDraft('Entregue em meia hora.').minutes"),30);
assert.equal(slim.run("intakeDraft('Entregue em uma hora e meia.').minutes"),90);
assert.equal(slim.run("intakeDraft('Um projeto novo, diretora desconhecida, entregar amanhã').project"),'');
assert.equal(slim.run("intakeDraft('Um projeto novo, diretora desconhecida, entregar amanhã').minutes"),'');
console.log('OK — 13 telas; migração sem perda; prazo por tarefa; diretora responsável; limite de 3 criadores; entrega exige material; autorização registrada; exportação; dados inválidos e injeção rejeitados.');
