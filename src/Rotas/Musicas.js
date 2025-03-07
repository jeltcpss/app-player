import express from 'express';
import yts from 'yt-search';
import ytdl from '@distube/ytdl-core';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Caminho para o arquivo de cookies
const cookiesPath = path.join(process.cwd(), 'cookies.json');

// Função para salvar cookies em arquivo
function salvarCookies(cookies) {
    try {
        fs.writeFileSync(cookiesPath, JSON.stringify({ cookies }, null, 2));
        console.log('Cookies salvos com sucesso em:', cookiesPath);
    } catch (erro) {
        console.error('Erro ao salvar cookies:', erro);
    }
}

// Função para carregar cookies do arquivo
function carregarCookies() {
    try {
        if (fs.existsSync(cookiesPath)) {
            const dados = fs.readFileSync(cookiesPath, 'utf8');
            const { cookies } = JSON.parse(dados);
            console.log('Cookies carregados com sucesso de:', cookiesPath);
            return cookies;
        }
    } catch (erro) {
        console.error('Erro ao carregar cookies:', erro);
    }
    return process.env.YOUTUBE_COOKIES || '';
}

// Carregar cookies ao iniciar
const cookiesSalvos = carregarCookies();

// Função para formatar cookies do YouTube
function formatarCookies(cookiesRaw) {
    try {
        // Se já for uma string formatada, retornar como está
        if (typeof cookiesRaw === 'string') {
            return cookiesRaw;
        }

        // Se for um array JSON de cookies
        if (Array.isArray(cookiesRaw)) {
            // Cookies importantes do YouTube
            const cookiesImportantes = [
                'HSID', 'SSID', 'APISID', 'SAPISID', 'LOGIN_INFO', 'PREF',
                '__Secure-1PAPISID', '__Secure-3PAPISID', 'SID',
                '__Secure-1PSID', '__Secure-3PSID', 'SIDCC',
                '__Secure-1PSIDCC', '__Secure-3PSIDCC'
            ];

            // Filtrar e formatar cookies
            const cookiesFormatados = cookiesRaw
                .filter(cookie => cookiesImportantes.includes(cookie.name))
                .map(cookie => `${cookie.name}=${cookie.value}`)
                .join('; ');

            return cookiesFormatados;
        }

        // Se for texto bruto das DevTools
        const linhas = cookiesRaw.split('\n');
        
        // Cookies importantes do YouTube
        const cookiesImportantes = [
            'HSID', 'SSID', 'APISID', 'SAPISID', 'LOGIN_INFO', 'PREF',
            '__Secure-1PAPISID', '__Secure-3PAPISID', 'SID',
            '__Secure-1PSID', '__Secure-3PSID', 'SIDCC',
            '__Secure-1PSIDCC', '__Secure-3PSIDCC'
        ];

        // Filtrar e formatar cookies
        const cookiesFormatados = linhas
            .map(linha => linha.trim())
            .filter(linha => linha && !linha.startsWith('#'))
            .map(linha => {
                const partes = linha.split('\t');
                if (partes.length >= 2) {
                    return {
                        nome: partes[0],
                        valor: partes[1]
                    };
                }
                return null;
            })
            .filter(cookie => cookie && cookiesImportantes.includes(cookie.nome))
            .map(cookie => `${cookie.nome}=${cookie.valor}`)
            .join('; ');

        return cookiesFormatados;
    } catch (erro) {
        console.error('Erro ao formatar cookies:', erro);
        return '';
    }
}

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
            'Cookie': cookiesSalvos,
            'x-youtube-identity-token': process.env.YOUTUBE_IDENTITY_TOKEN || '',
            'x-client-data': 'CIa2yQEIpbbJAQipncoBCMKTywEIkqHLAQiFoM0BCJmizQEI9KXNAQiFqs0BCJ2uzQEIurHNAQjvs80BCIe0zQEIqbXNARiWwcoB'
        }
    },
    lang: 'pt-BR',
    highWaterMark: 1024 * 1024 * 2, // 2MB
    liveBuffer: 20000, // 20 segundos
    dlChunkSize: 1024 * 1024, // 1MB
    isHLS: false,
    // Desabilitar verificações de idade e região
    requestCallback: (options) => {
        options.headers = {
            ...options.headers,
            'Cookie': cookiesSalvos
        };
        return options;
    }
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

// Função para autenticação direta com o YouTube
async function autenticarYouTube() {
    try {
        const { Innertube } = await import('@distube/ytdl-core/dist/lib/innertube.js');
        const youtube = await Innertube.create({
            cache: new Map(),
            generate_session_locally: true
        });

        // Obter credenciais
        const credentials = await youtube.session.getCredentials();
        
        // Atualizar cookies com as credenciais
        const novoCookie = Object.entries(credentials)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');

        // Salvar cookies
        salvarCookies(novoCookie);
        
        // Atualizar ytdlOptions
        ytdlOptions.requestOptions.headers.Cookie = novoCookie;
        process.env.YOUTUBE_COOKIES = novoCookie;

        return true;
    } catch (erro) {
        console.error('Erro na autenticação:', erro);
        return false;
    }
}

// Modificar a função verificarCookies para tentar autenticação automática
async function verificarCookies() {
    try {
        const videoTeste = 'dQw4w9WgXcQ';
        await ytdl.getBasicInfo(videoTeste, ytdlOptions);
        return true;
    } catch (erro) {
        console.log('Tentando autenticação automática...');
        return await autenticarYouTube();
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

        // Formatar cookies
        const cookiesFormatados = formatarCookies(cookies);
        
        if (!cookiesFormatados) {
            return res.status(400).json({
                erro: 'Cookies inválidos',
                detalhes: 'Não foi possível formatar os cookies fornecidos'
            });
        }

        // Atualizar cookies nas opções do ytdl
        ytdlOptions.requestOptions.headers.Cookie = cookiesFormatados;
        
        // Atualizar variável de ambiente
        process.env.YOUTUBE_COOKIES = cookiesFormatados;

        // Salvar cookies em arquivo
        salvarCookies(cookiesFormatados);

        return res.json({
            mensagem: 'Cookies atualizados com sucesso',
            detalhes: 'Os cookies do YouTube foram atualizados e salvos'
        });
    } catch (erro) {
        console.error('Erro ao atualizar cookies:', erro);
        return res.status(500).json({
            erro: 'Erro ao atualizar cookies',
            detalhes: erro.message
        });
    }
});

// Rota para autenticação direta
router.post('/auth', async (req, res) => {
    try {
        const sucesso = await autenticarYouTube();
        
        if (sucesso) {
            return res.json({
                mensagem: 'Autenticação realizada com sucesso',
                detalhes: 'Novas credenciais foram geradas e salvas'
            });
        } else {
            return res.status(401).json({
                erro: 'Falha na autenticação',
                detalhes: 'Não foi possível gerar novas credenciais'
            });
        }
    } catch (erro) {
        console.error('Erro na rota de autenticação:', erro);
        return res.status(500).json({
            erro: 'Erro na autenticação',
            detalhes: erro.message
        });
    }
});

// Rota unificada para todas as operações de música
router.post('/', async (req, res) => {
    try {
        // Verificar cookies antes de processar a requisição
        const cookiesValidos = await verificarCookies();
        if (!cookiesValidos) {
            return res.status(401).json({
                erro: 'Cookies inválidos',
                detalhes: 'Os cookies do YouTube estão inválidos ou expiraram. Por favor, atualize os cookies.'
            });
        }

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
