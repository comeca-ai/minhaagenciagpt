export const TOTAL_MICROS=1_000_000;
export const RUN_MICROS=100_000;
export const MODEL='gpt-6-luna';
export const MAX_RUNS=10;
export const INPUT_MAX_MICROS_PER_TOKEN=.25; // Includes the published 12h cache-write ceiling.
export const OUTPUT_MICROS_PER_TOKEN=.5;
export const fail=(message,status=409)=>Object.assign(new Error(message),{status,publicMessage:message});
export const terminal=status=>['completed','partial','failed','timeout','cancelled','needs_input'].includes(status);
export const occupied=(entry,now=Date.now())=>!entry.ended&&entry.deadline>now;
export function totals(value) {
  const calls=Object.values(value.calls);
  const charged=value.initialMicros+calls.reduce((s,c)=>s+(c.settled?c.cost:0),0);
  const reserved=calls.reduce((s,c)=>s+(c.settled?0:c.reserved),0);
  return {limitMicros:value.limitMicros,chargedMicros:charged,reservedMicros:reserved,remainingMicros:Math.max(0,value.limitMicros-charged-reserved),runs:(value.initialRuns||0)+value.runs.length,maxRuns:MAX_RUNS};
}
export function budget(store,{initialMicros=0,initialRuns=0,limitMicros=TOTAL_MICROS,clock=Date.now}={}) {
  if(!Number.isInteger(initialMicros)||initialMicros<0||initialMicros>TOTAL_MICROS)throw Error('Invalid initial accounting');
  if(!Number.isInteger(limitMicros)||limitMicros<0||limitMicros>TOTAL_MICROS)throw Error('Invalid pilot cap');
  if(!Number.isInteger(initialRuns)||initialRuns<0||initialRuns>MAX_RUNS)throw Error('Invalid initial runs');
  const seed=()=>({limitMicros,initialMicros,initialRuns,calls:{},runs:[]});
  async function mutate(fn) {
    for(let i=0;i<25;i++) {
      const current=await store.control(),value=current.value||seed();
      // Configuration may reduce the cap; it cannot silently enlarge an existing pilot.
      value.limitMicros=Math.min(value.limitMicros,limitMicros);
      const result=fn(value);
      if(await store.commit(value,current.revision))return result;
    }
    throw fail('A agência está salvando outra operação. Consulte o estado antes de tentar novamente.',503);
  }
  function checkCapacity(value,runId,owner,people) {
    for(const person of people) {
      const count=value.runs.filter(r=>r.id!==runId&&r.owner===owner&&occupied(r,clock())&&r.agents.includes(person.id)).length;
      if(count>=Math.max(1,Math.min(10,person.capacity||1)))throw fail(person.name+' atingiu a capacidade contratada.');
    }
  }
  return {
    async summary(){return totals((await store.control()).value||seed());},
    claim({id,owner,taskId,requestId,deadline,director}) {
      return mutate(v=>{
        const prior=v.runs.find(r=>r.owner===owner&&r.requestId===requestId);
        if(prior)return {id:prior.id,existing:true};
        if(v.runs.some(r=>r.owner===owner&&r.taskId===taskId&&occupied(r,clock())))throw fail('Este desafio já está em execução.');
        if(totals(v).runs>=MAX_RUNS)throw fail('O lote de dez testes terminou. Avalie as entregas antes de liberar outro lote.');
        if(totals(v).remainingMicros<1000)throw fail('O orçamento de US$ 1 está esgotado ou reservado.');
        checkCapacity(v,id,owner,[director]);
        v.runs.push({id,owner,taskId,requestId,deadline,agents:[director.id],ended:false});
        return {id,existing:false};
      });
    },
    assign(id,owner,people) {
      return mutate(v=>{const r=v.runs.find(r=>r.id===id&&r.owner===owner);if(!r||!occupied(r,clock()))throw fail('Prazo da equipe encerrado.');checkCapacity(v,id,owner,people);r.agents=[...new Set([...r.agents,...people.map(p=>p.id)])];});
    },
    reserve(id,callId,micros) {
      if(!Number.isSafeInteger(micros)||micros<=0)throw fail('Reserva de custo inválida.');
      return mutate(v=>{
        if(v.calls[callId])throw fail('Esta chamada já foi registrada.');
        const r=v.runs.find(r=>r.id===id);
        if(!r||!occupied(r,clock()))throw fail('O prazo global terminou.');
        const runTotal=Object.values(v.calls).filter(c=>c.runId===id).reduce((s,c)=>s+(c.settled?c.cost:c.reserved),0);
        if(runTotal+micros>RUN_MICROS)throw fail('O desafio atingiu o teto de US$ 0,10. O material já produzido foi preservado.');
        if(totals(v).remainingMicros<micros)throw fail('O saldo do lote não cobre esta chamada. O material já produzido foi preservado.');
        v.calls[callId]={runId:id,reserved:micros,settled:false};
      });
    },
    settle(callId,cost,usage=null) {
      return mutate(v=>{const c=v.calls[callId];if(!c||c.settled)return;c.settled=true;c.cost=Number.isSafeInteger(cost)&&cost>=0?cost:c.reserved;c.usage=usage;c.uncertain=cost===null;if(c.cost>c.reserved)v.limitMicros=0;});
    },
    finish(id) {return mutate(v=>{const r=v.runs.find(r=>r.id===id);if(r)r.ended=true;});},
    async runCost(id) {
      const v=(await store.control()).value||seed();
      const calls=Object.values(v.calls).filter(c=>c.runId===id);
      return {chargedMicros:calls.reduce((s,c)=>s+(c.settled?c.cost:0),0),reservedMicros:calls.reduce((s,c)=>s+(c.settled?0:c.reserved),0),calls:calls.length,uncertain:calls.some(c=>c.uncertain||!c.settled)};
    }
  };
}

export function estimateRequest(body) {
  if(body.model!==MODEL||body.stream||body.background||body.previous_response_id||(body.tools?.length||0)>0)throw fail('Operação fora do contrato econômico.',400);
  if(body.service_tier&&body.service_tier!=='default')throw fail('Modo de cobrança não permitido.',400);
  if(!Number.isInteger(body.max_output_tokens)||body.max_output_tokens<1||body.max_output_tokens>6000)throw fail('Limite de saída inválido.',400);
  const inputBytes=new TextEncoder().encode(JSON.stringify(body)).length;
  if(inputBytes>140000)throw fail('O contexto excede o limite do piloto. Enxugue as referências.',400);
  // For text-only requests, bytes + envelope allowance conservatively bound input tokens.
  return Math.ceil((inputBytes+4096)*INPUT_MAX_MICROS_PER_TOKEN+body.max_output_tokens*OUTPUT_MICROS_PER_TOKEN);
}
