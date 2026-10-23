import {openStore} from './store.mjs';
const store=openStore(process.env.JHONEME_DB_PATH||'/agency/jhoneme.sqlite');
process.stdout.write(JSON.stringify({format:'jhoneme-workspace-v1',...store.read()}));
store.close();
