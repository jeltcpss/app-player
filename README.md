# API de Música

API para streaming de música com funcionalidades de gerenciamento de usuários, playlists, favoritos e histórico.

## Funcionalidades

- Busca e streaming de músicas do YouTube
- Gerenciamento de usuários
- Sistema de playlists
- Lista de favoritos
- Histórico de reprodução
- Streaming de áudio e vídeo
- Interface web amigável

## Tecnologias Utilizadas

- Node.js
- Express
- SQLite
- YouTube API
- DuckDNS para DNS dinâmico

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/api-de-musica.git
cd api-de-musica
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo .env:
```env
PORT=3000
NODE_ENV=development
RATE_LIMITER_ENABLED=false
```

4. Inicie o servidor:
```bash
npm start
```

## Rotas Principais

- `/` - Status da API
- `/doc` - Documentação da API
- `/app` - Interface web
- `/users` - Gerenciamento de usuários
- `/musicas` - Busca e streaming de músicas

## Documentação

Acesse a documentação completa em `/doc` após iniciar o servidor.

## Licença

MIT 