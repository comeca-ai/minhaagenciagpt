// Explicit, metered live verification. Never part of npm test or container startup.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {sqliteAIStore} from './ai-store.mjs';
import {prepareRun,executeRun,publicRun} from './ai-engine.mjs';
import {budget} from './ai-budget.mjs';
if(process.argv[2]!=='--spend-up-to-5-cents')throw Error('Explicit live-test flag required.');
process.loadEnvFile(resolve('.env'));
const filename=resolve('credentials/openai-smoke.sqlite');mkdirSync(dirname(filename),{recursive:true,mode:0o700});
const db=new DatabaseSync(filename);chmodSync(filename,0o600);const store=sqliteAIStore(db);
const options={limitMicros:50000};
const previous=await store.runs('verification');
if(previous.length){console.log(JSON.stringify({existing:true,status:previous[0].status,budget:await budget(store,options).summary()}));db.close();process.exit(0);}
const workspace={studio:{projects:[{id:'jhoneme',name:'Jhoneme',description:'Agência de criação coordenada por IA.',tone:'Claro, concreto, sem promessas exageradas.'}],people:[{id:'diretora',name:'Marina',role:'Diretora de criação',status:'Aprovado',projects:[],capacity:1,instructions:'Neste teste, delegue a redação a Lia, a única criadora do pool. Depois revise e integre o material.'},{id:'criadora',name:'Lia',role:'Redatora',status:'Em definição',projects:[],capacity:1,skills:'Texto claro em português, conteúdo e chamada para ação.'}],tasks:[{id:'sdk-verification',title:'Apresentação da agência',brief:'Escreva uma apresentação original de 100 a 150 palavras para uma agência em que o cliente dá um briefing e um prazo, a diretora coordena até três criadores de IA e o cliente revisa a entrega. Não cite preços, resultados comprovados, clientes ou funcionalidades além desses fatos. Termine com uma chamada para o cliente enviar um briefing. Use uma redatora do pool. Não precisa pesquisar a internet.',project:'jhoneme',director:'diretora',minutes:2,format:'Título, dois parágrafos e uma chamada para ação.'}]}};
try{
 const prepared=await prepareRun({store,workspace,owner:'verification',taskId:'sdk-verification',requestId:'sdk-verification-001',key:process.env.OPENAI_API_KEY,ledgerOptions:options});
 await executeRun({...prepared,store,key:process.env.OPENAI_API_KEY,onUpdate:r=>console.log(JSON.stringify({phase:r.phase,status:r.status,steps:r.steps.length,cost:r.cost}))});
 const run=publicRun(prepared.run),ledger=await budget(store,options).summary();
 writeFileSync(resolve('credentials/openai-verification.json'),JSON.stringify({run,budget:ledger},null,2),{mode:0o600});
 console.log(JSON.stringify({status:run.status,message:run.message,materialCharacters:run.material.length,evaluations:run.evaluations.length,budget:ledger}));
}finally{db.close();}
