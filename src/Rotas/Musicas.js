import express from 'express';
import yts from 'yt-search';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const router = express.Router();

// Rota para autenticação do YouTube
router.get('/auth', (req, res) => {
    const htmlPage = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login YouTube - App Player</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    background: #f0f0f0;
                }
                .container {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .error {
                    color: #d32f2f;
                    background: #ffebee;
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                    display: none;
                }
                .success {
                    color: #388e3c;
                    background: #e8f5e9;
                    padding: 10px;
                    border-radius: 4px;
                    margin: 10px 0;
                    display: none;
                }
                button {
                    background: #1a73e8;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                }
                button:hover {
                    background: #1557b0;
                }
                .instructions {
                    margin-top: 20px;
                    padding: 15px;
                    background: #e3f2fd;
                    border-radius: 4px;
                }
                .instructions h3 {
                    margin-top: 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Login YouTube - App Player</h2>
                <div id="cookieError" class="error">
                    ⚠️ Os cookies estão desativados no seu navegador. Por favor, ative-os para continuar.
                </div>
                <div id="cookieSuccess" class="success">
                    ✅ Cookies estão ativados! Você pode prosseguir com o login.
                </div>
                
                <div id="loginSection" style="display: none;">
                    <p>Clique no botão abaixo para fazer login no YouTube:</p>
                    <button onclick="redirectToYoutube()">Fazer Login no YouTube</button>
                </div>

                <div class="instructions">
                    <h3>Como ativar os cookies:</h3>
                    <p><strong>No Chrome:</strong></p>
                    <ol>
                        <li>Clique nos três pontos no canto superior direito</li>
                        <li>Vá em "Configurações"</li>
                        <li>Na seção "Privacidade e segurança"</li>
                        <li>Em "Cookies e outros dados do site"</li>
                        <li>Selecione "Permitir todos os cookies"</li>
                    </ol>
                    <p><strong>Após ativar os cookies, atualize esta página.</strong></p>
                </div>
            </div>

            <script>
                function checkCookies() {
                    const cookiesEnabled = navigator.cookieEnabled;
                    const errorDiv = document.getElementById('cookieError');
                    const successDiv = document.getElementById('cookieSuccess');
                    const loginSection = document.getElementById('loginSection');

                    if (cookiesEnabled) {
                        errorDiv.style.display = 'none';
                        successDiv.style.display = 'block';
                        loginSection.style.display = 'block';
                    } else {
                        errorDiv.style.display = 'block';
                        successDiv.style.display = 'none';
                        loginSection.style.display = 'none';
                    }
                }

                function redirectToYoutube() {
                    window.location.href = 'https://accounts.google.com/signin/v2/identifier?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Dpt%26next%3Dhttps%253A%252F%252Fwww.youtube.com%252F&hl=pt-BR&ec=65620&flowName=GlifWebSignIn&flowEntry=ServiceLogin';
                }

                // Verificar cookies ao carregar a página
                window.onload = checkCookies;
            </script>
        </body>
        </html>
    `;

    res.send(htmlPage);
});

// Rota para callback após o login
router.get('/auth/callback', (req, res) => {
    // Extrair cookies do cabeçalho da requisição
    const cookies = req.headers.cookie;
    
    if (cookies) {
        // Atualizar cookies nas opções do ytdl
        ytdlOptions.requestOptions.headers.Cookie = cookies;
        process.env.YOUTUBE_COOKIES = cookies;

        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Login Concluído - App Player</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background: #f0f0f0;
                    }
                    .container {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    .success-icon {
                        font-size: 48px;
                        color: #388e3c;
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success-icon">✅</div>
                    <h2>Login Realizado com Sucesso!</h2>
                    <p>Você pode fechar esta janela e voltar ao App Player.</p>
                </div>
            </body>
            </html>
        `;
        res.send(htmlResponse);
    } else {
        const errorHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Erro no Login - App Player</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                        background: #f0f0f0;
                    }
                    .container {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        text-align: center;
                    }
                    .error-icon {
                        font-size: 48px;
                        color: #d32f2f;
                        margin-bottom: 20px;
                    }
                    .retry-button {
                        background: #1a73e8;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                        text-decoration: none;
                        display: inline-block;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <h2>Falha no Login</h2>
                    <p>Não foi possível obter os cookies de autenticação.</p>
                    <a href="/musicas/auth" class="retry-button">Tentar Novamente</a>
                </div>
            </body>
            </html>
        `;
        res.status(401).send(errorHtml);
    }
});

// Configurações do ytdl para evitar detecção de bot
const ytdlOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cookie': process.env.YOUTUBE_COOKIES || ''
        }
    },
    lang: 'pt-BR'
};

/**
 * Formata a duração do vídeo para MM:SS ou HH:MM:SS
 * @param {Object|number} duration Duração do vídeo em segundos ou objeto
 * @returns {string} Duração formatada
 */
function formatarDuracao(duration) {
    // Se for um número (segundos totais)
    if (typeof duration === 'number') {
        const horas = Math.floor(duration / 3600);
        const minutos = Math.floor((duration % 3600) / 60);
        const segundos = duration % 60;

        if (horas > 0) {
            return `${horas}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        }
        return `${minutos}:${segundos.toString().padStart(2, '0')}`;
    }
    
    // Se for um objeto com timestamp
    if (duration.timestamp) {
        return duration.timestamp;
    }
    
    // Se for um objeto com seconds
    if (duration.seconds !== undefined) {
        const horas = Math.floor(duration.seconds / 3600);
        const minutos = Math.floor((duration.seconds % 3600) / 60);
        const segundos = duration.seconds % 60;

        if (horas > 0) {
            return `${horas}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
        }
        return `${minutos}:${segundos.toString().padStart(2, '0')}`;
    }

    return '0:00'; // Fallback para duração desconhecida
}

/**
 * Busca vídeos no YouTube
 * @param {string} termo Termo para buscar
 * @param {number} limite Número máximo de resultados (padrão: 100)
 * @returns {Promise<Array>} Lista de vídeos encontrados
 */
async function buscar(termo, limite = 100) {
    try {
        const resultado = await yts({
            search: termo,
            pages: Math.ceil(limite / 20),
            userAgent: ytdlOptions.requestOptions.headers['User-Agent']
        });
        
        return resultado.videos.slice(0, limite).map(video => ({
            id_song: video.videoId,
            song_name: video.title,
            song_artist: video.author.name,
            song_duration: video.duration.seconds,
            song_thumbnail: video.thumbnail,
            song_url: video.url
        }));
    } catch (erro) {
        console.error('Erro na busca:', erro);
        return [];
    }
}

// Rota para atualizar cookies
router.post('/update-cookies', (req, res) => {
    try {
        const { cookies } = req.body;
        if (!cookies) {
            return res.status(400).json({
                erro: 'Cookies não fornecidos',
                detalhes: 'É necessário fornecer os cookies do YouTube'
            });
        }

        // Atualizar cookies nas opções do ytdl
        ytdlOptions.requestOptions.headers.Cookie = cookies;
        
        // Atualizar variável de ambiente
        process.env.YOUTUBE_COOKIES = cookies;

        return res.json({
            mensagem: 'Cookies atualizados com sucesso',
            detalhes: 'Os cookies do YouTube foram atualizados'
        });
    } catch (erro) {
        console.error('Erro ao atualizar cookies:', erro);
        return res.status(500).json({
            erro: 'Erro ao atualizar cookies',
            detalhes: erro.message
        });
    }
});

// Rota unificada para todas as operações de música
router.post('/', async (req, res) => {
    try {
        if (!req.body || !req.body.method || !req.body.data) {
            return res.status(400).json({
                erro: 'Dados não fornecidos',
                detalhes: 'O método e os dados são obrigatórios'
            });
        }

        const { method, data } = req.body;

        switch (method.toLowerCase()) {
            case 'search':
                if (!data.termo) {
                    return res.status(400).json({ 
                        erro: 'Termo de busca não fornecido',
                        detalhes: 'É necessário fornecer o termo de busca'
                    });
                }
                
                const videos = await buscar(data.termo, data.limite);
                
                if (!videos || videos.length === 0) {
                    return res.status(404).json({
                        erro: 'Nenhum vídeo encontrado',
                        detalhes: 'A busca não retornou resultados'
                    });
                }
                
                return res.json({
                    termo_busca: data.termo,
                    total: videos.length,
                    musicas: videos
                });

            case 'video_info':
                if (!data.url) {
                    return res.status(400).json({
                        erro: 'URL não fornecida',
                        detalhes: 'É necessário fornecer a URL do vídeo'
                    });
                }

                const videoInfo = await ytdl.getInfo(data.url, ytdlOptions);
                const videoFormat = ytdl.chooseFormat(videoInfo.formats, {
                    quality: '18',
                    filter: format => format.container === 'mp4'
                });

                return res.json({
                    id_song: videoInfo.videoDetails.videoId,
                    song_name: videoInfo.videoDetails.title,
                    song_artist: videoInfo.videoDetails.author.name,
                    song_duration: parseInt(videoInfo.videoDetails.lengthSeconds),
                    song_thumbnail: videoInfo.videoDetails.thumbnails[0].url,
                    song_url: data.url,
                    formato: videoFormat.container,
                    qualidade: videoFormat.qualityLabel,
                    tamanho: videoFormat.contentLength
                });

            case 'audio_info':
                if (!data.url) {
                    return res.status(400).json({
                        erro: 'URL não fornecida',
                        detalhes: 'É necessário fornecer a URL do vídeo'
                    });
                }

                const audioInfo = await ytdl.getInfo(data.url, ytdlOptions);
                const audioFormat = ytdl.chooseFormat(audioInfo.formats, {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });

                return res.json({
                    id_song: audioInfo.videoDetails.videoId,
                    song_name: audioInfo.videoDetails.title,
                    song_artist: audioInfo.videoDetails.author.name,
                    song_duration: parseInt(audioInfo.videoDetails.lengthSeconds),
                    song_thumbnail: audioInfo.videoDetails.thumbnails[0].url,
                    song_url: data.url,
                    formato: audioFormat.container,
                    qualidade: audioFormat.audioQuality,
                    tamanho: audioFormat.contentLength
                });

            case 'video_stream':
                if (!data.url) {
                    return res.status(400).json({
                        erro: 'URL não fornecida',
                        detalhes: 'É necessário fornecer a URL do vídeo'
                    });
                }

                const info = await ytdl.getInfo(data.url, ytdlOptions);
                res.header('Content-Type', 'video/mp4');
                const video = ytdl(data.url, {
                    ...ytdlOptions,
                    quality: '18',
                    filter: format => format.container === 'mp4'
                });
                return video.pipe(res);

            case 'audio_stream':
                if (!data.url) {
                    return res.status(400).json({
                        erro: 'URL não fornecida',
                        detalhes: 'É necessário fornecer a URL do vídeo'
                    });
                }

                const range = req.headers.range;
                const audioStreamInfo = await ytdl.getInfo(data.url, ytdlOptions);
                
                if (!range) {
                    res.header('Content-Type', 'audio/mp3');
                    const audio = ytdl(data.url, {
                        ...ytdlOptions,
                        quality: 'highestaudio',
                        filter: 'audioonly'
                    });
                    return audio.pipe(res);
                }

                const audioStreamFormat = ytdl.chooseFormat(audioStreamInfo.formats, {
                    quality: 'highestaudio',
                    filter: 'audioonly'
                });
                
                const contentLength = audioStreamFormat.contentLength;
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
                const chunksize = (end - start) + 1;

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${contentLength}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'audio/mp3'
                });

                const audio = ytdl(data.url, {
                    ...ytdlOptions,
                    quality: 'highestaudio',
                    filter: 'audioonly',
                    range: { start, end }
                });

                return audio.pipe(res);

            default:
                return res.status(400).json({
                    erro: 'Método inválido',
                    detalhes: 'O método especificado não é suportado'
                });
        }
    } catch (erro) {
        res.status(500).json({ 
            erro: 'Erro ao processar requisição',
            detalhes: erro.message 
        });
    }
});

export default router;
