# Jhoneme — estúdio criativo de agentes

Aplicativo visual em português para configurar uma agência de agentes de IA: recepção, equipe com retratos fictícios, marcas, pautas, sala de reunião, pedidos de ferramentas, prazos globais, repasses, prompts e avaliações.

## Instalar em VPS com Docker

O pacote inclui `Dockerfile`, Docker Compose, `install.sh` e `manage.sh`. Veja **[INSTALAR-VPS.md](INSTALAR-VPS.md)** para instalação com domínio/HTTPS, acesso local, backup, atualização e migração dos dados do navegador.

```bash
sudo bash install.sh --install-docker --domain agencia.seudominio.com --email voce@seudominio.com
```

## Usar

O aplicativo está em `dist/` e não exige compilação. Sirva essa pasta com um servidor de arquivos estáticos. Também é possível abrir `dist/index.html` para explorar; a persistência de arquivos locais varia conforme o navegador.

## Prompts de conteúdo e monetização

A versão `jhoneme-agency-2.0` integra briefing de negócio, contratos da diretora e dos criadores, contexto por rodada, feedback anterior e régua com seis critérios. Fontes inventadas, ações sem autorização e material ausente bloqueiam aprovação. Consulte [PROMPTS.md](PROMPTS.md) para o fluxo, as referências e os limites da avaliação.

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

É um protótipo estático, sem motor de IA conectado. Não executa agentes, não contrata pessoas, não instala ferramentas e não gera respostas autônomas. As avaliações, os planos e os materiais são registros manuais; não há notas ou entregas simuladas. Os rascunhos de prompt são montados com os dados locais, não otimizados por um modelo.

Registrar uma janela não cria um trabalho em segundo plano. Para operação real, o backend precisa receber e impor um prazo absoluto comum aos agentes e ferramentas, persistir eventos, gerenciar cancelamento e reservar revisão dentro desse limite.

Os dados ficam no `localStorage` do navegador. Não há sincronização entre dispositivos. Exporte um backup para preservar ajustes. Imagens próprias consomem a cota local do navegador.

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

- `dist/app.js`: estrutura anterior, navegação, persistência e backups.
- `dist/studio.js`: equipe, projetos e reuniões.
- `dist/agency.js`: recepção, pautas, ferramentas e exportações.
- `dist/direction.js`: vínculos, substituição e histórico de diretoras por projeto.
- `dist/prompts.js`: contratos operacionais e contexto de conteúdo e negócio.
- `dist/quality.js`: prazo global, repasses, prompts e avaliações.
- `dist/styles.css`, `studio.css`, `jhoneme.css`: estilos e adaptação a telas menores.
- `dist/assets/`: retratos fictícios e imagem conceitual gerados para o projeto.
- `tests/agency.test.cjs`: verificações sem dependências externas.

Nenhuma chave SSH, token, segredo ou dado de cliente deve ser adicionado ao repositório. Conversas e backups pessoais também ficam fora do código publicado.
