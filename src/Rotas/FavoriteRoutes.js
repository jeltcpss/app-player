import express from 'express';
import { favoritesOperations, Favorites } from '../DataBase/index.js';
import { validateUser } from '../Middleware/Middleware.js';

const router = express.Router();

// Rota unificada para todas as operações de favoritos
router.post('/favorites', validateUser, async (req, res, next) => {
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
                const favorites = await favoritesOperations.getByUserId(data.user);
                return res.json({
                    id_user: data.user,
                    total_favoritos: favorites?.song_favorites?.length || 0,
                    favoritos: favorites?.song_favorites || []
                });

            case 'add':
                if (!data.user || !data.songs || !Array.isArray(data.songs)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e lista de músicas são obrigatórios'
                    });
                }

                const currentFavorites = await favoritesOperations.getByUserId(data.user);
                let currentSongs = [];
                if (currentFavorites && currentFavorites.song_favorites && Array.isArray(currentFavorites.song_favorites)) {
                    currentSongs = currentFavorites.song_favorites;
                }

                const newSongs = data.songs.filter(newSong => 
                    !currentSongs.some(existingSong => existingSong.id_song === newSong.id_song)
                );

                if (newSongs.length === 0) {
                    return res.status(409).json({
                        erro: 'Músicas duplicadas',
                        detalhes: 'Todas as músicas já existem nos favoritos'
                    });
                }

                const updatedData = {
                    id_user: data.user,
                    song_favorites: [...currentSongs, ...newSongs],
                    updated_at: new Date()
                };

                const validatedData = Favorites.parse(updatedData);
                await favoritesOperations.upsert(data.user, validatedData.song_favorites);
                
                return res.status(201).json({
                    mensagem: 'Novas músicas adicionadas aos favoritos',
                    id_user: data.user,
                    novas_musicas: newSongs,
                    total_favoritos: validatedData.song_favorites.length,
                    favoritos: validatedData.song_favorites
                });

            case 'remove':
                if (!data.user || !data.song_ids || !Array.isArray(data.song_ids)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e lista de IDs das músicas são obrigatórios'
                    });
                }

                const userFavorites = await favoritesOperations.getByUserId(data.user);
                if (!userFavorites || !userFavorites.song_favorites) {
                    return res.status(404).json({
                        erro: 'Favoritos não encontrados',
                        detalhes: 'Nenhuma música favorita encontrada para este usuário'
                    });
                }

                const nonExistentSongs = data.song_ids.filter(id => 
                    !userFavorites.song_favorites.some(song => song.id_song === id)
                );

                if (nonExistentSongs.length > 0) {
                    return res.status(404).json({
                        erro: 'Músicas não encontradas',
                        detalhes: `As seguintes músicas não existem nos favoritos: ${nonExistentSongs.join(', ')}`
                    });
                }

                const remainingSongs = userFavorites.song_favorites.filter(
                    song => !data.song_ids.includes(song.id_song)
                );

                await favoritesOperations.upsert(data.user, remainingSongs);
                return res.json({
                    mensagem: 'Músicas removidas dos favoritos com sucesso',
                    musicas_removidas: data.song_ids,
                    total_favoritos: remainingSongs.length,
                    favoritos: remainingSongs
                });

            case 'remove_single':
                if (!data.user || !data.song_id) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e ID da música são obrigatórios'
                    });
                }

                const userFavs = await favoritesOperations.getByUserId(data.user);
                if (!userFavs || !userFavs.song_favorites) {
                    return res.status(404).json({
                        erro: 'Favoritos não encontrados',
                        detalhes: 'Nenhuma música favorita encontrada para este usuário'
                    });
                }

                const songIndex = userFavs.song_favorites.findIndex(song => song.id_song === data.song_id);
                if (songIndex === -1) {
                    return res.status(404).json({
                        erro: 'Música não encontrada',
                        detalhes: 'Esta música não está nos favoritos'
                    });
                }

                const removedSong = userFavs.song_favorites[songIndex];
                const updatedSongs = userFavs.song_favorites.filter(song => song.id_song !== data.song_id);

                await favoritesOperations.upsert(data.user, updatedSongs);
                return res.json({
                    mensagem: 'Música removida dos favoritos com sucesso',
                    musica_removida: removedSong,
                    total_favoritos: updatedSongs.length,
                    favoritos: updatedSongs
                });

            case 'top_favorites':
                // Buscar todos os favoritos
                const allFavorites = await favoritesOperations.getAllFavorites();
                
                // Mapas para contar ocorrências e armazenar detalhes das músicas
                const songCount = new Map();
                const songDetails = new Map();

                // Contar ocorrências de cada música
                allFavorites.forEach(userFavorites => {
                    userFavorites.song_favorites.forEach(song => {
                        const currentCount = songCount.get(song.id_song) || 0;
                        songCount.set(song.id_song, currentCount + 1);
                        
                        // Armazenar detalhes da música se ainda não existir
                        if (!songDetails.has(song.id_song)) {
                            songDetails.set(song.id_song, {
                                id: song.id_song,
                                title: song.song_name,
                                artist: song.song_artist,
                                thumbnail: song.song_thumbnail,
                                url: song.song_url,
                                duration: song.song_duration
                            });
                        }
                    });
                });

                // Converter para array e ordenar por contagem
                const topSongs = Array.from(songCount.entries())
                    .map(([id, count]) => ({
                        ...songDetails.get(id),
                        favorite_count: count
                    }))
                    .sort((a, b) => b.favorite_count - a.favorite_count)
                    .slice(0, 30); // Pegar os top 30

                return res.json({
                    total: topSongs.length,
                    songs: topSongs
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