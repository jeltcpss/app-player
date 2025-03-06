import express from 'express';
import yts from 'yt-search';
import ytdl from '@distube/ytdl-core';

const router = express.Router();

// Configurações do ytdl para evitar detecção de bot
const ytdlOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Cookie': 'CONSENT=YES+; SOCS=CAISEwgDEgk1ODE3OTQxMTEaAmVuIAEaBgiA_LyaBg; GPS=1; VISITOR_INFO1_LIVE=JnY1vRGpQtY; YSC=aTaH9uXCiXY',
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com'
        }
    },
    lang: 'en-US',
    ipAddress: '159.65.160.150', // IP fixo para evitar detecção
    clientVersion: '2.20240311.01.00'
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
