import {spawn} from 'node:child_process';
import {createAgencyServer} from './http.mjs';
if(!process.env.JHONEME_ADMIN_USER||!process.env.JHONEME_PASSWORD_HASH)throw new Error('Configure as credenciais antes de iniciar.');
const {server}=createAgencyServer();
const caddy=spawn('caddy',['run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],{stdio:'inherit'});
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;caddy.kill('SIGTERM');server.close(()=>process.exit(code));setTimeout(()=>process.exit(code),5000).unref()}
caddy.on('error',()=>stop(1));caddy.on('exit',code=>stop(code||0));
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
server.listen(3000,'127.0.0.1',()=>console.log('Jhoneme pronta: acesso por sessão e armazenamento SQLite.'));
