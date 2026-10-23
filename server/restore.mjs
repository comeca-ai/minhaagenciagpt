import {openStore,validWorkspace} from './store.mjs';
const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>8_000_000)throw Error('Backup maior que 8 MB.');chunks.push(chunk)}
const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(input.format!=='jhoneme-workspace-v1'||!validWorkspace(input.state))throw Error('Backup inválido ou vazio.');
const store=openStore(process.env.JHONEME_DB_PATH||'/agency/jhoneme.sqlite');
store.write(input.state,store.read().revision);store.close();console.log('Dados restaurados. Sessões de acesso não foram importadas.');
