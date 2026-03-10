# Dictado Médico - APP VOZ (Radiologia)

Um aplicativo web moderno de reconhecimento de voz e transcrição focado no mercado médico, especialmente radiologia.
Transcreve sua fala em tempo real para textos formatados no idioma Português (Brasil).

## 🚀 Funcionalidades Principais

1. **Transcrição em Tempo Real**: Usando a Web Speech API, reconhece e transcreve a fala diretamente pelo navegador, sem necessidade de enviar áudio para servidores de terceiros.
2. **Correção Inteligente e Rápida**: Clique sobre qualquer palavra transcrita para corrigi-la.
3. **Motor de Regras Persistentes**: Ao corrigir e escolher "Corrigir sempre", o aplicativo aprende e passa a substituir aquela palavra automaticamente em todas as transcrições futuras.
   - Suporta substituições ignorando acentuação original (`figado` vira `fígado`), matchings precisos por palavra ou frase e manutenção do formato de maiúscula.
4. **Glossário Médico**: Cadastre termos complexos para facilitar a detecção (usa dicas de gramática da própria API quando o browser suporta) ou agilizar o autocomplete durante uma correção.
5. **Privacidade Total e Persistência Online/Offline**: Tudo fica salvo diretamente no seu navegador utilizando IndexedDB (via `idb-keyval`). Portanto, você não perde suas regras de correção mesmo se fechar a aba!
6. **Interface Premium e Glassmorphic**: Criado com CSS Vanilla de altíssima qualidade visual com temas escuros integrados.

## 📦 Como rodar localmente as fontes

Para rodar como desenvolvedor:
1. Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.
2. Clone/baixe os arquivos e rode no terminal:
   ```bash
   npm install
   npm run dev
   ```
3. Abra o link gerado (ex: `http://localhost:5173/`).

Aviso: o uso de microfone por Web Speech API requer contextos seguros (`https://` ou `localhost`). Além disso, atualmente possui melhor suporte em navegadores derivados do Chromium (Google Chrome, Microsoft Edge, Brave, etc).

## 🛠 Bibliotecas e Arquitetura

- **React e Vite**: Responsável pela reatividade e empacotamento ultrarrápido da aplicação.
- **idb-keyval**: Abstração performática para acesso simplificado do IndexedDB.
- **Lucide React**: Biblioteca minimalista de ícones.

## 💻 Como funciona o Correction Engine?
O motor (`src/engine.js`) é executado reativamente à medida que você fala. Ele processa todas as regras da tabela, que são priorizadas pelo tamanho (palavras ou expressões mais longas são processadas primeiro para evitar colisão parcial de textos).
Regras de palavras inteiras isolam o caractere especial em Regex garantindo que `alvo` mude para `fígado` sem alterar o meio da string `salvo` para `sfígado` equivocadamente.
