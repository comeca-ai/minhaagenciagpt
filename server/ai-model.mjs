import {Agent,Runner,OpenAIProvider} from '@openai/agents';
import OpenAI from 'openai';
import {MODEL,estimateRequest,INPUT_MAX_MICROS_PER_TOKEN,OUTPUT_MICROS_PER_TOKEN,fail} from './ai-budget.mjs';

// All provider traffic crosses this boundary; SDK retries and tools are disabled.
export function meteredModel({key,ledger,runId,fetchImpl=fetch}) {
  const client=new OpenAI({apiKey:key,maxRetries:0,baseURL:'https://api.openai.com/v1',fetch:async(url,init)=>{
    const address=new URL(typeof url==='string'?url:url.url||String(url));
    if(address.origin!=='https://api.openai.com'||address.pathname!=='/v1/responses'||init?.method!=='POST')throw fail('Endpoint fora do contrato econômico.',400);
    const body=JSON.parse(init.body),reservation=estimateRequest(body),callId=crypto.randomUUID();
    await ledger.reserve(runId,callId,reservation);
    let settled=false;
    try {
      const response=await fetchImpl(url,init);
      if(!response.ok) {
        // Ambiguous HTTP failures remain fully reserved. No automatic regeneration.
        await ledger.settle(callId,null);settled=true;
        const status=response.status;
        throw fail(status===401?'A credencial OpenAI foi recusada.':status===403||status===404?'O projeto não tem acesso ao modelo econômico.':status===429?'A OpenAI recusou a chamada por saldo ou limite. Confira o faturamento.':'A OpenAI não concluiu a chamada. A reserva foi mantida para proteger o orçamento.',503);
      }
      const data=await response.clone().json(),usage=data.usage;
      if(!usage||!Number.isSafeInteger(usage.input_tokens)||usage.input_tokens<0||!Number.isSafeInteger(usage.output_tokens)||usage.output_tokens<0)throw fail('A API não confirmou o consumo. A reserva foi mantida.',503);
      const cost=Math.ceil(usage.input_tokens*INPUT_MAX_MICROS_PER_TOKEN+usage.output_tokens*OUTPUT_MICROS_PER_TOKEN);
      await ledger.settle(callId,cost,{inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,reasoningTokens:usage.output_tokens_details?.reasoning_tokens||0,responseId:data.id});
      settled=true;
      if(cost>reservation)throw fail('O consumo excedeu a reserva. O lote foi bloqueado para conferência.',503);
      return response;
    } catch(error) {
      if(!settled)await ledger.settle(callId,null).catch(()=>{});
      throw error;
    }
  }});
  const runner=new Runner({modelProvider:new OpenAIProvider({openAIClient:client,useResponses:true}),tracingDisabled:true,traceIncludeSensitiveData:false});
  return async({name,instructions,input,outputType,maxTokens=4000,signal})=>{
    const agent=new Agent({name,instructions,model:MODEL,tools:[],...(outputType?{outputType}:{}),modelSettings:{maxTokens,store:false,reasoning:{effort:'low'},text:{verbosity:'low'},retry:{maxRetries:0},providerData:{service_tier:'default'}}});
    const result=await runner.run(agent,input,{maxTurns:1,signal});
    if(result.finalOutput===undefined||result.finalOutput===null||result.finalOutput==='')throw fail('O agente retornou sem material utilizável.',503);
    return result.finalOutput;
  };
}
