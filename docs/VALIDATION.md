# Verificação do StartSys — 24/10/2026

## Verificado

- Build TypeScript/Vite local e build do GitHub Actions.
- Oito testes locais de autenticação, revogação/expiração de sessão, isolamento, pausa das automações e preservação do histórico.
- GitHub Pages configurado com Source = GitHub Actions; publicação da interface compilada pelo workflow `pages.yml`.
- Testes de senha, criptografia, proteção de chaves e seleção de agente por etapa.
- Cadastro e login com duas contas fictícias independentes; saída revoga a sessão.
- Empresas distintas não conseguem ler ou alterar contatos, agentes e conexões umas das outras.
- Persistência de contatos, anotações e etapas.
- Criação de agenda e recusa de reserva duplicada no mesmo horário.
- Agente sem chave não pode ser ativado; chaves criptografadas não são devolvidas ao cliente.
- Automações inativas são salvas sem envio; número desconectado recusa envio.
- Backend Railway com deploy SUCCESS e banco respondendo no healthcheck.
- Geração real de QR Code pelo Baileys, sem parear nenhum número, seguida de encerramento da sessão de teste.
- Conversão local de áudio para Ogg/Opus, PTT ativo, duração e waveform de 64 posições.
- Interface desktop, perfil/caderno, layout móvel de 390 px e gaveta de aplicativos. Largura móvel sem rolagem horizontal após ajuste.
- Auditoria das dependências de produção do gateway: nenhum alerta após atualização do Express.
- RLS ativada em todas as tabelas StartSys; papéis anon/authenticated do banco compartilhado sem leitura dessas tabelas.

## Publicação

Interface publicada no GitHub Pages e serviço persistente publicado no Railway. O commit `8aa2622` passou nos workflows de verificação e publicação.

## Exige conexão/configuração do titular

- Ler o QR Code de um WhatsApp no StartSys e testar envio, recebimento e reprodução de áudio nos celulares.
- Configurar chave/modelo do provedor de IA, testar o agente e então ativar o atendimento automático.
- Validar síntese de voz com a voz escolhida e a conta do provedor.
- GitHub Pages e Actions concluíram a publicação com sucesso. A tela de entrada foi verificada em `https://delta-1.github.io/STARSIS/`. O bloqueio inicial de habilitação do Pages foi resolvido.

Nenhuma mensagem foi enviada a clientes durante a verificação. Os dados fictícios de QA são removidos ao término da validação. A imagem `StartSys_preview.jpg` mostra o modo demonstração, com dados fictícios.


## 1.4 — 05/11/2026 (Acre)

- `npm test`: 31 testes, incluindo QR antes do cadastro, preservação do teste ao cadastrar, revogação da sessão temporária, convites com hash e revogação, cadastro por código condicionado à configuração, quadro compartilhado com isolamento entre empresas e conflito de revisão, e invalidação separada por empresa.
- `npm run build`: TypeScript e Vite compilados.
- Prévia no navegador: conversas, abertura de histórico, Kanban, atribuição de responsável, criação/edição de post-it e arraste livre conferidos visualmente. Demonstração não envia mensagens reais.
- Produção: QR real gerado antes do cadastro; nota salva e movida no banco; alteração com revisão antiga rejeitada; cursor autenticado recebido; convites bloqueados no teste; espaço temporário removido e sessão revogada.
- Limites: não foi pareado celular real nesta etapa. Lembretes de post-its exigem o sistema aberto; não há serviço push em segundo plano.

## Mobile — 05/11/2026 (Acre)

- Visual mobile com lista em largura total, cabeçalho próprio, navegação inferior, botão de nova conversa e chat em tela cheia.
- Conferência no navegador em quadros de 320, 390 e 430 pixels: lista, chat, envio em demonstração, Kanban, atribuição de responsável, retorno à fila, quadro branco, menu e tema escuro. Sem envio de mensagens reais nesta etapa.
- Botões de voz/envio alternam conforme o rascunho. A interface usa a altura visível e as margens de segurança do dispositivo.
- TypeScript e build de produção validados. Teclado virtual e permissões de microfone não foram validados em um aparelho físico.

## Grupos — 05/11/2026 (Acre)

- Sincronização mantém nome, quantidade de participantes, permissão de envio e responsável existente.
- Grupos sem mensagens ficam acessíveis pelo filtro Grupos no Kanban; a fila geral conserva apenas conversas com atividade.
- Testes verificam permissão por telefone/LID, grupos restritos a administradores, isolamento por empresa e transferência de grupo entre atendentes.
- Prévia: listagem de grupos, resposta em demonstração com identificação dos autores, bloqueio de envio em grupo de avisos e abertura de grupo vazio no Kanban.
- `npm test`: 36 testes passaram; TypeScript/Vite e sintaxe do servidor validados. Sem envio real para grupos ou contatos durante a verificação.

## Envio e bot pronto — 06/11/2026

- Testes de fila: envio manual passa à frente de cem tarefas de histórico pendentes, com exclusão e ordem preservadas; uma falha não interrompe tarefas seguintes.
- API de envio: HTTP 202 em submissão lenta, consulta posterior, identificadores idempotentes, isolamento por empresa e acesso revogado depois da transferência. Falha ambígua não provoca reenvio.
- Mensagens: confirmação via histórico/push ou POST substitui a bolha pendente, sem duplicar ou regredir a confirmação.
- Chaves Signal: lote criptografado de 200 chaves, leitura por empresa, remoção e falhas de persistência testados.
- Bot padrão: saudação, informações, orçamento, contexto da empresa, pedido de humano, áudio para equipe e opt-out; ativação única habilita o modo híbrido e não altera outra empresa.
- Navegador: botão pronto de ativação e pausa no desktop e em quadro de 390 px. Verificação isolada do hook de envio com API simulada: Enviando imediato, confirmação, falha por desconexão e confirmação incerta por queda de rede. Sem envio para clientes.
- Limite: melhorias foram validadas com fila, API e mídia simuladas/localmente. A latência e o recebimento ponta a ponta precisam de celulares pareados.

- Resultado local final: 46 testes de comportamento e 2 testes de mídia passaram; TypeScript/Vite e sintaxe do servidor aprovados. Testes locais de mídia usaram o FFmpeg disponível no ambiente; CI valida também a dependência ffmpeg-static do servidor.
