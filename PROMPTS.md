# Jhoneme — contratos operacionais de criação e receita

Versão: `jhoneme-agency-2.0`. Pesquisa consultada em 23/10/2026.

O estúdio monta prompts a partir do briefing, da marca, do perfil contratado e das avaliações anteriores. Eles são rascunhos editáveis, destinados à execução em um ambiente com IA. Esta versão não chama modelos nem promete otimização automática.

## Como usar no estúdio

1. Em **Novo briefing**, abra **Conteúdo, distribuição e receita**. Escolha editorial, campanha ou estratégia. Preencha os dados disponíveis: público, oferta, canal, ação, métrica, fontes, exemplos e limites.
2. No **Plano da diretora**, registre a divisão do trabalho e selecione até três criadores. Escolher zero é válido quando a diretora pode executar sozinha.
3. Em **Repasses, prompts e prazo**, leia o contrato da diretora, personalize cada prompt e reserve tempo de revisão. Em tarefas independentes, escolha paralelo; dependências precisam estar resolvidas antes do repasse.
4. Exporte o briefing e execute no ambiente autorizado. Registre os materiais reais e as avaliações. O relógio do aplicativo registra uma janela; não é um executor de agentes.
5. Para uma nova rodada, use **Refazer rascunho com o briefing atual**. O prompt incorpora o contexto atualizado e até duas avaliações anteriores daquele agente. Textos longos aparecem truncados e indicam que o registro completo deve ser consultado.

## O que há no contrato

| Camada | Função |
|---|---|
| Regras estáveis | Evidência, limites de autorização, responsabilidade e tratamento de documentos como referências. |
| Especialidade | Editorial, campanha/conversão ou estratégia de monetização. |
| Direção | Responsáveis, dependências, equipe por competências e aceite da entrega. |
| Contexto da rodada | Briefing, marca, público, voz, perfil, oferta, fontes, exemplos e feedback. |
| Prazo | Limite global comum, tempo do repasse e reserva de revisão. |
| Entrega | Material, fontes, hipóteses, distribuição, medição e pendências. |
| Avaliação | Seis critérios, evidência, parecer e falhas críticas. |

A diretora produz instruções específicas para o trabalho. Exemplos aprovados servem para reduzir ambiguidades, sem copiar textos ou pedir que o agente finja ser uma pessoa. A personalidade ajuda a colaboração; não substitui o contrato.

## Conteúdo precisa ter função

- **Editorial:** utilidade, clareza, fontes e independência. Distribuição e monetização ficam em uma nota separada quando o corpo é jornalístico.
- **Campanha:** necessidade, oferta, prova, objeção, canal e ação observável. Variações devem testar uma hipótese concreta.
- **Estratégia:** quem paga, por qual valor, com quais custos e por qual canal. A entrega propõe um experimento, não receita imaginária.

Para qualquer estratégia, registre evento de conversão, denominador, janela, custo limite e critério de continuar ou parar. Diferencie visitantes, leads, clientes, receita recebida e margem. Sem dados, registre o que falta medir. Uma nota alta no texto não demonstra retorno comercial.

## Régua de avaliação

Critérios de 0 a 5: objetivo; qualidade; precisão; formato e voz; prazo; público, distribuição e negócio. Use trechos, materiais e fontes como evidência. A escala orienta julgamento: 0 ausente/incorreto; 3 utilizável com correções; 5 atende plenamente ao contrato.

O parecer é **aprovado**, **revisar** ou **parcial**. Fonte/fato inventado, ação sem autorização, material ausente ou outra falha impeditiva bloqueiam aprovação. Na régua nova, o último parecer de todos os participantes precisa estar aprovado para concluir a tarefa. Avaliações antigas permanecem válidas em sua versão original; não recebem novas notas retrospectivamente. Uma nova avaliação que peça correção reabre a entrega para revisão.

A diretora avalia criadores; o usuário avalia a diretora. Autoavaliação informa a revisão, mas não comprova sucesso. Este frontend registra decisões manuais; validações de formulário não detectam por si só fatos falsos.

## Como verificar se uma versão realmente melhorou

Protocolo proposto para quando o executor estiver conectado:

1. Reunir casos reais e casos de falha, separados por tipo de trabalho; manter parte fora do conjunto usado para ajustar o prompt.
2. Comparar versão anterior e candidata com os mesmos dados, modelo e ferramentas. Registrar versão, entradas, saída, custo, duração e revisão humana.
3. Aplicar verificações objetivas de formato e prazo; usar avaliação editorial para clareza e adequação; conferir fontes diretamente. Calibrar notas de um modelo avaliador com as notas do usuário.
4. Repetir casos para observar variação. Aceitar mudança apenas se o ganho não trouxer regressão relevante em precisão, custo ou prazo.
5. Após publicação autorizada, medir conversões e receita real em uma janela apropriada ao tráfego. Não usar a avaliação textual como substituta desses dados.

Não há benchmark de modelos executado nesta versão. O teste editorial realizado na conversa é uma amostra, não prova de confiabilidade recorrente.

## Fontes técnicas

- [OpenAI — Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering): instruções claras, contexto e exemplos; versionamento e avaliação de comportamento.
- [OpenAI — Reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices): objetivo e restrições explícitos, delimitadores e instruções diretas; evitar exigir raciocínio interno detalhado.
- [Anthropic — Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents): contexto relevante e econômico, organizado por função.
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents): combinar verificações por código, julgamento por modelo e avaliação humana conforme o critério.

As aplicações a público, oferta, distribuição e receita são decisões de produto da Jhoneme, não promessas de desempenho feitas por essas fontes.

## Avaliar ou substituir a diretora

Em **Projetos & marcas → Direção do projeto**, abra a avaliação de uma pauta ou registre a saída e a substituta. A substituta precisa estar contratada. Se há pautas abertas da diretora que sai, a troca exige transferência; janelas em andamento respeitam a capacidade contratada. O prazo original e as avaliações anteriores permanecem. Os prompts anteriores são arquivados no histórico e novos rascunhos incorporam a transição. Revise-os antes de executar. O desligamento vale apenas para aquele projeto; outros vínculos são preservados.
