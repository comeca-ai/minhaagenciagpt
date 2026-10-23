# Execução econômica — Jhoneme

## Contrato confirmado

O piloto autorizado tem teto total de **US$ 1**, até **10 execuções** e teto de **US$ 0,10 por execução**, compartilhado por diretora, criadores, integração e avaliação. A produção usa o OpenAI Agents SDK oficial para JavaScript, mantendo o mesmo motor no Sites e na VPS Node/Docker.

O fluxo principal é: briefing por texto ou áudio → projeto, diretora e prazo → **Iniciar produção** → revisar e aprovar entrega. O usuário não precisa preencher plano, repasses ou avaliações manualmente. Esses controles continuam recolhidos em Avançado.

## Coordenação

A diretora recebe perfil, marca, briefing, estratégia e até oito avaliações anteriores do projeto. Escolhe de zero a três especialistas elegíveis e produz prompts específicos com entrega e critérios. Perfis pausados, excluídos do projeto e advisors não entram no pool. O servidor impõe capacidade contratada, prazo absoluto e orçamento; instruções do modelo não alteram esses limites.

Partes independentes podem executar em paralelo. Repasses sequenciais recebem o material anterior. A janela inclui planejamento, produção, integração e avaliação. Reserva-se 25% para revisão. Neste piloto os prazos vão de 1 a 60 minutos. Uma falha preserva o material e as pendências; não gera uma entrega fictícia.

Cada chamada usa `Agent` e `Runner` oficiais; a aplicação controla o grafo e a contabilidade. Não há cadeia autônoma ilimitada de handoffs nem retries automáticos. A diretora integra a entrega e uma revisora independente registra notas de IA para a diretora e os especialistas. Aprovação humana permanece separada.

## Orçamento persistente

`ai_control` mantém o ledger e `ai_runs` mantém prompts, etapas, material e avaliações, separados do workspace editável. Reservas atômicas por compare-and-swap precedem cada chamada, inclusive em paralelo. Consumo confirmado libera a diferença da reserva; falhas sem confirmação mantêm a reserva como custo conservador. Repetir o mesmo identificador não produz de novo.

Modelo: `gpt-6-luna`. Valores consultados em 23/10/2026 na [tabela oficial](https://developers.openai.com/api/docs/pricing): US$ 0,10 por milhão de tokens de entrada e US$ 0,50 de saída. A contabilidade reserva entrada a US$ 0,25 por milhão, cobrindo a tarifa publicada de escrita de cache de 12 horas. O corpo textual em bytes mais margem de 4.096 tokens é usado para a reserva; saída tem teto de 6.000 tokens por chamada. Ferramentas pagas, mídia, modelos alternativos e tiers adicionais são rejeitados pelo transporte.

A primeira verificação real terminou em 36,2 segundos, com quatro chamadas, uma redatora e duas avaliações. Contabilizou **2.138 microdólares (US$ 0,002138)**, sem reservas pendentes. O Sites desconta esse valor e essa execução antes do uso: **US$ 0,997862 e nove execuções disponíveis** na abertura do piloto. Isso é uma estimativa conservadora desta verificação, não promessa de custo por matéria.

Este limite cobre a API OpenAI usada por este motor. Deepgram, hospedagem e chamadas feitas fora da agência têm cobranças separadas. O saldo da conta OpenAI não é consultado nem alterado pela aplicação.

## Credenciais e instalações

`OPENAI_API_KEY` fica somente no servidor, em segredo do Sites ou `.env` ignorado pelo Git. O Docker instala as dependências pelo lockfile de `server/`; nenhuma chave entra na imagem.

Na VPS, configure a credencial com `sudo bash manage.sh openai`. O comando preserva o orçamento. `JHONEME_AI_LIMIT_MICROS` inicia em **0**, pois o lote autorizado está no Sites. Não habilite um segundo US$ 1 na VPS com a mesma autorização. Para mover a operação, interrompa as execuções do ambiente anterior e transfira os registros e o orçamento remanescente, ou autorize um lote independente. Os bancos Sites/D1 e VPS/SQLite não se sincronizam.

Variáveis: `JHONEME_AI_LIMIT_MICROS` (VPS, 0 a 1000000), `JHONEME_AI_INITIAL_MICROS` e `JHONEME_AI_INITIAL_RUNS`. A configuração pode reduzir o teto de um ledger existente; não pode aumentá-lo silenciosamente. Restaurar um workspace não reembolsa consumo. O backup administrativo da VPS inclui ledger e execuções, além do workspace; ao restaurar em banco já usado, preserva os registros de IA existentes para impedir retrocesso de consumo. Exportar backup pelo navegador exporta apenas o workspace.

## Limites explícitos

Mantenha a aba aberta durante a execução. O piloto usa uma resposta HTTP com eventos; fechar a conexão pode interromper a produção. Não é uma fila durável de tarefas em segundo plano. Consultar a página recupera os registros já salvos sem gerar novamente.

A IA trabalha com texto e informações fornecidas. Não navega em URLs nem instala/publica/envia conteúdo. Pedidos de ferramentas são apresentados ao usuário; uma autorização administrativa não equivale a uma integração instalada. A reunião e o advisor continuam como registros, fora deste motor de desafios.

## Verificação

`npm test` inclui SDK real com transporte simulado, reservas concorrentes, D1/SQLite, capacidade, paralelismo, prazo, idempotência e persistência dos resultados. Não consome créditos. O teste real acima foi executado separadamente com limite de US$ 0,05 e ledger próprio; não roda no CI, ao abrir a página ou ao iniciar o container.
