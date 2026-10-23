# Jhoneme na sua VPS

Este pacote instala o estúdio visual completo em um container Docker. O servidor Caddy oferece arquivos estáticos, acesso com usuário/senha e HTTPS automático quando um domínio é informado. Não é necessário Node.js, npm ou banco de dados para rodar esta versão.

**Escopo atual:** equipe, reuniões, projetos, briefings, repasses, prompts e avaliações são gerenciados no navegador. O pacote não inclui execução autônoma de agentes nem sincronização de dados entre dispositivos.

## 1. Preparar a VPS

Use uma VPS Linux de 64 bits com Docker Engine e o plugin Docker Compose. O instalador pode instalar esses componentes pelo repositório oficial em Ubuntu ou Debian, usando a opção `--install-docker`. Para outra distribuição, instale o Docker previamente.

Como ponto de partida para este estúdio estático, reserve 1 vCPU, 1 GB de RAM e alguns GB livres para imagens e backups. Isso é uma configuração inicial sugerida, não um benchmark. Um futuro motor de agentes terá outros requisitos.

Envie `Jhoneme-VPS.zip` para a VPS e extraia em uma pasta permanente, por exemplo `/opt/jhoneme`. O ZIP tem uma pasta chamada `Jhoneme-VPS`; os comandos seguintes devem ser executados dentro dela:

```bash
unzip Jhoneme-VPS.zip
cd Jhoneme-VPS
```

Se necessário, instale o utilitário de extração na VPS Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y unzip
```

## 2. Instalar com domínio e HTTPS

Antes de executar:

- Aponte o registro DNS **A** do seu subdomínio para o IPv4 da VPS. Configure **AAAA** somente se o IPv6 da VPS estiver funcionando.
- Deixe as portas **80/TCP e 443/TCP** disponíveis para este container. A porta 443/UDP habilita HTTP/3 e é opcional para navegar.
- Se já houver um proxy usando essas portas, utilize o modo local descrito adiante e conecte o proxy existente ao endereço local.

Execute, substituindo domínio e e-mail:

```bash
sudo bash install.sh --install-docker \
  --domain agencia.seudominio.com \
  --email voce@seudominio.com
```

O instalador pede uma senha com entrada oculta, cria o usuário `diretor`, grava somente o hash da senha em `.env`, constrói a imagem, valida o Caddy e inicia o container. Para usar outro nome, acrescente `--user jhonata`.

Depois abra:

```text
https://agencia.seudominio.com
```

O navegador exibirá uma caixa de usuário e senha. A emissão do certificado depende do DNS e das portas e pode levar alguns minutos. O teste de saúde interno confirma o servidor, não certifica que o DNS/HTTPS público já está pronto.

O instalador não altera o firewall. Regras de portas publicadas pelo Docker precisam ser consideradas no firewall da VPS/provedor; não presuma que apenas regras UFW bloqueiam uma porta publicada.

## 3. Instalar sem domínio

```bash
sudo bash install.sh --install-docker --local --port 8080
```

A porta fica vinculada somente a `127.0.0.1` da VPS. No seu computador, abra um túnel:

```bash
ssh -L 8080:127.0.0.1:8080 usuario@IP_DA_VPS
```

Mantenha esse terminal aberto e acesse `http://localhost:8080`. O túnel SSH protege o transporte. Não publique a porta HTTP com a senha em uma rede aberta.

Se você já usa Nginx, Traefik, Caddy ou outro proxy **no host**, pode encaminhar seu domínio HTTPS para `http://127.0.0.1:8080`. Um proxy em outro container exige uma rede Docker compartilhada; `127.0.0.1` dentro daquele container não é o host. Essa integração depende do proxy existente e não é configurada automaticamente.

## 4. Onde ficam os dados

| Conteúdo | Onde fica | Como preservar |
| --- | --- | --- |
| Código, fotos e aparência | Imagem Docker construída com `dist/` | Guarde o pacote e use o backup da VPS. |
| Domínio, usuário e hash da senha | `.env` na pasta da instalação | Incluído no backup da VPS. |
| Certificados e estado do Caddy | Volumes Docker `caddy_data` e `caddy_config` | Incluídos no backup da VPS. |
| Projetos, perfis editados, pautas, reuniões e avaliações | `localStorage` do navegador, separado por endereço | **No aplicativo: Histórico & dados → Exportar backup.** |

**Migrar do site anterior:** abra a Jhoneme no endereço antigo, exporte seu backup JSON, abra o endereço da VPS e restaure o JSON em Histórico & dados. Mudar de domínio, porta ou HTTP para HTTPS cria uma origem diferente no navegador e não transfere os registros automaticamente.

A senha protege o acesso ao site. Não cria contas separadas nem faz os registros de dois navegadores se sincronizarem. Um volume Docker não consegue fazer backup de dados que estão somente no navegador.

## 5. Operação cotidiana

```bash
sudo bash manage.sh status
sudo bash manage.sh logs
sudo bash manage.sh stop
sudo bash manage.sh start
sudo bash manage.sh restart
sudo bash manage.sh password
```

Fechar a conexão SSH não encerra o container em modo domínio. A política `unless-stopped` faz o serviço retornar após reinicialização do Docker/VPS se ele não tiver sido parado manualmente.

Rodar `sudo bash install.sh` novamente reutiliza o `.env` existente. O instalador não troca silenciosamente domínio ou senha quando recebe novos parâmetros sobre uma instalação existente.

Para mudar o domínio posteriormente, faça backup, ajuste `JHONEME_MODE`, `JHONEME_SITE_ADDRESS` e `JHONEME_ACME_EMAIL` em `.env` e execute `sudo bash manage.sh restart`. Para mudar para modo local, use `JHONEME_MODE='local'`, `JHONEME_SITE_ADDRESS='http://:8080'` e a porta desejada. Exporte o backup JSON antes de trocar o endereço.

## 6. Atualizar e voltar uma versão

1. Exporte o backup JSON dentro do aplicativo.
2. Execute `sudo bash manage.sh backup` antes de substituir arquivos.
3. Copie os arquivos do novo pacote para a mesma pasta, preservando `.env` e `backups/`.
4. Execute:

```bash
sudo bash manage.sh update
```

A atualização faz outro backup da pasta atual, mantém uma referência à imagem em execução, atualiza a imagem-base, valida a configuração e recria o serviço. Pode haver uma breve interrupção. Não baixa código do GitHub nem altera automaticamente outros repositórios.

Para voltar à imagem que estava rodando antes da última atualização:

```bash
sudo bash manage.sh rollback
```

O rollback da imagem não restaura `.env` nem registros do navegador. Para restaurar esses conteúdos, use os backups correspondentes. A etiqueta `caddy:2-alpine` acompanha a linha principal 2 do servidor; para uma base fixa, substitua `CADDY_IMAGE` em `.env` por uma etiqueta ou digest previamente verificado.

## 7. Backup e restauração da VPS

```bash
sudo bash manage.sh backup
```

O arquivo aparece em `backups/jhoneme-DATA-PID.tar.gz` com permissão restrita. Ele contém:

- `application.tar.gz`: código, configurações, scripts e o `.env`.
- `certificates.tar.gz`: estado e certificados do Caddy.
- `META.txt`: identificação do conteúdo.

Guarde uma cópia fora da VPS. Esse backup contém hashes de acesso e chaves privadas dos certificados TLS; mantenha-o privado. Os volumes são copiados em funcionamento. Para um snapshot sem escrita concorrente, execute `stop`, `backup` e `start` nessa ordem.

Para restaurar um **backup seu** em outra pasta ou VPS com Docker instalado:

```bash
mkdir -m 700 jhoneme-restaurada
cd jhoneme-restaurada
tar -xzf /caminho/jhoneme-BACKUP.tar.gz
tar -xzf application.tar.gz
sudo bash manage.sh restore-certificates "$PWD/certificates.tar.gz"
sudo bash manage.sh start
```

O comando de restauração para o serviço durante a importação. Não o execute sobre outra instalação em uso sem planejar essa parada. Por padrão, a instalação usa o projeto Compose `jhoneme`; em uma mesma VPS, duas instalações com esse mesmo nome compartilham os volumes. Para uma segunda instância independente, use outro `COMPOSE_PROJECT_NAME` no `.env` e portas distintas. Não execute `docker compose down -v` se quiser preservar os certificados.

Depois, restaure seu backup JSON pelo aplicativo. Este passo é separado e necessário para os registros da agência.

## 8. Instalação não interativa

Crie um arquivo de senha protegido, por exemplo `/root/jhoneme-password.txt`, com uma única linha de 12 a 72 bytes. Use:

```bash
sudo bash install.sh --local \
  --password-file /root/jhoneme-password.txt
```

A senha é enviada ao processo de hash pela entrada padrão, sem ser colocada como argumento do processo. O pacote não contém senha padrão, chave SSH, token de API ou credencial da sua conta.

## 9. Verificação e solução de problemas

O instalador executa `docker compose config --quiet`, valida a configuração com o Caddy e aguarda o estado saudável do container. A caixa de login deve aparecer antes de qualquer arquivo da agência ser servido.

- **Porta ocupada:** escolha o modo local ou libere 80/443 do outro servidor de forma planejada.
- **Sem HTTPS:** confira DNS, IPv6, firewall do provedor e `sudo bash manage.sh logs`.
- **Docker sem permissão:** use `sudo` ou configure o acesso ao Docker conforme a documentação oficial.
- **Compose ausente:** instale o plugin Docker Compose oficial; `docker-compose` antigo não é usado.
- **Instalação interrompida:** se tiver certeza de que não há outro instalador executando, remova a pasta vazia `.install-lock`. Rode novamente sem parâmetros para reutilizar o `.env`.
- **Projetos desapareceram após a migração:** abra o endereço anterior e exporte o JSON. Os dados não são transferidos pela cópia do código.
- **Falha após troca de senha:** `.env.previous` guarda a configuração anterior para recuperação local. Restaure-a e reinicie o serviço se necessário.

Os testes do instalador que não exigem Docker podem ser executados com Python 3. Os testes da interface exigem Node.js:

```bash
python3 tests/deployment.test.py
node tests/agency.test.cjs
```

O teste real do container foi executado com sucesso no GitHub Actions em 23/10/2026, incluindo construção, saúde, autenticação e arquivos estáticos. Para repetir em uma máquina com Docker, Compose e curl:

```bash
bash tests/docker-smoke.sh
```

Ele usa projeto, imagem e porta locais isolados e verifica saúde, autenticação, arquivos, erros 404 e cabeçalhos. A execução real passou no GitHub Actions em 23/10/2026; a validação de DNS e emissão de HTTPS público permanece para a sua VPS. O teste não publica um domínio nem provisiona uma VPS.

## Referências oficiais

- Docker Engine em Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Docker Engine em Debian: https://docs.docker.com/engine/install/debian/
- Docker Compose: https://docs.docker.com/compose/install/linux/
- Imagem oficial Caddy: https://hub.docker.com/_/caddy
- HTTPS automático: https://caddyserver.com/docs/automatic-https
- Autenticação: https://caddyserver.com/docs/caddyfile/directives/basic_auth
- Hash da senha: https://caddyserver.com/docs/command-line#caddy-hash-password
