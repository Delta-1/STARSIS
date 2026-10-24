# StartSys

CRM focado em atendimento pelo WhatsApp, com interface inspirada no ONLY, navegação móvel, agentes de IA e automações. Código do projeto no repositório **Delta-1/STARSIS**.

## Arquitetura

- **GitHub Pages:** interface React/Vite estática em `/STARSIS/`.
- **GitHub Actions:** validação e publicação automática da interface.
- **Railway:** serviço `StartSys` sempre conectado para WhatsApp/Baileys, APIs e automações.
- **Supabase:** tabelas privadas `startsys_*`. A mesma infraestrutura física do Workspace, com contas, empresas, sessões, contatos e agentes independentes.

GitHub Pages não executa um servidor Node nem mantém sockets do WhatsApp. O Railway executa essa parte continuamente. O Workspace permanece no serviço e repositório originais.

## Usar

1. Acesse a interface e escolha **Criar empresa**. Cadastre seu nome, e-mail e senha exclusiva do StartSys. O cadastro não cria ou altera um usuário do Workspace ou Amora.
2. Informe o nome e segmento da empresa.
3. Em **Conexões**, adicione um WhatsApp e clique em **Conectar**. Leia o QR Code em WhatsApp → Aparelhos conectados. Nunca conectamos seus números existentes automaticamente.
4. Em **Agentes de IA**, crie um agente. Configure identidade, etapas, regras, conhecimento, provedor, modelo, chave de API e voz. Teste a resposta antes de ativá-lo.
5. Ative **Atendimento automático** quando quiser respostas reais. Agentes começam desativados e a chave geral da empresa começa desligada.
6. Em **Agenda**, adicione os horários disponíveis e vendedores. O agente só pode reservar um horário cadastrado e aceito pelo cliente; a reunião fica na agenda do StartSys, com o contexto do contato.
7. Use **CRM** para mover oportunidades por arraste ou seletor. No perfil, mantenha caderno, dados e valor da oportunidade.
8. Em **Automações**, configure follow-up por etapa. Cada regra envia no máximo uma vez por ciclo de conversa. Pedidos de parada e atendimento humano suspendem o follow-up.

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
- O atendimento integrado cobre conversas individuais. Grupos, campanhas em massa e módulos de escritório do Workspace não fazem parte desta versão.
- Cada conta cria uma empresa administrada por seu titular; convite de equipe e permissões por colaborador ainda não foram implementados.
- Recuperação automática de senha por e-mail requer um serviço de e-mail e ainda não está disponível.
- Um QR Code gerado ou um `waId` retornado confirma uma etapa técnica; somente um teste com os celulares confirma recebimento e reprodução do áudio.
- Antes de operar sem supervisão, valide seus agentes com dados da sua empresa, uma conversa real e seus horários cadastrados.
