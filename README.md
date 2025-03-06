# API de Música - Player Web

API para streaming de música com interface web integrada, oferecendo uma experiência completa de reprodução musical.

## 🎵 Funcionalidades

- **Busca de Músicas**
  - Pesquisa integrada com YouTube
  - Resultados em tempo real
  - Suporte a vídeos e playlists
  - Sem limite de resultados

- **Streaming**
  - Reprodução de áudio em alta qualidade
  - Streaming de vídeo adaptativo
  - Suporte a diferentes qualidades
  - Sem limite de duração

- **Gerenciamento de Usuários**
  - Sistema de contas
  - Controle de validade
  - Monitoramento de uso
  - Sem limite de usuários

- **Recursos Personalizados**
  - Playlists ilimitadas
  - Lista de favoritos ilimitada
  - Histórico de reprodução ilimitado
  - Interface web responsiva
  - Upload sem restrições de tamanho

## 🚀 Tecnologias

- **Backend**
  - Node.js
  - Express
  - SQLite
  - YouTube API

- **Frontend**
  - HTML5
  - CSS3
  - JavaScript
  - Player personalizado

- **Infraestrutura**
  - Render (hospedagem)
  - DuckDNS (DNS dinâmico)
  - Sistema de cache otimizado
  - Sem limites de requisições

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/jeltcpss/app-player.git
cd app-player
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o ambiente**
Crie um arquivo `.env` na raiz do projeto:
```env
PORT=3000
NODE_ENV=development
RATE_LIMITER_ENABLED=false
YOUTUBE_COOKIES=seu_cookie_aqui
MAX_UPLOAD=0
TIMEOUT=0
```

4. **Inicie o servidor**
```bash
npm start
```

## 🛣️ Rotas Principais

### Endpoints Base
- `GET /` - Status da API
- `GET /doc` - Documentação
- `GET /app` - Interface web
- `GET /ping` - Verificação de status

### Endpoints de Usuário
- `POST /users` - Gerenciamento de usuários
- `POST /users/favorites` - Gerenciamento de favoritos
- `POST /users/history` - Gerenciamento de histórico
- `POST /users/playlists` - Gerenciamento de playlists

### Endpoints de Música
- `POST /musicas` - Busca e streaming
- `POST /musicas/auth` - Autenticação YouTube
- `POST /musicas/update-cookies` - Atualização de cookies

## 📚 Documentação

A documentação completa está disponível em:
- Local: `http://localhost:3000/doc`
- Produção: `https://app-player.onrender.com/doc`

## 🔧 Configuração

### Variáveis de Ambiente
- `PORT` - Porta do servidor (padrão: 3000)
- `NODE_ENV` - Ambiente (development/production)
- `RATE_LIMITER_ENABLED` - Controle de requisições (padrão: false)
- `YOUTUBE_COOKIES` - Cookies do YouTube
- `MAX_UPLOAD` - Tamanho máximo de upload (0 = ilimitado)
- `TIMEOUT` - Tempo máximo de resposta (0 = ilimitado)

### Limites do Sistema
- **Rate Limit**: Desativado por padrão
- **Upload**: Sem limite de tamanho
- **Timeout**: Sem limite de tempo
- **Requisições**: Sem limite por IP
- **Conexões**: Sem limite por usuário
- **Armazenamento**: Limitado apenas pelo disco disponível
- **Streaming**: Sem limite de duração
- **Cache**: Otimizado automaticamente

### Requisitos
- Node.js 18+
- NPM ou Yarn
- Conexão com internet

## �� Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🤝 Suporte

Para suporte, envie um email para jeffingames@gmail.com ou abra uma issue no GitHub. 