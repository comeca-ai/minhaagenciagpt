'use strict';
function personOnProject(p,id){return !!p&&(p.kind==='advisor'||!(p.excludedProjects||[]).includes(id)&&(!p.projects.length||p.projects.includes(id)))}
function previousDirectors(t){return (t.directorHistory||[]).map(h=>h.agent)}
function directionValid(s){
 if(s.tasks!==undefined&&!Array.isArray(s.tasks))return false;
 const personExists=id=>s.people.some(p=>p.id===id),projectExists=id=>s.projects.some(p=>p.id===id),time=v=>typeof v==='string'&&!Number.isNaN(Date.parse(v));
 return s.people.every(p=>p.excludedProjects===undefined||Array.isArray(p.excludedProjects)&&p.excludedProjects.length<=200&&p.excludedProjects.every(projectExists))&&s.projects.every(p=>(p.directorId===undefined||p.directorId===''||personExists(p.directorId))&&(p.directionHistory===undefined||Array.isArray(p.directionHistory)&&p.directionHistory.length<=100&&p.directionHistory.every(h=>h&&(!h.from||personExists(h.from))&&(!h.to||personExists(h.to))&&typeof h.reason==='string'&&h.reason.length<=10000&&time(h.createdAt)&&Array.isArray(h.tasks)&&h.tasks.every(id=>(s.tasks||[]).some(t=>t.id===id)))))&&(s.tasks||[]).every(t=>t.directorHistory===undefined||Array.isArray(t.directorHistory)&&t.directorHistory.length<=100&&t.directorHistory.every(h=>h&&personExists(h.agent)&&time(h.replacedAt)&&typeof h.reason==='string'&&h.reason.length<=10000&&typeof h.plan==='string'&&h.plan.length<=10000&&Array.isArray(h.handoffs)&&h.handoffs.length<=3&&h.handoffs.every(x=>x&&personExists(x.agent)&&Number.isInteger(x.minutes)&&x.minutes>0&&typeof x.prompt==='string'&&x.prompt.length<=30000)));
}
function projectDirection(id){
 const pr=project(id);if(!pr)return;
 const tasks=studio().tasks.filter(t=>t.project===id);
 const current=pr.directorId||tasks.find(t=>t.status!=='Entregue'&&personOnProject(person(t.director),id))?.director||'';
 const leads=[...new Set([current,...tasks.map(t=>t.director),...(pr.directionHistory||[]).flatMap(h=>[h.from,h.to])])].filter(Boolean);
 const roster=leads.map(pid=>{const p=person(pid);const evals=tasks.flatMap(t=>(t.execution?.evals||[]).filter(e=>e.agent===pid).map(e=>({task:t,e})));const latest=evals.at(-1);return `<article class="direction-person"><img src="${personImage(p)}" alt="Retrato fictício de ${esc(p.name)}"><div><strong>${esc(p.name)}</strong><small>${personOnProject(p,id)?'Participação permitida':'Desligada deste projeto'} · ${evals.length} avaliação(ões)</small>${latest?`<p>${esc(latest.e.comment||latest.e.evidence)}</p>`:'<p>Sem avaliação registrada para este projeto.</p>'}</div></article>`}).join('');
 const history=(pr.directionHistory||[]).slice().reverse().map(h=>`<p class="direction-event"><strong>${esc(h.from?person(h.from).name:'Sem titular')} → ${esc(h.to?person(h.to).name:'Sem substituta')}</strong><br>${esc(h.reason)}<br><small>${esc(dateLabel(h.createdAt))} · ${h.tasks.length} pauta(s) transferida(s)</small></p>`).join('');
 const body=`<p class="form-context">Avalie entregas reais, escolha a direção do projeto e registre uma troca. Outras marcas e trabalhos concluídos são preservados.</p>${roster}<h3>Avaliar uma entrega</h3>${tasks.length?tasks.map(t=>`<button type="button" class="btn direction-task" data-quality="eval" data-id="${esc(t.id)}">${ico('pen')}${esc(t.title)} · ${esc(person(t.director).name)}</button>`).join(''):'<p class="small muted">Crie uma pauta para registrar a avaliação da diretora com evidência da entrega.</p>'}<h3>Definir ou trocar a direção</h3>`+selectField('outgoing','Diretora que deixa o projeto',current,[['','Definir a primeira diretora'],...leads.filter(pid=>personOnProject(person(pid),id)).map(pid=>[pid,person(pid).name])])+selectField('incoming','Diretora que assume','',[['','Desligar sem substituta'],...studio().people.filter(p=>p.status==='Aprovado'&&p.kind!=='advisor').map(p=>[p.id,p.name+' · '+p.role])])+field('reason','Motivo e orientação para a transição','','textarea','O que precisa mudar? O que a próxima diretora deve preservar?',true)+`<label class="direction-transfer"><input type="checkbox" name="transfer" checked> Transferir as pautas abertas da diretora selecionada</label><p class="small muted">A substituta mantém o prazo final e recebe o contexto. Os prompts anteriores ficam no histórico; os novos precisam de revisão. Se houver pautas abertas, a saída exige transferência para uma substituta.</p>${history?'<h3>Histórico de direção</h3>'+history:''}`;
 studioForm('Direção do projeto',pr.name,body,fd=>changeProjectDirector(id,String(fd.get('outgoing')||''),String(fd.get('incoming')||''),String(fd.get('reason')||'').trim(),fd.get('transfer')!==null));
}
function changeProjectDirector(projectId,from,to,reason,transfer){
 const pr=project(projectId),out=person(from),incoming=person(to);
 if(!pr||!reason||reason.length>10000)return {error:'Registre o motivo da mudança.'};
 if(from===to||!from&&!to)return {error:'Escolha uma diretora diferente para assumir ou uma diretora para desligar.'};
 if(from&&(!out||!personOnProject(out,projectId)))return {error:'A diretora selecionada já não participa deste projeto.'};
 if(to&&(!incoming||incoming.status!=='Aprovado'||incoming.kind==='advisor'))return {error:'Aprove a contratação da substituta antes de escolhê-la.'};
 const open=studio().tasks.filter(t=>t.project===projectId&&t.director===from&&t.status!=='Entregue');
 if(open.length&&(!to||!transfer))return {error:'Há pautas abertas. Escolha uma substituta e transfira essas pautas antes de desligar a diretora.'};
 if(open.some(t=>t.creators.includes(to)))return {error:'A substituta já está como criadora em uma pauta. Ajuste essa equipe antes da troca.'};
 if((pr.directionHistory||[]).length>=100||open.some(t=>(t.directorHistory||[]).length>=100))return {error:'Limite de histórico atingido. Exporte os registros antes de continuar.'};
 const active=t=>t.status!=='Entregue'&&t.execution?.startedAt&&Date.parse(t.execution.deadlineAt)>Date.now();
 if(to&&studio().tasks.filter(t=>active(t)&&[t.director,...t.creators].includes(to)).length+open.filter(active).length>(incoming.capacity||1))return {error:'A substituta não tem capacidade contratada para as janelas em andamento.'};
 const now=new Date().toISOString();
 // Validate everything before changing any record.
 if(out)out.excludedProjects=[...new Set([...(out.excludedProjects||[]),projectId])];
 if(incoming){incoming.excludedProjects=(incoming.excludedProjects||[]).filter(id=>id!==projectId);if(incoming.projects.length&&!incoming.projects.includes(projectId))incoming.projects.push(projectId)}
 pr.directorId=to;
 for(const t of open){
  t.directorHistory=t.directorHistory||[];
  t.directorHistory.push({agent:from,replacedAt:now,reason,plan:t.plan,handoffs:structuredClone(t.execution?.handoffs||[])});
  t.director=to;
  if(t.execution)t.execution.handoffs=t.execution.handoffs.map(h=>({...h,prompt:promptFor(t,h.agent,h.minutes)}));
 }
 pr.directionHistory=pr.directionHistory||[];
 pr.directionHistory.push({from,to,reason,createdAt:now,tasks:open.map(t=>t.id)});
 return {action:`Atualizou a direção de ${pr.name}: ${incoming?.name||'sem substituta'}`};
}
function directionExport(t){return (t.directorHistory||[]).map(h=>`### Direção anterior: ${person(h.agent).name}\nSubstituída em: ${h.replacedAt}\nMotivo: ${h.reason}\nPlano anterior: ${h.plan}\n${h.handoffs.map(x=>`Prompt anterior para ${person(x.agent).name}:\n${x.prompt}`).join('\n\n')}`).join('\n\n')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-direction]');if(b)projectDirection(b.dataset.id)});
