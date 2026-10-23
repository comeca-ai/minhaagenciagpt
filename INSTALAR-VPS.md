# Jhoneme na sua VPS

Um container reúne Caddy, Node.js 24 e SQLite. O Caddy entrega HTTPS; o servidor controla login, sessões e gravações; o SQLite mantém a agência em um volume persistente. Não há cadastro público. A execução autônoma de IA ainda não está conectada.

## Instalar

Use Linux de 64 bits com Docker Engine e Compose. Como ponto de partida, 1 vCPU e 1 GB de RAM; isso não é um benchmark. O instalador pode instalar Docker CE pelo repositório oficial em Ubuntu/Debian com `--install-docker`.

Baixe o código do GitHub ou extraia o pacote e entre na pasta com `install.sh`. Para uma instalação nova com domínio:

```bash
sudo bash install.sh --install-docker \
  --domain agencia.seudominio.com \
  --email voce@seudominio.com \
  --user Jhoneme
```

Aponte o DNS A para a VPS, configure AAAA somente se o IPv6 funcionar e libere 80/TCP e 443/TCP. A porta 443/UDP é opcional para HTTP/3. Não use portas ocupadas por outro proxy. A senha é solicitada em entrada oculta e somente seu hash bcrypt fica em `.env`, com permissão 600. Não há senha padrão no repositório.

Acesse seu domínio. A porta visual da agência pede usuário e senha; não aparece a caixa de autenticação do navegador. A sessão dura até oito horas, pode ser encerrada em **Sair** e é revogada quando as credenciais mudam. Em HTTPS o cookie é Secure e HttpOnly.

### Pacote privado com acesso já preparado

Se o pacote contém `.env`, execute `sudo bash install.sh --install-docker` sem opções de configuração. Ele preserva as credenciais e começa em modo local. Antes de instalar com domínio, ajuste apenas `JHONEME_MODE='https'`, `JHONEME_SITE_ADDRESS='agencia.seudominio.com'` e `JHONEME_ACME_EMAIL` no `.env`. Preserve o hash entre aspas simples. Não publique esse pacote privado nem seu `.env`.

### Sem domínio

Em uma instalação nova:

```bash
sudo bash install.sh --install-docker --local --port 8080 --user Jhoneme
```

No computador, abra o túnel e mantenha-o aberto:

```bash
ssh -L 8080:127.0.0.1:8080 usuario@IP_DA_VPS
```

Acesse `http://localhost:8080`. A porta fica limitada ao loopback e o túnel SSH protege o transporte. Para exposição pública use o modo HTTPS. Um proxy externo exige configuração própria de origem e cookies; este pacote configura o Caddy diretamente.

## Onde ficam os dados

| Conteúdo | Local | Backup |
| --- | --- | --- |
| Projetos, perfis, sprints, reuniões, materiais, prompts e avaliações | SQLite `/agency/jhoneme.sqlite`, volume Compose `agency_data` | `workspace.json` no backup da VPS; exportação JSON no aplicativo |
| Sessões de acesso | SQLite, identificadores protegidos por hash | Não são exportadas |
| Usuário e hash bcrypt | `.env` | `application.tar.gz` no backup privado |
| Certificados TLS | Volumes `caddy_data` e `caddy_config` | `certificates.tar.gz` |
| Código e imagens | Imagem Docker | Repositório e `application.tar.gz` |

Os nomes reais dos volumes têm o prefixo do projeto Compose, normalmente `jhoneme_`. Recriar ou atualizar o container preserva os dados. **Não execute `docker compose down -v`**, pois remove os volumes.

A agência tem um único espaço compartilhado pela conta da direção. Os dados são carregados do banco ao abrir/recarregar a página; não há atualização em tempo real. Se outra aba salvar antes, a versão antiga é bloqueada para evitar sobrescrita: exporte suas alterações, recarregue e compare. A interface indica quando a gravação terminou. Espere **Salvo na VPS** antes de fechar.

O banco usa uma revisão atômica do documento da agência, além de tabelas para sessões e metadados. É uma primeira versão leve; não oferece consultas analíticas por entidade ou histórico completo de cada revisão. O limite de gravação é 8 MB, incluindo imagens próprias.

**Migrar da prévia:** exporte o JSON em **Histórico & dados** no site anterior e restaure-o na VPS. A versão do Sites continua usando armazenamento do navegador e acesso privado do ChatGPT; o banco da VPS não é conectado automaticamente àquela prévia. A restauração substitui o espaço atual, após a confirmação mostrada pelo aplicativo.

## Manutenção

```bash
sudo bash manage.sh status
sudo bash manage.sh logs
sudo bash manage.sh stop
sudo bash manage.sh start
sudo bash manage.sh restart
sudo bash manage.sh password
sudo bash manage.sh backup
```

O serviço retorna após reinicialização da VPS, salvo se tiver sido parado manualmente. Executar `install.sh` novamente reutiliza o `.env`. Para mudar o domínio, ajuste a configuração e execute `manage.sh restart`. A saúde interna confirma o servidor e a conexão com o banco; DNS e emissão pública de HTTPS precisam ser conferidos no domínio.

Para instalar sem terminal interativo, use `--password-file /caminho/protegido/senha.txt`, com uma única linha de 8 a 72 bytes. A senha vai pela entrada padrão ao gerador de hash e não aparece nos argumentos. Para trocar, use `manage.sh password --password-file ...`.

## Briefing por áudio com Deepgram

Na recepção, clique em **Dar briefing por áudio**, depois em **Gravar pelo microfone**. Ao parar, o áudio vai ao servidor e ao Deepgram; a transcrição preenche uma revisão do pedido. Você confere projeto, diretora e prazo antes de registrar a sprint. Para aproveitar a organização sem áudio, escreva ou cole o pedido na mesma tela.

O preenchimento reconhece nomes cadastrados, prazos explícitos e orientações rotuladas. Não é uma interpretação geral por modelo de linguagem. Informações ausentes ou ambíguas precisam ser completadas; todas as orientações permanecem no texto integral. Registrar não inicia automaticamente a produção dos agentes.

Configure a integração após instalar ou atualizar:

```bash
sudo bash manage.sh deepgram
# Sem terminal interativo, use um arquivo privado:
sudo bash manage.sh deepgram --key-file /caminho/protegido/deepgram.txt
```

A chave fica no `.env` privado e é enviada somente pelo servidor ao Deepgram. Pacotes privados preparados com a chave já a incluem; o GitHub contém somente o nome da variável, vazio. Backups com `.env` também contêm essa chave e devem permanecer privados.

Use HTTPS ou localhost via túnel SSH e permita o microfone no navegador. O limite é de dez minutos/25 MB por gravação, duas transcrições simultâneas e doze tentativas por dez minutos nesta instância. O serviço pode gerar cobrança na conta Deepgram. Não há retentativa automática de transcrição.

O servidor solicita Nova-3, `language=pt-BR`, formatação e `mip_opt_out=true`. Áudio e resposta bruta não são gravados no banco nem em logs da aplicação. Só o texto que você aprovar vai para o pedido. O Deepgram mantém os metadados de uso conforme sua política. Referências: https://developers.deepgram.com/docs/pre-recorded-audio e https://developers.deepgram.com/trust-security/your-data.

O Sites possui um backend próprio de transcrição e uma configuração secreta independente da VPS. Configurar a chave no Sites não preenche o `.env` de um clone local. Se aparecer “Ative o Deepgram nesta instalação”, execute `sudo bash manage.sh deepgram` na pasta do clone; o comando recria o container com a chave. Recarregue a página após terminar.

## Atualizar e reverter

1. Faça `sudo bash manage.sh backup` antes de substituir arquivos.
2. Copie o código novo, preservando `.env`, `backups/` e os volumes.
3. Execute `sudo bash manage.sh update`.

O comando também faz backup, guarda a imagem anterior, constrói a nova e aguarda a saúde do serviço. Há uma breve interrupção. Ele não baixa código do GitHub automaticamente. A primeira atualização de uma imagem antiga estática não tem dados no banco para exportar; migre seu JSON pelo aplicativo.

`sudo bash manage.sh rollback` volta à imagem anterior, sem restaurar dados nem configurações. Uma imagem anterior à introdução do banco usa armazenamento local; os dados SQLite permanecem no volume. As imagens base acompanham Caddy 2 e Node 24; teste atualizações antes de uso crítico.

## Backup e restauração

`manage.sh backup` cria `backups/jhoneme-DATA-PID.tar.gz`, privado, contendo:

- `application.tar.gz`: código, scripts e `.env`.
- `workspace.json`: snapshot consistente da agência lido pelo SQLite, sem sessões.
- `certificates.tar.gz`: certificados e estado do Caddy.
- `META.txt`: descrição.

Guarde uma cópia fora da VPS. O backup contém informações da agência, hash de acesso e chaves TLS. O snapshot do banco pode ser feito com o serviço ativo; para uma cópia conjunta sem mudanças nos certificados, pare o serviço antes.

Para restaurar em outra VPS com Docker instalado:

```bash
mkdir -m 700 jhoneme-restaurada
cd jhoneme-restaurada
tar -xzf /caminho/jhoneme-BACKUP.tar.gz
tar -xzf application.tar.gz
sudo bash install.sh
sudo bash manage.sh restore-certificates "$PWD/certificates.tar.gz"
sudo bash manage.sh restore-data "$PWD/workspace.json"
```

`restore-data` faz um backup de segurança, para o serviço, importa o snapshot e inicia novamente. Ele rejeita arquivos vazios/inválidos; se o backup foi criado antes de qualquer gravação, basta iniciar sem restaurar dados. Um erro de restauração mantém o serviço parado para verificação; use `manage.sh start` após corrigir. Restaure somente backups próprios. Na mesma VPS, duas instalações precisam de `COMPOSE_PROJECT_NAME` e portas distintos para não compartilhar volumes.

## Verificar

```bash
node tests/agency.test.cjs
node --test tests/server.test.mjs tests/sync.test.cjs tests/deepgram.test.mjs tests/voice.test.cjs
python3 tests/deployment.test.py
bash tests/docker-smoke.sh
```

Os testes do servidor exigem Node 24. O último comando exige Docker, Compose e curl: usa projeto e porta isolados, testa login real bcrypt, sessão, API protegida, gravação, conflito, recriação do container, backup e restauração. O workflow executa essas verificações no GitHub Actions. A revisão visual em navegadores e a emissão de HTTPS no seu domínio permanecem como verificações da instalação.

Se não entrar: confira `manage.sh logs`, DNS/portas e se o modo corresponde a HTTP local ou HTTPS. Após trocar a senha, entre novamente. Se uma instalação for interrompida, remova `.install-lock` somente quando tiver certeza de que não há instalador ativo. `.env.previous` permite recuperar a configuração anterior a uma troca de senha.

## Referências

- https://docs.docker.com/engine/install/ubuntu/
- https://docs.docker.com/engine/install/debian/
- https://docs.docker.com/compose/install/linux/
- https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- https://caddyserver.com/docs/automatic-https
- https://caddyserver.com/docs/caddyfile/directives/basic_auth
