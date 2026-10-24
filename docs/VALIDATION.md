# Verificação do StartSys — 24/10/2026

## Verificado

- Build TypeScript/Vite local e build do GitHub Actions.
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

## Exige conexão/configuração do titular

- Ler o QR Code de um WhatsApp no StartSys e testar envio, recebimento e reprodução de áudio nos celulares.
- Configurar chave/modelo do provedor de IA, testar o agente e então ativar o atendimento automático.
- Validar síntese de voz com a voz escolhida e a conta do provedor.
- Habilitar GitHub Pages com Source = GitHub Actions em Settings → Pages. O primeiro workflow passou build e testes, mas a integração não tinha permissão para habilitar Pages (`Resource not accessible by integration`). Não foi afirmada publicação bem-sucedida do frontend.

Nenhuma mensagem foi enviada a clientes durante a verificação. Os dados fictícios de QA são removidos ao término da validação. A imagem `StartSys_preview.jpg` mostra o modo demonstração, com dados fictícios.
