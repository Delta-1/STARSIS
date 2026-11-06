# Funcionalidades do Starsis

Estado do código: 06/11/2026. Recursos que dependem do WhatsApp precisam de um número conectado. A demonstração usa apenas dados fictícios.

| Área | Disponível |
| --- | --- |
| Entrada | QR antes do cadastro; teste por 24 horas; salvar a conta preservando o espaço; entrar em conta existente; login próprio, manter conectado e mostrar senha |
| Empresa e equipe | Espaços separados; código da empresa; convite para cadastro; senha individual; ativar/desativar funcionários; redefinir senha de funcionário e revogar suas sessões |
| Conversas | Contatos individuais e grupos; nome/número e filtros; não lidas, favoritas, fixadas e arquivadas; histórico paginado; abrir nas mensagens recentes; busca nas mensagens carregadas |
| Mensagens | Texto, imagens, vídeos, PDF/documentos permitidos; gravar e revisar voz; Ogg/Opus/PTT; biblioteca de figurinhas; respostas citadas; reações; copiar, editar no prazo, apagar quando permitido, encaminhar e baixar anexos |
| Grupos | Sincronizar grupos do número; listar grupos vazios; participantes identificados nas mensagens; responder e atender em equipe; convite válido pela API; respeitar grupos restritos a administradores |
| Envio | Bolha imediata com estado de envio; reconciliação sem duplicatas; prioridade sobre histórico; consulta de confirmação; sem reenvio automático em falha ambígua |
| Kanban de atendimento | A fazer e Em andamento; assumir com exclusividade; transferir responsável; finalizar, preservar histórico e reabrir; acesso do atendente limitado à conversa atribuída |
| CRM | Perfil, empresa, e-mail, notas, etiquetas, valor de oportunidade; funil de vendas separado do atendimento; responsável humano ou agente |
| Quadro branco | Post-its compartilhados; título/texto, cores, arrastar livremente ou mover por teclado; zoom; marcar concluído; lembretes com o aplicativo aberto; proteção contra edição concorrente |
| Bot padrão | Sofia pronta para ativar, sem chave; saudação, informações, orçamento e transferência para humano; uso dos dados cadastrados da empresa; resumo e respeito a pausa/opt-out |
| IA opcional | Agentes por etapa, nome, personalidade, regras e conhecimento; provedores Gemini, OpenAI e Anthropic; teste do agente; chave protegida no servidor; compreensão de áudio com Gemini; voz com provedores configurados |
| Automações | Editor visual com mensagens, áudios, condições, espera, IA e encaminhamento; biblioteca de áudios; execução persistente, histórico, cancelamento; follow-ups por etapa e intervalo |
| Agenda | Horários disponíveis, agendamento interno, cancelamento/conclusão e prevenção de conflito; lembretes com sistema aberto |
| Assistente pessoal | Modo uso próprio; chat privado com IA configurada; resumo e relatórios de mensagens; respostas com atraso configurável; aprovações antes do envio e avisos configuráveis |
| Indicadores e avisos | Painel com dados registrados, atividade de agentes, relatórios de mensagens, alertas internos e notificações do navegador com o aplicativo aberto |
| Interface | Layout inspirado no WhatsApp Web; chat móvel em tela cheia; temas claro/escuro; menu de aplicativos e navegação móvel |
| Proteção | Senhas com scrypt; tokens revogáveis; limitação de tentativas; dados separados por empresa; permissão checada novamente no envio; credenciais criptografadas e tabelas privadas |

## O que ainda falta ou vale priorizar

1. Validar envio, recebimento, áudio e grupos com celulares reais após a otimização e medir a entrega. Testes locais e implantação não comprovam o recebimento no aparelho.
2. Setores e líderes com permissões próprias, distribuição automática de atendimentos e indicadores de SLA/tempo de resposta por atendente.
3. Respostas rápidas de texto por atalhos e exportação de contatos/relatórios com filtros mais completos.
4. Recuperação automática de senha por e-mail. Hoje existe redefinição de senha de funcionário pelo administrador.
5. Notificações push e lembretes quando o aplicativo estiver fechado.
6. Pesquisa em todo o histórico no servidor, sincronização com Google Calendar e rotinas de backup/restauração acessíveis ao administrador.
7. Administração avançada de participantes e composição de menções em grupos. Chamadas, Status e Canais do WhatsApp não estão implementados.
8. Treinar e validar agentes de IA com preços, serviços e regras reais de cada empresa, caso se opte por respostas livres. O bot pronto atual é baseado em roteiro.

A interface é inspirada no WhatsApp; essa lista não representa paridade completa com todas as funções do aplicativo oficial.
