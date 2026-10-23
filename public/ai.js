'use strict';
window.JhonemeAI=(()=>{
 const cache=new Map(),loading=new Set(),active=new Map(),errors=new Map();let ledger=null,available=null;
 const money=n=>'US$ '+((n||0)/1e6).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:4});
 const done=r=>r&&['completed','partial','failed','timeout','cancelled','needs_input'].includes(r.status);
 const labels={running:'Em execução',completed:'Pronta para sua revisão',partial:'Entrega com pendências',failed:'Execução interrompida',timeout:'Prazo encerrado',cancelled:'Execução interrompida',needs_input:'Precisa da sua orientação'};
 function card(id){return `<section class="panel ai-panel" data-ai-panel="${esc(id)}">${content(id)}</section>`;}
 function content(id){
  const runs=cache.get(id)||[],r=runs[0],busy=active.has(id)||r&&!done(r),b=ledger;
  const startButton=`<button class="btn ${r?'':'primary'}" data-ai="start" data-id="${esc(id)}" ${busy||available!==true||!b||b.remainingMicros<1000||b.runs>=10?'disabled':''}>${ico('spark')}${r?'Produzir nova versão':'Iniciar produção'} · até US$ 0,10</button>`;
  return `<div class="section-heading"><div><span class="eyebrow">02 / SUA EQUIPE EM AÇÃO</span><h2>${r?esc(labels[r.status]||'Preparando'):'A diretora assume daqui.'}</h2></div>${busy?'<span class="ai-live working" role="status">● EM PRODUÇÃO</span>':''}</div><div class="ai-budget-line"><span>${b?money(b.remainingMicros):'Consultando saldo…'} disponíveis</span><small>Piloto de US$ 1 · ${b?b.runs:0}/10 execuções</small></div>${!r?'<p>A diretora escolhe até três criadores, distribui o trabalho e revisa a entrega dentro do seu prazo.</p>':''}${!r||busy?`<div class="ai-controls">${!busy?startButton:''}${active.has(id)?`<button class="btn" data-ai="stop" data-id="${esc(id)}">Interromper produção</button>`:''}</div>`:''}${available===false?'<p class="form-alert">A credencial de IA precisa ser configurada no servidor.</p>':''}${b&&(b.runs>=10||b.remainingMicros<1000)?'<p class="ai-notice">O limite deste piloto foi atingido. As entregas continuam disponíveis.</p>':''}${errors.get(id)?`<p class="form-alert" role="alert">${esc(errors.get(id))}</p>`:''}${!r||busy?'<p class="ai-connection">Mantenha esta aba aberta durante a produção. Fechar a conexão pode interromper o trabalho; os registros ficam salvos.</p>':''}${r?runView(r):''}<details class="ai-accounting"><summary>Consumo e detalhes da execução</summary><p>Contabilizado: ${b?money(b.chargedMicros):'—'} · Reservado: ${b?money(b.reservedMicros):'—'}. Limite de US$ 0,10 por execução, compartilhado pela equipe. Estimativa conservadora; a cobrança final consta na OpenAI.</p><p>Coordenação pelo OpenAI Agents SDK. ${r?`${esc(r.model)} · ${esc(r.promptVersion)} · ${esc(r.id)}`:''}</p><button class="text-link" data-ai="refresh" data-id="${esc(id)}">Consultar estado salvo</button></details>${r&&!busy?`<div class="ai-controls">${startButton}</div>`:''}`;
 }
 function runView(r){
  const steps=r.steps||[],personFor=id=>r.people.find(p=>p.id===id),t=taskById(r.taskId);
  const material=t?.aiRunId===r.id?t.result:r.material;
  const participants=[r.director,...(r.plan?.assignments||[]).map(a=>personFor(a.agentId))].filter(Boolean);
  const status=s=>({running:'Trabalhando',completed:'Concluído',failed:'Interrompido'}[s]||s);
  const faces=participants.map(p=>{const local=person(p.id);return `<div><img src="${local?personImage(local):'assets/marina.png'}" alt=""><span><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></span></div>`;}).join('');
  return `<div class="ai-run"><div class="ai-crew">${faces}</div><div class="ai-run-heading" role="status"><strong>${esc(r.phase)}</strong><small>Prazo: ${esc(new Date(r.deadlineAt).toLocaleTimeString('pt-BR'))} · ${money(r.cost.chargedMicros+r.cost.reservedMicros)}</small></div>${r.message?`<p class="ai-notice">${esc(r.message)}</p>`:''}${r.cost.uncertain?'<p class="small muted">Há consumo sem confirmação. A reserva foi mantida; nenhuma geração será repetida automaticamente.</p>':''}${r.plan?.toolRequests.length?`<div class="ai-notice"><strong>A diretora precisa de você</strong>${r.plan.toolRequests.map(t=>`<p><b>${esc(t.tool)}</b> · ${t.essential?'indispensável':'opcional'}<br>${esc(t.reason)}</p>`).join('')}<small>Inclua as fontes no briefing ou solicite a integração da ferramenta antes de uma nova execução.</small><div><button class="text-link" data-agency="edit-task" data-id="${esc(r.taskId)}">Complementar briefing</button></div></div>`:''}${r.material?`<section class="ai-delivery"><span class="eyebrow">03 / SUA ENTREGA</span><div class="result-copy">${esc(material)}</div><div class="ai-controls">${t?.status==='Entregue'?'<span class="ai-approved">✓ Entrega aprovada por você</span>':`<button class="btn primary" data-ai="approve" data-id="${esc(r.taskId)}" ${!done(r)||!t||t.aiRunId!==r.id||!evalsComplete(t)?'disabled':''}>${ico('check')}Aprovar entrega</button>`}<button class="btn" data-agency="task-result" data-id="${esc(r.taskId)}">Revisar e editar</button><button class="text-link" data-ai="download" data-id="${esc(r.taskId)}">${ico('download')}Baixar</button></div>${done(r)&&t&&!evalsComplete(t)?'<p class="small muted">Há avaliações pendentes ou correções apontadas abaixo. A entrega segue em revisão.</p>':''}</section>`:''}${r.evaluations.length?`<details class="ai-evals" ${r.status==='partial'?'open':''}><summary>Avaliações da equipe · ${r.evaluations.filter(e=>e.decision==='approved').length}/${r.evaluations.length} atendem à régua</summary><p class="small muted">Avaliação por IA da versão produzida. A aprovação final da entrega é sua.</p>${r.evaluations.map(e=>`<article><div><strong>${esc(personFor(e.agentId)?.name||e.agentId)}</strong><b>${(Object.values(e.scores).reduce((a,b)=>a+b,0)/6).toFixed(1)}/5</b></div><p>${esc(e.evidence)}</p><small>${esc(e.improvement)} · ${e.decision==='approved'?'Atende à régua':e.decision==='partial'?'Parcial':'Requer correção'}</small></article>`).join('')}</details>`:''}<details class="ai-process" ${!done(r)?'open':''}><summary>Como a diretora conduziu o trabalho</summary>${r.plan?`<p>${esc(r.plan.summary)}</p><small>${r.plan.mode==='parallel'?'Produção em paralelo':'Repasses em sequência'}</small>`:''}<ol class="ai-timeline">${steps.map(s=>`<li class="${esc(s.status)}"><span class="ai-step-dot"></span><div><strong>${esc(s.name)} <small>${esc(s.stage)}</small></strong><p>${status(s.status)}${s.finishedAt?' · '+esc(new Date(s.finishedAt).toLocaleTimeString('pt-BR')):''}</p>${s.output?`<details><summary>Ver repasse e prompt</summary><pre>${esc(s.output)}</pre><h4>Prompt desta rodada</h4><pre>${esc(s.prompt)}</pre></details>`:''}</div></li>`).join('')}</ol></details></div>`;
 }
 function refreshDOM(id){const el=document.querySelector('[data-ai-panel="'+CSS.escape(id)+'"]');if(el)el.innerHTML=content(id);}
 function receive(r){
  const runs=cache.get(r.taskId)||[];cache.set(r.taskId,[r,...runs.filter(x=>x.id!==r.id)]);
  if(done(r)&&r.material&&window.agencySync?.ready&&!window.agencySync.blocked){
   const t=taskById(r.taskId),s=r.source;
   if(t&&t.aiRunId!==r.id&&t.brief===s.brief&&t.director===s.director&&t.project===s.project&&t.minutes===s.minutes&&t.format===s.format&&JSON.stringify(t.strategy||{})===s.strategy&&r.plan.assignments.every(a=>person(a.agentId))){
    t.result=r.material;t.plan=r.plan.summary;t.creators=r.plan.assignments.map(a=>a.agentId);t.status='Em revisão';t.aiRunId=r.id;
    t.execution={reviewMinutes:Math.max(1,Math.floor(t.minutes*.25)),mode:r.plan.mode,startedAt:r.createdAt,deadlineAt:r.deadlineAt,handoffs:[],evals:r.evaluations.map(e=>({rubricVersion:2,agent:e.agentId,scores:e.scores,evidence:e.evidence||'Evidência não fornecida.',comment:e.improvement,decision:e.decision,critical:e.critical,createdAt:e.createdAt,promptVersion:r.promptVersion,reviewer:'IA'}))};
    persist('Recebeu material da execução de IA: '+t.title);
   }
  }
  refreshDOM(r.taskId);
 }
 async function load(id){
  if(loading.has(id))return;loading.add(id);
  try{const res=await fetch('/api/agents?task='+encodeURIComponent(id),{credentials:'same-origin'}),data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível consultar a execução.');available=data.available;ledger=data.budget;cache.set(id,data.runs);if(data.runs[0])receive(data.runs[0]);}
  catch(e){errors.set(id,e.message);}finally{loading.delete(id);refreshDOM(id);}
 }
 async function start(id){
  if(active.has(id)||!window.agencySync)return;
  const controller=new AbortController();active.set(id,controller);errors.delete(id);refreshDOM(id);
  if(!await window.agencySync.flush()){active.delete(id);refreshDOM(id);toast('Aguarde o salvamento do desafio.');return;}
  if(controller.signal.aborted){active.delete(id);refreshDOM(id);return;}
  // One request ID is retained after transport failures, so retrying cannot regenerate blindly.
  const storageKey='jhoneme-ai-request:'+id;
  let requestId;try{requestId=sessionStorage.getItem(storageKey);}catch{}if(!requestId){requestId=crypto.randomUUID();try{sessionStorage.setItem(storageKey,requestId);}catch{}}
  try{
   const res=await fetch('/api/agents',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:id,requestId}),signal:controller.signal});
   if(!res.ok){const data=await res.json();throw Error(data.error||'Não foi possível iniciar.');}
   if(res.headers.get('content-type')?.includes('application/json')){const data=await res.json();if(data.run)receive(data.run);}
   else{const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';while(true){const {done:ended,value}=await reader.read();if(ended)break;buffer+=decoder.decode(value,{stream:true});let index;while((index=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,index);buffer=buffer.slice(index+2);if(!event.startsWith('data: '))continue;const data=JSON.parse(event.slice(6));if(data.run)receive(data.run);if(data.budget)ledger=data.budget;if(data.error)errors.set(id,data.error);}}}
  }catch(e){errors.set(id,e.name==='AbortError'?'Interrupção solicitada. Consultando o que foi preservado…':e.message);}
  finally{active.delete(id);await load(id);if(done(cache.get(id)?.[0])){try{sessionStorage.removeItem(storageKey);}catch{}}render();}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ai]');if(!b)return;const id=b.dataset.id;if(b.dataset.ai==='start')start(id);if(b.dataset.ai==='refresh'){errors.delete(id);load(id);}if(b.dataset.ai==='approve'){const t=taskById(id),r=cache.get(id)?.[0];if(t&&r&&done(r)&&t.aiRunId===r.id&&evalsComplete(t)){t.status='Entregue';persist('Aprovou entrega: '+t.title);render();toast('Entrega aprovada e registrada.');}}if(b.dataset.ai==='stop')active.get(id)?.abort();if(b.dataset.ai==='download'){const r=cache.get(id)?.[0];if(r)download('jhoneme-entrega-'+r.id+'.md','# '+r.title+'\n\n'+(taskById(id)?.aiRunId===r.id?taskById(id).result:r.material)+'\n\n## Avaliações por IA\n\n'+r.evaluations.map(e=>'### '+(r.people.find(p=>p.id===e.agentId)?.name||e.agentId)+'\n'+JSON.stringify(e.scores)+'\n'+e.evidence+'\n'+e.improvement).join('\n\n')+'\n\nExecução: '+r.id+'\nContabilizado: '+money(r.cost.chargedMicros),'text/markdown');}});
 setInterval(()=>{document.querySelectorAll('[data-ai-panel]').forEach(el=>{const id=el.dataset.aiPanel,r=cache.get(id)?.[0];if(r&&!done(r)&&!active.has(id))load(id);});},10000);
 return {card,start,mount(){document.querySelectorAll('[data-ai-panel]').forEach(el=>{const id=el.dataset.aiPanel;if(!cache.has(id))load(id);});}};
})();
