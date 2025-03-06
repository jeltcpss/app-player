import express from 'express';
import { playlistOperations, Playlist } from '../DataBase/index.js';
import { validateUser } from '../Middleware/Middleware.js';

const router = express.Router();

// Rota unificada para todas as operações de playlist
router.post('/playlists', validateUser, async (req, res, next) => {
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
                const userPlaylists = await playlistOperations.getByUserId(data.user);
                return res.json({
                    id_user: data.user,
                    total_playlists: userPlaylists?.playlists?.length || 0,
                    playlists: userPlaylists?.playlists || []
                });

            case 'create':
                if (!data.user || !data.name) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e nome da playlist são obrigatórios'
                    });
                }

                const existingPlaylists = await playlistOperations.getByUserId(data.user);
                let currentPlaylists = [];
                if (existingPlaylists && existingPlaylists.playlists && Array.isArray(existingPlaylists.playlists)) {
                    currentPlaylists = existingPlaylists.playlists;
                }

                const playlistExists = currentPlaylists.some(
                    existingPlaylist => existingPlaylist.name.toLowerCase() === data.name.toLowerCase()
                );

                if (playlistExists) {
                    return res.status(409).json({
                        erro: 'Playlist duplicada',
                        detalhes: 'Já existe uma playlist com este nome'
                    });
                }

                const newPlaylist = {
                    name: data.name,
                    songs: []
                };

                const updatedData = {
                    id_user: data.user,
                    playlists: [...currentPlaylists, newPlaylist]
                };

                const validatedData = Playlist.parse(updatedData);
                await playlistOperations.upsert(data.user, validatedData.playlists);

                return res.status(201).json({
                    mensagem: 'Nova playlist criada com sucesso',
                    id_user: data.user,
                    playlist: newPlaylist,
                    total_playlists: validatedData.playlists.length
                });

            case 'get':
                if (!data.user || !data.playlist_name) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e nome da playlist são obrigatórios'
                    });
                }

                const playlists = await playlistOperations.getByUserId(data.user);
                if (!playlists || !playlists.playlists) {
                    return res.status(404).json({
                        erro: 'Playlists não encontradas',
                        detalhes: 'Nenhuma playlist encontrada para este usuário'
                    });
                }

                const playlist = playlists.playlists.find(
                    p => p.name.toLowerCase() === data.playlist_name.toLowerCase()
                );

                if (!playlist) {
                    return res.status(404).json({
                        erro: 'Playlist não encontrada',
                        detalhes: `Playlist "${data.playlist_name}" não existe`
                    });
                }

                return res.json({
                    id_user: data.user,
                    playlist_name: data.playlist_name,
                    total_musicas: playlist.songs.length,
                    playlist: playlist
                });

            case 'add_songs':
                if (!data.user || !data.playlist_name || !data.songs || !Array.isArray(data.songs)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário, nome da playlist e lista de músicas são obrigatórios'
                    });
                }

                const userPlaylistsForAdd = await playlistOperations.getByUserId(data.user);
                if (!userPlaylistsForAdd || !userPlaylistsForAdd.playlists) {
                    return res.status(404).json({
                        erro: 'Playlists não encontradas',
                        detalhes: 'Nenhuma playlist encontrada para este usuário'
                    });
                }

                const playlistIndex = userPlaylistsForAdd.playlists.findIndex(
                    p => p.name.toLowerCase() === data.playlist_name.toLowerCase()
                );

                if (playlistIndex === -1) {
                    return res.status(404).json({
                        erro: 'Playlist não encontrada',
                        detalhes: `Playlist "${data.playlist_name}" não existe`
                    });
                }

                const targetPlaylist = userPlaylistsForAdd.playlists[playlistIndex];
                const newSongs = data.songs.filter(newSong => 
                    !targetPlaylist.songs.some(existingSong => existingSong.id_song === newSong.id_song)
                );

                if (newSongs.length === 0) {
                    return res.status(409).json({
                        erro: 'Músicas duplicadas',
                        detalhes: 'Todas as músicas já existem na playlist'
                    });
                }

                targetPlaylist.songs = [...targetPlaylist.songs, ...newSongs];
                userPlaylistsForAdd.playlists[playlistIndex] = targetPlaylist;

                const validatedAddData = Playlist.parse({
                    id_user: data.user,
                    playlists: userPlaylistsForAdd.playlists
                });

                await playlistOperations.upsert(data.user, validatedAddData.playlists);

                return res.status(201).json({
                    mensagem: 'Músicas adicionadas à playlist com sucesso',
                    id_user: data.user,
                    playlist_name: data.playlist_name,
                    novas_musicas: newSongs,
                    total_musicas: targetPlaylist.songs.length,
                    playlist: targetPlaylist
                });

            case 'remove_playlist':
                if (!data.user || !data.playlist_name) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário e nome da playlist são obrigatórios'
                    });
                }

                const userPlaylistsForRemove = await playlistOperations.getByUserId(data.user);
                if (!userPlaylistsForRemove || !userPlaylistsForRemove.playlists) {
                    return res.status(404).json({
                        erro: 'Playlists não encontradas',
                        detalhes: 'Nenhuma playlist encontrada para este usuário'
                    });
                }

                const playlistToRemoveIndex = userPlaylistsForRemove.playlists.findIndex(
                    p => p.name.toLowerCase() === data.playlist_name.toLowerCase()
                );

                if (playlistToRemoveIndex === -1) {
                    return res.status(404).json({
                        erro: 'Playlist não encontrada',
                        detalhes: `Playlist "${data.playlist_name}" não existe`
                    });
                }

                const removedPlaylist = userPlaylistsForRemove.playlists[playlistToRemoveIndex];
                const updatedPlaylists = userPlaylistsForRemove.playlists.filter((_, index) => index !== playlistToRemoveIndex);

                const validatedRemoveData = Playlist.parse({
                    id_user: data.user,
                    playlists: updatedPlaylists
                });

                await playlistOperations.upsert(data.user, validatedRemoveData.playlists);

                return res.json({
                    mensagem: 'Playlist removida com sucesso',
                    id_user: data.user,
                    playlist_removida: removedPlaylist,
                    total_playlists: updatedPlaylists.length,
                    playlists: updatedPlaylists
                });

            case 'remove_songs':
                if (!data.user || !data.playlist_name || !data.song_ids || !Array.isArray(data.song_ids)) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário, nome da playlist e lista de IDs das músicas são obrigatórios'
                    });
                }

                const userPlaylistsForSongRemoval = await playlistOperations.getByUserId(data.user);
                if (!userPlaylistsForSongRemoval || !userPlaylistsForSongRemoval.playlists) {
                    return res.status(404).json({
                        erro: 'Playlists não encontradas',
                        detalhes: 'Nenhuma playlist encontrada para este usuário'
                    });
                }

                const playlistForSongRemovalIndex = userPlaylistsForSongRemoval.playlists.findIndex(
                    p => p.name.toLowerCase() === data.playlist_name.toLowerCase()
                );

                if (playlistForSongRemovalIndex === -1) {
                    return res.status(404).json({
                        erro: 'Playlist não encontrada',
                        detalhes: `Playlist "${data.playlist_name}" não existe`
                    });
                }

                const playlistForSongRemoval = userPlaylistsForSongRemoval.playlists[playlistForSongRemovalIndex];

                const nonExistentSongs = data.song_ids.filter(id => 
                    !playlistForSongRemoval.songs.some(song => song.id_song === id)
                );

                if (nonExistentSongs.length > 0) {
                    return res.status(404).json({
                        erro: 'Músicas não encontradas',
                        detalhes: `As seguintes músicas não existem na playlist: ${nonExistentSongs.join(', ')}`
                    });
                }

                playlistForSongRemoval.songs = playlistForSongRemoval.songs.filter(
                    song => !data.song_ids.includes(song.id_song)
                );
                userPlaylistsForSongRemoval.playlists[playlistForSongRemovalIndex] = playlistForSongRemoval;

                const validatedSongRemovalData = Playlist.parse({
                    id_user: data.user,
                    playlists: userPlaylistsForSongRemoval.playlists
                });

                await playlistOperations.upsert(data.user, validatedSongRemovalData.playlists);

                return res.json({
                    mensagem: 'Músicas removidas da playlist com sucesso',
                    id_user: data.user,
                    playlist_name: data.playlist_name,
                    musicas_removidas: data.song_ids,
                    total_musicas: playlistForSongRemoval.songs.length,
                    playlist: playlistForSongRemoval
                });

            case 'remove_single_song':
                if (!data.user || !data.playlist_name || !data.song_id) {
                    return res.status(400).json({
                        erro: 'Dados inválidos',
                        detalhes: 'ID do usuário, nome da playlist e ID da música são obrigatórios'
                    });
                }

                const userPlaylistsForSingleRemoval = await playlistOperations.getByUserId(data.user);
                if (!userPlaylistsForSingleRemoval || !userPlaylistsForSingleRemoval.playlists) {
                    return res.status(404).json({
                        erro: 'Playlists não encontradas',
                        detalhes: 'Nenhuma playlist encontrada para este usuário'
                    });
                }

                const playlistForSingleRemovalIndex = userPlaylistsForSingleRemoval.playlists.findIndex(
                    p => p.name.toLowerCase() === data.playlist_name.toLowerCase()
                );

                if (playlistForSingleRemovalIndex === -1) {
                    return res.status(404).json({
                        erro: 'Playlist não encontrada',
                        detalhes: `Playlist "${data.playlist_name}" não existe`
                    });
                }

                const playlistForSingleRemoval = userPlaylistsForSingleRemoval.playlists[playlistForSingleRemovalIndex];

                const songToRemoveIndex = playlistForSingleRemoval.songs.findIndex(
                    song => song.id_song === data.song_id
                );

                if (songToRemoveIndex === -1) {
                    return res.status(404).json({
                        erro: 'Música não encontrada',
                        detalhes: 'Esta música não está na playlist'
                    });
                }

                const removedSong = playlistForSingleRemoval.songs[songToRemoveIndex];
                playlistForSingleRemoval.songs = playlistForSingleRemoval.songs.filter(
                    song => song.id_song !== data.song_id
                );
                userPlaylistsForSingleRemoval.playlists[playlistForSingleRemovalIndex] = playlistForSingleRemoval;

                const validatedSingleRemovalData = Playlist.parse({
                    id_user: data.user,
                    playlists: userPlaylistsForSingleRemoval.playlists
                });

                await playlistOperations.upsert(data.user, validatedSingleRemovalData.playlists);

                return res.json({
                    mensagem: 'Música removida da playlist com sucesso',
                    id_user: data.user,
                    playlist_name: data.playlist_name,
                    musica_removida: removedSong,
                    total_musicas: playlistForSingleRemoval.songs.length,
                    playlist: playlistForSingleRemoval
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