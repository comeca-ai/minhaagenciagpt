import {openStore,validWorkspace} from './store.mjs';
const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>24_000_000)throw Error('Backup maior que 24 MB.');chunks.push(chunk)}
const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!['jhoneme-workspace-v1','jhoneme-workspace-v2'].includes(input.format)||!validWorkspace(input.state))throw Error('Backup inválido ou vazio.');
const store=openStore(process.env.JHONEME_DB_PATH||'/agency/jhoneme.sqlite');
if(input.format==='jhoneme-workspace-v2')store.restoreAI(input.ai);
store.write(input.state,store.read().revision);store.close();console.log('Dados restaurados. Sessões não foram importadas; registros de IA já existentes foram preservados.');
