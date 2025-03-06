import express from 'express'; //importar express
import cors from 'cors'; //importar cors
import helmet from 'helmet'; //importar helmet
import rateLimit from 'express-rate-limit'; //importar rateLimit
import path from 'path'; //importar path
import { fileURLToPath } from 'url'; //importar fileURLToPath
import { dirname } from 'path'; //importar dirname
import { config } from 'dotenv'; //importar dotenv

// Carregar variáveis de ambiente do arquivo .env
config();

import { errorHandler, corsOptions, rateLimiter, securityMiddleware } from './Middleware/Middleware.js'; //importar Middleware
import userRoutes from './Rotas/UserRoutes.js'; //importar UserRoutes
import favoriteRoutes from './Rotas/FavoriteRoutes.js'; //importar FavoriteRoutes
import historyRoutes from './Rotas/HistoryRoutes.js'; //importar HistoryRoutes
import playlistRoutes from './Rotas/PlaylistRoutes.js'; //importar PlaylistRoutes
import musicasRoutes from './Rotas/Musicas.js'; //importar Musicas

// Importar node-fetch
const fetchImport = await import('node-fetch');
const fetch = fetchImport.default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS - Permitir tudo
app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
    exposedHeaders: '*',
    credentials: true,
    maxAge: 86400,
    preflightContinue: true,
    optionsSuccessStatus: 200
}));

// Middleware adicional para CORS - Permitir tudo
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Middlewares de segurança
app.use(helmet(securityMiddleware.helmet)); //usar helmet
app.use(express.json(securityMiddleware.bodyParser)); //usar bodyParser

// Configuração para servir arquivos estáticos do frontend
app.use('/app', express.static(path.join(__dirname, '../../api-de-musica-front')));

// Rota principal do app
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, '../../api-de-musica-front/index.html'));
});

// Configuração para confiar em proxies
app.set('trust proxy', true);

// Configuração do rate limiter baseado na variável de ambiente
const RATE_LIMITER_ENABLED = process.env.RATE_LIMITER_ENABLED === 'true';
if (RATE_LIMITER_ENABLED) {
    app.use(rateLimit(rateLimiter));
    console.log('Rate Limiter está ATIVADO');
} else {
    console.log('Rate Limiter está DESATIVADO');
}

// Middleware de logging
app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const ip = req.ip || req.connection.remoteAddress || 'IP não detectado';
    
    // Capturar o corpo da requisição de forma segura
    const reqBody = req.body ? JSON.stringify({
        method: req.body.method,
        data: req.body.data
    }) : 'Sem corpo';

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
            `[${timestamp}] ` +
            `IP: ${ip} | ` +
            `${req.method} ${req.url} | ` +
            `Request: ${reqBody} | ` +
            `Status: ${res.statusCode} | ` +
            `Duração: ${duration}ms`
        );
    });
    next();
});

// Função para atualizar o DuckDNS
async function updateDuckDNS() {
    try {
        // Obter IP público do ipify
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const publicIP = ipData.ip;

        // Atualizar DuckDNS
        const duckDNSUrl = `https://www.duckdns.org/update?domains=jeffingames&token=133fda3f-7fa3-45f5-916d-adca864524aa&ip=${publicIP}`;
        const response = await fetch(duckDNSUrl);
        const result = await response.text();

        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] DuckDNS atualizado com IP ${publicIP}. Resultado: ${result}`);
    } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] Erro ao atualizar DuckDNS:`, error);
    }
}

// Executar a atualização a cada hora
setInterval(updateDuckDNS, 3600000); // 3600000 ms = 1 hora
// Executar imediatamente na inicialização
updateDuckDNS();

// Rotas
app.use('/users', userRoutes); //usar userRoutes
app.use('/users', favoriteRoutes); //usar favoriteRoutes
app.use('/users', historyRoutes); //usar historyRoutes
app.use('/users', playlistRoutes); //usar playlistRoutes
app.use('/musicas', musicasRoutes); //usar musicasRoutes

// Status da API
app.get('/', (req, res) => { //rota para status da API
    res.json({ //resposta em JSON
        status: 'API está funcionando!', //status da API
        versao: process.env.npm_package_version || '1.0.0', //versão da API
        ambiente: process.env.NODE_ENV || 'development' //ambiente da API
    });
});

app.get('/doc', (req, res) => {
    res.sendFile(path.join(__dirname, 'doc', 'index.html'));
});

// Rota 404 para endpoints não encontrados
app.use((req, res) => { //rota para endpoints não encontrados
    res.status(404).json({ //status 404
        erro: 'Rota não encontrada', //erro
        detalhes: `A rota ${req.method} ${req.url} não existe nesta API` //detalhes do erro
    });
});

// Middleware de tratamento de erros
app.use(errorHandler); //usar errorHandler

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => { //tratamento de erros não capturados
    console.error('Erro não capturado:', error); //logar o erro
    process.exit(1); //encerrar o processo
});

process.on('unhandledRejection', (reason, promise) => { //tratamento de promessas rejeitadas não tratadas
    console.error('Promessa rejeitada não tratada:', reason); //logar a promessa rejeitada
});

// Iniciar o servidor
app.listen(port, '0.0.0.0', () => {
    console.log(`API rodando na porta ${port}`);
    console.log(`URL local: http://localhost:${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Recebido sinal SIGTERM. Iniciando shutdown graceful...'); //logar o sinal SIGTERM
    process.exit(0); //encerrar o processo
});
