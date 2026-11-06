# STARSIS

CRM focado em atendimento pelo WhatsApp, com visual familiar ao WhatsApp Web, Kanban de atendimento para equipes, quadro branco compartilhado, agentes de IA e automações. Código do projeto no repositório **Delta-1/STARSIS**.

## Arquitetura

- **GitHub Pages:** interface React/Vite estática em `/STARSIS/`.
- **GitHub Actions:** validação e publicação automática da interface.
- **Railway:** serviço `StartSys` sempre conectado para WhatsApp/Baileys, APIs e automações.
- **Supabase:** tabelas privadas `startsys_*`. A mesma infraestrutura física do Workspace, com contas, empresas, sessões, contatos e agentes independentes.

GitHub Pages não executa um servidor Node nem mantém sockets do WhatsApp. O Railway executa essa parte continuamente. O Workspace permanece no serviço e repositório originais.

## Usar

1. Acesse https://delta-1.github.io/STARSIS/. A primeira tela prepara um **QR Code real**, antes do cadastro. Leia em WhatsApp → Aparelhos conectados.
2. Após conectar, escolha **Testar o CRM agora**, **Salvar meu acesso** ou **Entrar na minha conta**. O teste dura 24 horas; sua empresa começa com respostas automáticas desligadas. Salvar o cadastro mantém o número, o espaço e as conversas. Ao entrar em uma conta que já tem empresa, abre-se a empresa existente e encerra-se a conexão temporária. Contas sem empresa aproveitam a conexão do teste.
3. Na tela de conversas, pesquise contatos, responda mensagens citadas, envie arquivos, voz e figurinhas, reaja, edite textos dentro do prazo e encaminhe mensagens. O perfil permite fixar, favoritar e arquivar contatos.
4. Em **Funcionários**, habilite a equipe, gere o **link de cadastro** e distribua-o aos atendentes. Cada pessoa cria nome e senha e já entra no atendimento da empresa. O link dura sete dias e pode ser revogado; gerar outro substitui o anterior. Também há cadastro por código de quatro dígitos, quando explicitamente habilitado pelo administrador, além do acesso individual criado pelo administrador.
5. O **Kanban de atendimento** é operacional: **A fazer** e **Em andamento**. Assumir reserva a conversa para uma única pessoa; transferência revoga o acesso do responsável anterior. Finalizar preserva o histórico e uma nova mensagem reabre a fila. O funil de vendas continua disponível em **Aplicativos → Oportunidades**.
6. O **Quadro branco** é compartilhado por todos da empresa. Crie post-its, escolha a cor, edite o texto, arraste livremente e marque como concluído. Setas do teclado também movem as notas. Um lembrete opcional gera aviso dentro do Starsis e, com permissão, no navegador, enquanto o sistema estiver aberto. Notas usam revisão para evitar sobrescrever mudanças simultâneas.
7. Configure agentes de IA, automações e agenda em **Aplicativos**. A chave de API continua somente no servidor. O atendimento automático precisa ser habilitado explicitamente.

**Demonstração** usa dados fictícios em memória e não envia mensagens nem altera a empresa real. Números reais, leitura do QR Code e a chave de IA do provedor são necessários para operar.

## Recursos implementados

- Tema escuro e claro; menu desktop e navegação inferior móvel com gaveta de aplicativos.
- Cadastro/login exclusivos, senha com scrypt, sessões revogáveis e opção de manter conectado.
- WhatsApps separados por empresa, QR Code e retomada de sessão após reinício.
- Conversas individuais, pesquisa por nome/número, filtros, histórico, anexos, encaminhamento e notas de voz em Ogg/Opus/PTT.
- Gravação com revisão antes do envio, edição de texto no prazo e exclusão para todos quando permitidas pelo WhatsApp.
- Notas compartilhadas com agentes, funil de vendas, responsáveis, etiquetas e valor de oportunidade.
- Agentes com nome, personalidade, regras, conhecimento, etapas, provedor/modelo e voz. Contato pode ter especialista fixo ou seleção automática por etapa.
- Compreensão de áudio com Gemini; respostas de voz com ElevenLabs ou alternativa Gemini. Falhas de voz são sinalizadas e usam texto.
- Agenda interna, horários cadastrados, contexto para o vendedor e detecção de conflito de horário.
- Follow-up persistente executado no Railway. Eventos e falhas aparecem no painel.
- Indicadores calculados com os registros carregados, sem números fictícios na empresa real.

## Desenvolvimento

```bash
npm ci
npm run dev
npm test
npm run build
```

`VITE_GATEWAY_URL` é a URL pública do backend, não uma chave. Nunca coloque segredos em variáveis `VITE_*`, no Pages ou no workflow.

Para executar o backend, instale as dependências em `gateway/`, configure as variáveis abaixo e use `npm start` nessa pasta.

## Backend no Railway

Serviço: `StartSys`, no mesmo projeto do serviço `WORKSPACES`, com root directory `/gateway` e healthcheck `/health`.

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | Endpoint do banco |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso somente no servidor às tabelas privadas |
| `STARTSYS_SERVICE_SECRET` | Chave estável para proteger credenciais em repouso; não alterar sem migrar as credenciais |
| `ALLOWED_ORIGINS` | Origens permitidas, incluindo `https://delta-1.github.io` |
| `ELEVENLABS_API_KEY` | Síntese de voz opcional |
| `PORT` | Porta do serviço, 8080 |

O Railway recebe referências às variáveis do serviço existente, sem publicá-las nem modificar o serviço Workspace. As credenciais WhatsApp e as chaves dos agentes ficam criptografadas no banco. As tabelas têm RLS habilitada e acesso revogado para `anon` e `authenticated` do projeto compartilhado; toda autorização por empresa é feita no backend.

Esquemas versionados em `gateway/schema.sql` e `gateway/auth-schema.sql`. Não reaplicar em um banco onde já foram instalados. Faça backup antes de migrations futuras.

## GitHub Pages

O workflow `pages.yml` gera `dist/`, publica com `actions/deploy-pages` e pode ser executado manualmente. Se o primeiro workflow avisar que Pages não está habilitado, configure **Settings → Pages → Source: GitHub Actions** e execute novamente. URL esperada após publicação: `https://delta-1.github.io/STARSIS/`.

## Limites da primeira versão

- A agenda é interna; não existe sincronização com Google Calendar.
- Conversas individuais e grupos são suportados. Sincronize grupos em Conexões; entre por convite válido. A IA começa pausada nos grupos e, quando liberada, só responde a menções ou respostas diretas. Campanhas em massa não estão incluídas.
- Cada conta de administrador cria seu próprio espaço. Funcionários entram por código da empresa e senha individual, com acesso restrito ao atendimento Kanban.
- Recuperação automática de senha por e-mail requer um serviço de e-mail e ainda não está disponível.
- Um QR Code gerado ou um `waId` retornado confirma uma etapa técnica; somente um teste com os celulares confirma recebimento e reprodução do áudio.
- Antes de operar sem supervisão, valide seus agentes com dados da sua empresa, uma conversa real e seus horários cadastrados.

## Uso próprio e mídia (1.2)

Escolha **Para empresa** ou **Para uso próprio** ao criar o espaço; é possível mudar nas configurações. Uso próprio oferece Meu dia, Meu assistente (chat privado), relatórios, agenda e pedidos de aprovação. Configure a chave de IA em Meus bots, mesmo se não ativar o bot no WhatsApp. Escolha responder como assistente ou no seu tom, após 1, 2 ou 5 minutos. Uma resposta manual cancela a resposta automática pendente. Assuntos incertos podem ser aprovados e editados antes do envio.

Os avisos ficam no aplicativo. Para recebê-los em outro WhatsApp seu, informe DDI/DDD/número nas configurações e habilite os avisos. Esse número pode conversar em particular com o assistente e responder `APROVAR CÓDIGO`. Notificações do navegador funcionam enquanto o aplicativo estiver aberto. A agenda gera lembretes cinco minutos antes; não integra Google Calendar.

Áudios WebM/Opus e AAC são decodificados por completo e convertidos em Ogg/Opus mono, com validação de estrutura, CRC e reprodução pelo FFmpeg. A criptografia de transporte é testada offline com a versão instalada do Baileys. O envio também verifica o arquivo criptografado no CDN do WhatsApp antes de compartilhar a mensagem.

Figurinhas: salve imagens/figurinhas recebidas ou adicione PNG/JPEG/WebP na coleção. Imagens viram WebP 512 × 512; animações já compatíveis são preservadas. Limite: 200 por espaço. Contatos usam o telefone real quando o WhatsApp disponibiliza o mapeamento; identificadores LID nunca são apresentados como telefone. A sincronização importa contatos e o histórico disponibilizado pelo WhatsApp, que pode não incluir todo o histórico antigo do celular.

A chave `ELEVENLABS_API_KEY` fica no servidor. O cadastro do bot recebe somente o ID da voz opcional. Sem ID, usa-se a voz padrão.

Validação: `npm test`, `npm run build` e, após `npm ci --prefix gateway`, `npm run test:media`.

## Equipe de suporte e automações visuais (1.3)

Na criação da empresa, escolha **Só agentes de IA e automações**, **Equipe de funcionários** ou **Funcionários + agentes de IA**. A opção também fica em Configurações. Em **Funcionários**, o administrador habilita a equipe, cria o nome de cada funcionário e copia o acesso. O **código da empresa tem quatro dígitos** e aparece também na página inicial; a **senha individual é gerada automaticamente**, aparece somente ao criar/redefinir e pode ser trocada pelo funcionário. Na tela de entrada, use a aba **Funcionário**, com código da empresa e senha, sem e-mail. O código identifica a empresa e não substitui a senha.

Funcionários usam sempre o Kanban de atendimento, inspirado no segundo modo do Workspaces: **A fazer** e **Em andamento**. Ao assumir, a conversa recebe um responsável exclusivo. **Transferir** revoga imediatamente o acesso do responsável anterior; **Finalizar** preserva as mensagens na lista de finalizados, e uma nova mensagem do contato reabre a fila com o histórico contínuo. O administrador acompanha os atendimentos e escolhe o responsável. Funcionários não acessam chaves, configurações, agentes, relatórios privados nem o chat pessoal do administrador. Desativar ou redefinir a senha encerra sessões; desativar também devolve os atendimentos abertos à fila.

**Automações → Áudios salvos** permite gravar/revisar/nomear ou importar vários arquivos de uma vez (inclusive uma sequência de 30). A biblioteca é privada da empresa: até 500 áudios, 16 MB por entrada, convertidos para mensagem de voz Ogg/Opus. Os áudios podem ser revisados e enviados pelo funcionário durante o atendimento.

O editor de **Fluxos visuais** é nativo do STARSIS, no estilo de conexão por blocos do n8n; não é uma instalação do n8n. Oferece Início, Enviar texto, Enviar áudio, Condição, Aguardar, Esperar resposta, Consultar IA, Atendimento humano e Fim. Arraste os blocos e conecte suas saídas; no celular, também use os seletores de destino. A simulação percorre o caminho sem enviar mensagens ou consultar provedores. Os fluxos têm até 60 blocos, sem ciclos, e podem funcionar sem nenhum agente; o bloco Consultar IA usa apenas o agente escolhido naquela etapa, mesmo que ele esteja desligado no atendimento geral.

O fluxo pode começar manualmente no atendimento ou quando chegar uma mensagem correspondente. Início automático requer o atendimento automático geral ligado e respeita pausa, responsável humano, opt-out, prioridade e intervalo por contato. Grupos não acionam esses fluxos. Um fluxo ativo impede respostas concorrentes do bot e follow-ups. Fluxos manuais são autorizados explicitamente pelo operador e funcionam com o automático geral desligado. A resposta manual, transferência, finalização ou desativação do responsável interrompe os próximos envios. Esperas e execuções ficam persistidas no servidor, mesmo com o aplicativo fechado. Na aba **Execuções**, o administrador acompanha e interrompe fluxos. Falhas de envio ambíguas exigem revisão e não são reenviadas automaticamente após reinício.

Dados de equipe e fluxos utilizam as tabelas privadas já existentes; contas técnicas internas de funcionários não são endereços de e-mail do usuário. Senhas usam scrypt; busca do acesso utiliza uma impressão HMAC do servidor, e sessões guardam somente hashes de tokens. Índices de unicidade e das filas estão em `supabase/migrations/*_startsys_team_and_flow_indexes.sql`. Essa atualização não habilita equipes nem cria funcionários ou fluxos automaticamente para contas existentes.

Validação adicional: testes locais de entrada de funcionário, isolamento por empresa, atribuição concorrente, transferência, revogação de sessão, reset de senha, 30 áudios em um fluxo, condições, espera por resposta, interrupção por atendimento humano e preservação do histórico das execuções. Os testes de navegador usam banco em memória e WhatsApp simulado, sem enviar mensagens a contatos reais.

## Atualização 1.4 — entrada, atendimento e quadro

Sem migração de banco: novos registros usam as tabelas privadas existentes. O endpoint autenticado `/changes` mantém uma consulta de até 25 segundos e retorna somente um cursor de invalidação; dados são buscados novamente com autorização atual. O cursor é separado por empresa, e a interface atualiza também após voltar à aba ou recuperar internet.

Testes temporários recebem tokens limitados a 24 horas, criação limitada por IP e limpeza automática de conexões e registros expirados. Convites não contêm o código empresarial nem senhas; somente o hash do token fica salvo. Funcionários continuam sem acesso às chaves, dados privados do administrador ou conversas atribuídas a outra pessoa.

A interface é inspirada no WhatsApp Web; não é uma implementação integral do cliente oficial. Chamadas de voz/vídeo, Status e Canais não estão implementados. Histórico antigo depende do que o WhatsApp disponibiliza na vinculação. Validação de envio, recebimento, áudio e mídia com celulares reais ainda precisa de um número pareado pelo responsável.

## Grupos no atendimento (1.4.1)

Em **Conversas → Grupos**, abra um grupo e responda no próprio grupo, incluindo texto, áudio, anexos, figurinhas e resposta citada. O botão **Sincronizar** busca os grupos do WhatsApp conectado; essa sincronização também ocorre ao conectar. É possível entrar em grupo por convite em Conexões, respeitando eventual aprovação dos administradores.

No Kanban, o filtro **Grupos** inclui grupos sincronizados sem mensagens anteriores. O atendente assume o grupo para abrir o histórico e responder; transferência muda o responsável e revoga o acesso anterior. Cada mensagem recebida mostra autor; respostas humanas enviadas pelo Starsis registram o operador dentro do CRM. Isso não acrescenta assinatura automática ao texto enviado para o WhatsApp.

Grupos de avisos que só aceitam administradores têm o envio bloqueado quando o número conectado não é administrador. A permissão é conferida novamente no WhatsApp a cada envio. A IA continua pausada por padrão nos grupos.
