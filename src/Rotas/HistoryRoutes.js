import express from 'express';
import { historyOperations, History } from '../DataBase/index.js';
import { validateUser } from '../Middleware/Middleware.js';

const router = express.Router();

// Rota unificada para todas as operações de histórico
router.post('/history', validateUser, async (req, res, next) => {
    try {
        if (!req.body || !req.body.method || !req.body.data) {
            return res.status(400).json({
                erro: 'Dados não fornecidos',
                detalhes: 'O método e os dados são obrigatórios'
            });
        }

        const { method, data } = req.body;

        switch (method.toLowerCase()) {
            case 'list':
                const history = await historyOperations.getByUserId(data.user);
                return res.json({
                    id_user: data.user,
                    total_historico: history?.song_history?.length || 0,
                    historico: history?.song_history || []
                });

            case 'add':
                if (!data.user || !data.songs || !Array.isArray(data.songs)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e lista de músicas são obrigatórios'
                    });
                }

                const currentHistory = await historyOperations.getByUserId(data.user);
                let currentSongs = [];
                if (currentHistory && currentHistory.song_history && Array.isArray(currentHistory.song_history)) {
                    currentSongs = currentHistory.song_history;
                }

                // Atualizar músicas existentes e adicionar novas
                const updatedSongs = [...currentSongs];
                const newSongs = [];
                const updatedExistingSongs = [];

                for (const song of data.songs) {
                    const existingSongIndex = updatedSongs.findIndex(s => s.id_song === song.id_song);
                    if (existingSongIndex !== -1) {
                        // Atualizar a data da música existente
                        updatedSongs[existingSongIndex] = {
                            ...song,
                            updated_at: new Date().toISOString()
                        };
                        updatedExistingSongs.push(song);
                    } else {
                        // Adicionar nova música com data atual
                        const newSong = {
                            ...song,
                            updated_at: new Date().toISOString()
                        };
                        updatedSongs.push(newSong);
                        newSongs.push(newSong);
                    }
                }

                const updatedData = {
                    id_user: data.user,
                    song_history: updatedSongs,
                    updated_at: new Date()
                };

                const validatedData = History.parse(updatedData);
                await historyOperations.upsert(data.user, validatedData.song_history);
                
                return res.status(201).json({
                    mensagem: 'Histórico atualizado com sucesso',
                    id_user: data.user,
                    musicas_novas: newSongs,
                    musicas_atualizadas: updatedExistingSongs,
                    total_historico: validatedData.song_history.length,
                    historico: validatedData.song_history
                });

            case 'remove':
                if (!data.user || !data.song_ids || !Array.isArray(data.song_ids)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e lista de IDs das músicas são obrigatórios'
                    });
                }

                const userHistory = await historyOperations.getByUserId(data.user);
                if (!userHistory || !userHistory.song_history) {
                    return res.status(404).json({
                        erro: 'Histórico não encontrado',
                        detalhes: 'Nenhuma música encontrada no histórico deste usuário'
                    });
                }

                const nonExistentSongs = data.song_ids.filter(id => 
                    !userHistory.song_history.some(song => song.id_song === id)
                );

                if (nonExistentSongs.length > 0) {
                    return res.status(404).json({
                        erro: 'Músicas não encontradas',
                        detalhes: `As seguintes músicas não existem no histórico: ${nonExistentSongs.join(', ')}`
                    });
                }

                const remainingSongs = userHistory.song_history.filter(
                    song => !data.song_ids.includes(song.id_song)
                );

                await historyOperations.upsert(data.user, remainingSongs);
                return res.json({
                    mensagem: 'Músicas removidas do histórico com sucesso',
                    musicas_removidas: data.song_ids,
                    total_historico: remainingSongs.length,
                    historico: remainingSongs
                });

            case 'remove_single':
                if (!data.user || !data.song_id) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e ID da música são obrigatórios'
                    });
                }

                const userHist = await historyOperations.getByUserId(data.user);
                if (!userHist || !userHist.song_history) {
                    return res.status(404).json({
                        erro: 'Histórico não encontrado',
                        detalhes: 'Nenhuma música encontrada no histórico deste usuário'
                    });
                }

                const songIndex = userHist.song_history.findIndex(song => song.id_song === data.song_id);
                if (songIndex === -1) {
                    return res.status(404).json({
                        erro: 'Música não encontrada',
                        detalhes: 'Esta música não está no histórico'
                    });
                }

                const removedSong = userHist.song_history[songIndex];
                const filteredSongs = userHist.song_history.filter(song => song.id_song !== data.song_id);

                await historyOperations.upsert(data.user, filteredSongs);
                return res.json({
                    mensagem: 'Música removida do histórico com sucesso',
                    musica_removida: removedSong,
                    total_historico: filteredSongs.length,
                    historico: filteredSongs
                });

            case 'clear':
                if (!data.user) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário é obrigatório'
                    });
                }

                await historyOperations.upsert(data.user, []);
                return res.json({
                    mensagem: 'Histórico limpo com sucesso',
                    id_user: data.user,
                    total_historico: 0,
                    historico: []
                });

            default:
                return res.status(400).json({
                    erro: 'Método inválido',
                    detalhes: 'O método especificado não é suportado'
                });
        }
    } catch (error) {
        next(error);
    }
});

export default router; 