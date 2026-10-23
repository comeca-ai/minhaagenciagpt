# Jhoneme — estúdio criativo de agentes

Aplicativo visual em português para configurar uma agência de agentes de IA: recepção, equipe com retratos fictícios, marcas, pautas, sala de reunião, pedidos de ferramentas, prazos globais, repasses, prompts e avaliações.

## Instalar em VPS com Docker

O pacote inclui `Dockerfile`, Docker Compose, `install.sh` e `manage.sh`. Veja **[INSTALAR-VPS.md](INSTALAR-VPS.md)** para instalação com domínio/HTTPS, acesso local, backup, atualização e migração dos dados do navegador.

```bash
sudo bash install.sh --install-docker --domain agencia.seudominio.com --email voce@seudominio.com --user Jhoneme
```

Para instalar **somente Docker Engine e Docker Compose** em Ubuntu/Debian, use o script incluído no repositório: **[scripts/install-docker.sh](scripts/install-docker.sh)**.

```bash
git clone https://github.com/comeca-ai/minhaagenciagpt.git
cd minhaagenciagpt
sudo bash scripts/install-docker.sh
```

O script usa o repositório oficial do Docker e inicia o serviço. Ele preserva instalações existentes; não remove outros runtimes de containers. Para instalar a agência junto, use `install.sh --install-docker` como acima.

## Usar

Na VPS, use o instalador para ter login e SQLite. Para explorar apenas a prévia estática, sirva `public/` com um servidor de arquivos; essa modalidade usa dados locais do navegador e não exige compilação.

## Prompts de conteúdo e monetização

A versão `jhoneme-agency-2.0` integra briefing de negócio, contratos da diretora e dos criadores, contexto por rodada, feedback anterior e régua com seis critérios. Fontes inventadas, ações sem autorização e material ausente bloqueiam aprovação. Consulte [PROMPTS.md](PROMPTS.md) para o fluxo, as referências e os limites da avaliação.

## Um briefing, por áudio ou texto

Na recepção, abra **Dar briefing por áudio**. Grave até dois minutos, pare e revise o pedido preenchido antes de salvar. O Deepgram transcreve em português brasileiro. O nome do projeto, a diretora e o prazo explícito são identificados por regras locais; casos ambíguos ficam em branco. A fala completa é preservada. Não há interpretação semântica geral por LLM nesta versão.

O formulário pede somente projeto, diretora, pedido e prazo. Nome da sprint, formato e direcionamentos adicionais são opcionais. O contexto da marca e o perfil já cadastrado acompanham os prompts. O fluxo agora tem três etapas: **Seu pedido → Produção → Entrega**, com migração dos registros anteriores.

A gravação Deepgram funciona no **Sites e na instalação VPS**, com `DEEPGRAM_API_KEY` configurada somente no servidor de cada ambiente. No Sites, use as variáveis secretas de produção. Na VPS/local, execute `sudo bash manage.sh deepgram` e informe a chave pelo prompt oculto. O clone do GitHub não inclui credenciais. Não insira a chave no JavaScript.

```bash
sudo bash manage.sh deepgram
```

O comando recebe a chave com entrada oculta e reinicia o container. Use HTTPS ou localhost com túnel SSH. Há microfone também nas expectativas do perfil e no pedido da sprint. Nenhum áudio é salvo no banco; apenas o texto aprovado pelo usuário é persistido. O endpoint exige login, mesma origem e limita tamanho e frequência. Detalhes em [INSTALAR-VPS.md](INSTALAR-VPS.md).

## O que funciona

- Perfis editáveis: rosto, nome, cargo, habilidades, personalidade, instruções, autonomia e marcas.
- Contratação como aprovação de um perfil local.
- Projetos editáveis e arquivamento sem apagar referências.
- Direção por projeto: avaliação, desligamento, substituição e transferência de pautas com prazo e histórico preservados.
- Reuniões com participantes, perguntas, orientações e decisões registradas pelo usuário.
- Nizan: advisor de IA baseado no pacote fornecido pelo usuário, disponível para todos os projetos sob demanda; sem entrar automaticamente nas sprints.
- Briefing com diretora responsável, objetivo, formato e tempo definido por tarefa.
- Plano com até três criadores; a escolha fica no plano da diretora, não no briefing inicial.
- Várias diretoras, com regra de atendimento e capacidade definidas na contratação.
- Reserva de revisão e orçamento de repasses sequenciais ou paralelos dentro do prazo global.
- Checagem de conflito de capacidade ao registrar uma janela local.
- Registro de início e limite absoluto, sem reinício por repasse.
- Rascunhos de prompts construídos com contexto da tarefa e editáveis por rodada.
- Avaliações por participante com evidência e notas; conclusão exige material e avaliações.
- Solicitação e decisão sobre ferramentas com finalidade, custo e impacto no prazo.
- Exportação de briefing, reunião, material, resumo e backup; restauração compatível com a versão anterior.

## Limites desta versão

É um estúdio com persistência SQLite na VPS e uma versão hospedada no Sites, sem motor de IA conectado. Não executa agentes, não contrata pessoas, não instala ferramentas e não gera respostas autônomas. As avaliações, os planos e os materiais são registros manuais; não há notas ou entregas simuladas. Os rascunhos de prompt são montados com os dados da agência, não otimizados por um modelo.

Registrar uma janela não cria um trabalho em segundo plano. Para operação real, o backend precisa receber e impor um prazo absoluto comum aos agentes e ferramentas, persistir eventos, gerenciar cancelamento e reservar revisão dentro desse limite.

Na VPS, os dados ficam no SQLite em volume Docker e são carregados em qualquer dispositivo após o login. Gravações concorrentes são protegidas por revisão, sem atualização em tempo real. O Sites usa `localStorage`; exporte e importe o JSON para migrar. O backup da VPS inclui o banco. Há uma porta visual com login, sem cadastro público, e sessões de até oito horas. Nenhuma senha é publicada no código.

## Contrato para a futura orquestração

1. O usuário aprova a diretora e define objetivo, material e prazo total.
2. A diretora compõe a equipe com até três criadores do banco pertinente à marca.
3. Antes de cada chamada, a diretora prepara um prompt específico com o briefing atualizado, papel, entrega esperada, critérios de avaliação e tempo restante.
4. Todos os agentes herdam o mesmo `deadlineAt`; um repasse não cria um novo prazo global.
5. A diretora avalia cada entrega com evidências, solicita correções dentro do tempo restante e faz revisão final.
6. Ferramentas ausentes ou gastos adicionais exigem pedido explícito com finalidade, custo, limites e impacto. A espera não estende o prazo automaticamente.
7. Ao encerrar a janela, devolver o material disponível, o que foi verificado e as pendências, sem declarar trabalho inexistente como concluído.

## Verificação

```sh
node tests/agency.test.cjs
```

Os testes verificam as telas, migração de dados, prazos variáveis, limite de criadores, autorização de ferramentas, material e avaliações obrigatórias, exportação, orçamento dos repasses e rejeição de dados inválidos. A prévia de navegador não estava disponível durante esta implementação; é necessário conferir visualmente nos navegadores-alvo.

## Estrutura

- `public/app.js`: estrutura anterior, navegação, persistência e backups.
- `public/studio.js`: equipe, projetos e reuniões.
- `public/agency.js`: recepção, pautas, ferramentas e exportações.
- `public/direction.js`: vínculos, substituição e histórico de diretoras por projeto.
- `public/prompts.js`: contratos operacionais e contexto de conteúdo e negócio.
- `public/quality.js`: prazo global, repasses, prompts e avaliações.
- `public/styles.css`, `studio.css`, `jhoneme.css`: estilos e adaptação a telas menores.
- `public/assets/`: retratos fictícios e imagem conceitual gerados para o projeto.
- `tests/agency.test.cjs`: verificações sem dependências externas.

Nenhuma chave SSH, token, segredo ou dado de cliente deve ser adicionado ao repositório. Conversas e backups pessoais também ficam fora do código publicado.

## Entrada por voz

O site hospedado usa o login privado do Sites. O backend da VPS continua com login e SQLite. Configure `DEEPGRAM_API_KEY` como segredo do servidor para transcrever áudio com Nova-3 em português. No Sites, a chave fica nas variáveis secretas de produção; na VPS, em `.env` fora do Git. Reinicie o serviço após configurá-la. O áudio é enviado apenas após Parar e transcrever, até 2 minutos / 6 MB por gravação, e não é armazenado pela agência. Na recepção, parar abre a revisão do pedido preenchido. Nos demais campos, você revisa e aplica a transcrição. Nada inicia uma sprint automaticamente.

`public/` contém a interface compartilhada pelo Sites e pela VPS. `app/api/transcribe/route.ts` atende o Sites; `server/http.mjs` atende a VPS, ambos usando `server/transcribe.mjs`. Execute `npm run build` para o Sites. A transcrição não conecta automaticamente a produção de agentes ao n8n.
