//exportar schema playLists
import { z } from "zod";

// Schema para criação de playlists
const CreatePlaylistSchema = z.object({
    id_user: z.string().min(1), //id do usuário
    playlists: z.array(z.object({ //array de playlists
        name: z.string().min(1) //nome da playlist
    }))
});

// Schema para as informações da música que serão adicionadas à playlist
const SongPlayListSchema = z.object({ //schema para as informações da música
    id_song: z.string().min(1), //id da música
    song_name: z.string().min(1), //nome da música
    song_artist: z.string().min(1), //artista da música
    song_duration: z.number(), //duração da música
    song_thumbnail: z.string().url(), //thumbnail da música
    song_url: z.string().url() //url da música
});

// Schema para adicionar músicas à playlist
const AddSongsToPlaylistSchema = z.object({ //schema para adicionar músicas à playlist
    id_user: z.string().min(1), //id do usuário
    playlist_name: z.string().min(1), //nome da playlist
    songs: z.array(SongPlayListSchema) //array de músicas
});

// Schema completo para armazenamento
const PlayLists = z.object({ //schema para armazenamento
    id_user: z.string().min(1), //id do usuário
    playlists: z.array(z.object({ //array de playlists
        name: z.string().min(1), //nome da playlist
        songs: z.array(SongPlayListSchema).default([]) //array de músicas
    }))
});

export { PlayLists, CreatePlaylistSchema, AddSongsToPlaylistSchema }; //exportar os schemas