const { createApp } = Vue;

const API_URLS = [
    'https://app-player.onrender.com',
    'http://jeffingames.duckdns.org:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

// Array com a ordem das páginas para navegação por gestos
const PAGE_ORDER = ['home', 'search', 'favorites', 'playlists', 'history'];

let currentApiUrlIndex = 0;
const BASE_API_URL = API_URLS[currentApiUrlIndex];
const USER_ID = '1';

// Função para tentar próxima URL disponível
async function tryNextApiUrl() {
    currentApiUrlIndex = (currentApiUrlIndex + 1) % API_URLS.length;
    return API_URLS[currentApiUrlIndex];
}

// Modifica a função fetchWithRetry para usar URLs alternativas
async function fetchWithRetry(url, options, maxRetries = 3, delayMs = 1000) {
    let lastError;
    let currentUrl = url;

    for (let attempt = 0; attempt < maxRetries * API_URLS.length; attempt++) {
        try {
            const response = await fetch(currentUrl, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            lastError = error;
            console.log(`Tentativa ${attempt + 1} falhou:`, error);
            
            // Se falhou, tenta próxima URL
            const nextUrl = await tryNextApiUrl();
            currentUrl = url.replace(API_URLS[currentApiUrlIndex], nextUrl);
            
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}

// Componentes
const Home = {
    props: ['searchState'],
    template: `
        <div class="page home">
            <h2>Top Músicas</h2>
            <div v-if="isLoading" class="empty-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando top músicas...</p>
            </div>
            <div v-else-if="topSongs.length === 0" class="empty-state">
                <i class="fas fa-music"></i>
                <p>Nenhuma música encontrada</p>
            </div>
            <div v-else class="top-songs">
                <div v-for="(song, index) in topSongs" 
                     :key="song.id" 
                     class="song-card"
                     @click="playTrack(song)">
                    <div class="card-cover" :class="{ 'no-image': !song.thumbnail || song.thumbnailError }">
                        <img v-if="song.thumbnail && !song.thumbnailError" 
                             :src="song.thumbnail" 
                             :alt="song.title"
                             @error="handleImageError($event, song)">
                        <i v-else class="fas fa-music"></i>
                        <div class="card-rank">#{{ index + 1 }}</div>
                        <div class="card-actions" @click.stop>
                            <button class="action-btn" :class="{ active: song.isFavorite }" @click="toggleFavorite(index)">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="action-btn" @click="addToPlaylist(song)">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="download-btn" @click="downloadTrack(song)">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-info">
                        <div class="card-name">{{ song.title }}</div>
                        <div class="card-artist">{{ song.artist }}</div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            topSongs: [],
            isLoading: true
        }
    },
    watch: {
        '$parent.favoriteIds': {
            handler(newFavoriteIds) {
                // Atualiza o estado de favorito das músicas quando favoriteIds mudar
                this.topSongs = this.topSongs.map(song => ({
                    ...song,
                    isFavorite: newFavoriteIds.has(song.id)
                }));
            },
            deep: true
        }
    },
    methods: {
        async loadTopSongs() {
            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users/favorites`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "top_favorites",
                        data: {
                            user: this.$parent.userId
                        }
                    })
                });

                const data = await response.json();
                this.topSongs = data.songs.map(song => ({
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    thumbnail: song.thumbnail,
                    url: song.url,
                    duration: song.duration,
                    favorite_count: song.favorite_count,
                    isFavorite: this.$parent.isSongFavorite(song.id),
                    song_url: song.url,
                    song_name: song.title,
                    song_artist: song.artist,
                    song_thumbnail: song.thumbnail,
                    song_duration: song.duration
                }));
            } catch (error) {
                console.error('Erro ao carregar top músicas:', error);
                this.topSongs = [];
            } finally {
                this.isLoading = false;
            }
        },
        async playTrack(track) {
            try {
                // Se a música não veio da playlist, cria uma nova fila com apenas esta música
                if (!this.playlistQueue || !this.playlistQueue.find(song => song.id_song === track.id_song)) {
                    this.playlistQueue = [track];
                    this.currentPlaylistIndex = 0;
                }

                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url || track.url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.$parent.currentTrack = {
                    name: track.song_name || track.name,
                    song_name: track.song_name || track.name,
                    artist: track.song_artist || track.artist,
                    cover: track.song_thumbnail || track.cover,
                    url: audioUrl,
                    song_url: track.song_url || track.url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail || track.cover,
                    song_artist: track.song_artist || track.artist
                };

                this.$parent.isPlaying = true;
                this.$parent.startProgressUpdate();

                // Configura o evento de fim da música para tocar a próxima
                if (this.$parent.audio) {
                    this.$parent.audio.addEventListener('ended', () => {
                        if (this.$parent.playlistQueue && this.$parent.currentPlaylistIndex < this.$parent.playlistQueue.length - 1) {
                            this.$parent.currentPlaylistIndex++;
                            this.playTrack(this.$parent.playlistQueue[this.$parent.currentPlaylistIndex]);
                        }
                    }, { once: true });
                }

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        async toggleFavorite(index) {
            const track = this.topSongs[index];
            if (track.isFavorite) {
                const success = await this.$parent.removeFromFavorites(track);
                if (success) {
                    track.isFavorite = false;
                    console.log('Removido dos favoritos:', track.title);
                }
            } else {
                const success = await this.$parent.addToFavorites(track);
                if (success) {
                    track.isFavorite = true;
                    console.log('Adicionado aos favoritos:', track.title);
                }
            }
        },
        async addToPlaylist(track) {
            this.$parent.addToPlaylist(track);
        },
        downloadTrack(track) {
            const formattedTrack = {
                song_name: track.title,
                name: track.title,
                song_url: track.url,
                url: track.url
            };
            this.$parent.downloadTrack(formattedTrack);
        },
        handleImageError(event, song) {
            song.thumbnailError = true;
            event.target.style.display = 'none';
            event.target.parentElement.classList.add('no-image');
        }
    },
    mounted() {
        this.loadTopSongs();
    }
};

const Search = {
    template: `
        <div class="page search">
            <div class="page-header">
                <h2>Buscar</h2>
            </div>
            <div class="search-container">
                <input type="text" 
                       placeholder="Buscar músicas..." 
                       :value="searchState.query"
                       @input="handleSearch($event.target.value)">
            </div>
            <div class="search-content">
                <div v-if="searchState.query && !searchState.isLoading && searchState.results.length === 0" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nenhum resultado encontrado para "{{ searchState.query }}"</p>
                </div>
                <div v-if="searchState.isLoading" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Buscando...</p>
                </div>
                <ul v-if="searchState.results.length > 0" class="history-list">
                    <li v-for="(item, index) in searchState.results" :key="item.id_song" class="history-item" @click="playTrack(item)">
                        <div class="item-cover" :class="{ 'no-image': !item.song_thumbnail || item.thumbnailError }">
                            <img v-if="item.song_thumbnail && !item.thumbnailError" 
                                 :src="item.song_thumbnail" 
                                 :alt="item.song_name"
                                 @error="handleImageError($event, item)">
                            <i v-else class="fas fa-music"></i>
                        </div>
                        <div class="item-info">
                            <p class="item-name">{{ item.song_name }}</p>
                            <p class="item-artist">{{ item.song_artist }}</p>
                            <p class="item-time">{{ formatDuration(item.song_duration) }}</p>
                        </div>
                        <div class="item-actions" @click.stop>
                            <button class="action-btn" :class="{ active: item.isFavorite }" @click="toggleFavorite(index)">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="action-btn" @click="addToPlaylist(item)">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="download-btn" @click="downloadTrack(item)">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    `,
    props: ['searchState'],
    data() {
        return {
            searchTimeout: null
        }
    },
    methods: {
        async searchMusic(termo) {
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'search',
                        data: {
                            termo: termo,
                            limite: 100
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const data = await response.json();
                console.log('Resposta da API:', data);
                return data.musicas || [];
            } catch (error) {
                console.error('Erro ao buscar músicas:', error);
                return [];
            }
        },
        async handleSearch(query) {
            clearTimeout(this.searchTimeout);
            
            this.$parent.updateSearchQuery(query);
            
            if (query.trim() === '') {
                this.$parent.updateSearchResults([]);
                return;
            }

            this.searchTimeout = setTimeout(async () => {
                this.$parent.setSearchLoading(true);
                
                try {
                    const musicas = await this.searchMusic(query);
                    // Atualiza o estado de favorito para cada música
                    const musicasComFavoritos = musicas.map(musica => ({
                        ...musica,
                        isFavorite: this.$parent.isSongFavorite(musica.id_song)
                    }));
                    this.$parent.updateSearchResults(musicasComFavoritos);
                } catch (error) {
                    console.error('Erro na busca:', error);
                    this.$parent.updateSearchResults([]);
                } finally {
                    this.$parent.setSearchLoading(false);
                }
            }, 300);
        },
        formatDuration(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        },
        async toggleFavorite(index) {
            const track = this.searchState.results[index];
            if (track.isFavorite) {
                const success = await this.$parent.removeFromFavorites(track);
                if (success) {
                    track.isFavorite = false;
                    console.log('Removido dos favoritos:', track.song_name);
                }
            } else {
                const success = await this.$parent.addToFavorites(track);
                if (success) {
                    track.isFavorite = true;
                    console.log('Adicionado aos favoritos:', track.song_name);
                }
            }
        },
        async playTrack(track) {
            console.log('Iniciando stream:', track.song_name);
            
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.$parent.currentTrack = {
                    name: track.song_name,
                    song_name: track.song_name,
                    artist: track.song_artist,
                    cover: track.song_thumbnail,
                    url: audioUrl,
                    song_url: track.song_url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail,
                    song_artist: track.song_artist
                };

                this.$parent.isPlaying = true;
                this.$parent.startProgressUpdate();

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        async addToPlaylist(track) {
            this.$parent.addToPlaylist(track);
        },
        async downloadTrack(track) {
            const trackToDownload = track || this.$parent.currentTrack;
            
            if (!trackToDownload || (!trackToDownload.song_url && !trackToDownload.url)) {
                console.error('Dados da música inválidos para download');
                return;
            }

            try {
                console.log('Iniciando download:', trackToDownload.name);
                
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: trackToDownload.song_url || trackToDownload.url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                // Obtém o blob do áudio
                const audioBlob = await response.blob();
                
                // Cria um URL temporário para o blob
                const blobUrl = URL.createObjectURL(audioBlob);
                
                // Cria um elemento <a> temporário para download
                const downloadLink = document.createElement('a');
                downloadLink.href = blobUrl;
                
                // Define o nome do arquivo como o nome da música + .mp3
                const fileName = `${trackToDownload.song_name || trackToDownload.name || 'download'}.mp3`;
                downloadLink.download = fileName;
                
                // Adiciona o link ao documento, clica nele e remove
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Limpa o URL do blob
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

            } catch (error) {
                console.error('Erro ao baixar música:', error);
            }
        },
        handleImageError(event, item) {
            item.thumbnailError = true;
            event.target.style.display = 'none';
            event.target.parentElement.classList.add('no-image');
        }
    }
};

const Favorites = {
    props: ['searchState'],
    template: `
        <div class="page favorites">
            <div class="page-header">
                <h2>Favoritos</h2>
            </div>
            <div class="favorites-content">
                <div v-if="isLoading" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando favoritos...</p>
                </div>
                <div v-else-if="favoritesList.length === 0" class="empty-state">
                    <i class="fas fa-heart"></i>
                    <p>Sua lista de favoritos está vazia</p>
                </div>
                <ul v-else class="history-list">
                    <li v-for="(item, index) in favoritesList" :key="item.id_song" class="history-item" @click="playTrack(item)">
                        <div class="item-cover" :class="{ 'no-image': !item.song_thumbnail }">
                            <img v-if="item.song_thumbnail" :src="item.song_thumbnail" :alt="item.song_name">
                            <i v-else class="fas fa-music"></i>
                        </div>
                        <div class="item-info">
                            <p class="item-name">{{ item.song_name }}</p>
                            <p class="item-artist">{{ item.song_artist }}</p>
                            <p class="item-time">{{ formatDuration(item.song_duration) }}</p>
                        </div>
                        <div class="item-actions" @click.stop>
                            <button class="action-btn active" @click="removeFromFavorites(index)">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="action-btn" @click="addToPlaylist(item)">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="download-btn" @click="downloadTrack(item)">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    `,
    data() {
        return {
            favoritesList: [],
            isLoading: true
        }
    },
    methods: {
        async loadFavorites() {
            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "info",
                        data: {
                            user: this.$parent.userId
                        }
                    })
                });

                const data = await response.json();
                this.favoritesList = data.favorites || [];
            } catch (error) {
                console.error('Erro ao carregar favoritos:', error);
                this.favoritesList = [];
            } finally {
                this.isLoading = false;
            }
        },
        removeFromFavorites(index) {
            const track = this.favoritesList[index];
            this.$parent.removeFromFavorites(track).then(success => {
                if (success) {
                this.favoritesList.splice(index, 1);
            }
            });
        },
        async playTrack(track) {
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.$parent.currentTrack = {
                    name: track.song_name,
                    song_name: track.song_name,
                    artist: track.song_artist,
                    cover: track.song_thumbnail,
                    url: audioUrl,
                    song_url: track.song_url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail,
                    song_artist: track.song_artist
                };

                this.$parent.isPlaying = true;
                this.$parent.startProgressUpdate();

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        async addToPlaylist(track) {
            this.$parent.addToPlaylist(track);
        },
        formatDuration(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        },
        downloadTrack(track) {
            const formattedTrack = {
                song_name: track.song_name,
                name: track.song_name,
                song_url: track.song_url,
                url: track.song_url
            };
            this.$parent.downloadTrack(formattedTrack);
        }
    },
    mounted() {
        this.loadFavorites();
    }
};

const PlaylistDetails = {
    props: ['searchState'],
    template: `
        <div class="page playlist-details">
            <div class="page-header">
                <button class="back-btn" @click="goBack">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h2>{{ selectedPlaylist.name }}</h2>
                <button class="play-all-btn" @click="playAll">
                    <i class="fas fa-play"></i>
                    Tocar tudo
                </button>
            </div>
            <ul class="history-list">
                <li v-for="(song, index) in selectedPlaylist.songs" 
                    :key="index" 
                    class="history-item"
                    @click="playTrack(song)">
                    <div class="item-cover" :class="{ 'no-image': !song.cover }">
                        <img v-if="song.cover" :src="song.cover" :alt="song.name">
                        <i v-else class="fas fa-music"></i>
                    </div>
                    <div class="item-info">
                        <p class="item-name">{{ song.name }}</p>
                        <p class="item-artist">{{ song.artist || 'Artista Desconhecido' }}</p>
                    </div>
                    <div class="item-actions" @click.stop>
                        <button class="action-btn" :class="{ active: song.isFavorite }" @click="toggleFavorite(index)">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="action-btn" @click="removeFromPlaylist(index)">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    `,
    computed: {
        selectedPlaylist() {
            if (!this.$parent.selectedPlaylist) return { name: '', songs: [] };
            
            // Atualiza o estado de favorito para cada música na playlist
            return {
                ...this.$parent.selectedPlaylist,
                songs: this.$parent.selectedPlaylist.songs.map(song => ({
                    ...song,
                    isFavorite: this.$parent.isSongFavorite(song.id_song)
                }))
            };
        }
    },
    watch: {
        '$parent.favoriteIds': {
            handler() {
                // Força a reavaliação do computed selectedPlaylist
                this.$forceUpdate();
            },
            deep: true
        }
    },
    methods: {
        goBack() {
            this.$parent.changePage('playlists');
        },
        playAll() {
            if (!this.selectedPlaylist || !this.selectedPlaylist.songs || this.selectedPlaylist.songs.length === 0) {
                console.log('Playlist vazia');
                return;
            }

            // Configura a fila de reprodução com todas as músicas da playlist
            this.$parent.playlistQueue = [...this.selectedPlaylist.songs];
            this.$parent.currentPlaylistIndex = 0;

            // Se o modo aleatório estiver ativo, embaralha a fila
            if (this.$parent.shuffle) {
                const songs = [...this.$parent.playlistQueue];
                for (let i = songs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [songs[i], songs[j]] = [songs[j], songs[i]];
                }
                this.$parent.playlistQueue = songs;
            }

            // Inicia a reprodução da primeira música
            this.playTrack(this.$parent.playlistQueue[0]);
        },
        async playTrack(track) {
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.$parent.currentTrack = {
                    name: track.song_name,
                    song_name: track.song_name,
                    artist: track.song_artist,
                    cover: track.song_thumbnail,
                    url: audioUrl,
                    song_url: track.song_url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail,
                    song_artist: track.song_artist
                };

                this.$parent.isPlaying = true;
                this.$parent.startProgressUpdate();

                // Configura o evento de fim da música para tocar a próxima
                if (this.$parent.audio) {
                    this.$parent.audio.addEventListener('ended', () => {
                        if (this.$parent.playlistQueue && this.$parent.currentPlaylistIndex < this.$parent.playlistQueue.length - 1) {
                            this.$parent.currentPlaylistIndex++;
                            this.playTrack(this.$parent.playlistQueue[this.$parent.currentPlaylistIndex]);
                        }
                    }, { once: true });
                }

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        async toggleFavorite(index) {
            const track = this.selectedPlaylist.songs[index];
            if (track.isFavorite) {
                const success = await this.$parent.removeFromFavorites(track);
                if (success) {
                    track.isFavorite = false;
                    console.log('Removido dos favoritos:', track.name);
                }
            } else {
                const success = await this.$parent.addToFavorites(track);
                if (success) {
                    track.isFavorite = true;
                    console.log('Adicionado aos favoritos:', track.name);
                }
            }
        },
        async removeFromPlaylist(index) {
            const song = this.selectedPlaylist.songs[index];
            const playlistName = this.selectedPlaylist.name;

            // Remove a música localmente primeiro para feedback imediato
            const updatedSongs = this.selectedPlaylist.songs.filter((_, i) => i !== index);
            this.$parent.selectedPlaylist.songs = updatedSongs;
            this.selectedPlaylist.songs = updatedSongs;

            // Atualiza também a playlist no componente pai
            const parentPlaylist = this.$parent.playlists.find(p => p.name === playlistName);
            if (parentPlaylist) {
                parentPlaylist.songs = updatedSongs;
            }

            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users/playlists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'remove_single_song',
                        data: {
                            user: this.$parent.userId,
                            playlist_name: playlistName,
                            song_id: song.id_song
                        }
                    })
                });

                await response.json();
                console.log('Música removida da playlist com sucesso');
                
                // Força a atualização do componente
                this.$forceUpdate();
            } catch (error) {
                console.error('Erro ao remover música da playlist:', error);
                // Em caso de erro, restaura a música na lista
                this.$parent.selectedPlaylist.songs.splice(index, 0, song);
                this.selectedPlaylist.songs = [...this.$parent.selectedPlaylist.songs];
                if (parentPlaylist) {
                    parentPlaylist.songs = [...this.$parent.selectedPlaylist.songs];
                }
                this.$forceUpdate();
            }
        },
        getRandomCovers(playlist) {
            const availableCovers = playlist.songs
                .filter(song => song.cover)
                .map(song => song.cover);
            
            const covers = [...availableCovers];
            while (covers.length < 4) {
                covers.push(null);
            }
            
            return covers
                .sort(() => Math.random() - 0.5)
                .slice(0, 4);
        }
    }
};

const Playlists = {
    props: ['searchState'],
    template: `
        <div class="page playlists">
            <div class="page-header">
                <h2>Playlists</h2>
                <button class="clear-btn" @click="showCreateModal = true">
                    <i class="fas fa-plus"></i>
                    Criar Playlist
                </button>
            </div>
            <div class="playlists-content">
                <div v-if="isLoading" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando playlists...</p>
                </div>
                <div v-else-if="playlists.length === 0" class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>Você ainda não tem playlists</p>
                </div>
                <div v-else class="playlists-grid">
                    <div v-for="(playlist, index) in playlists" 
                         :key="index" 
                         class="playlist-card"
                         @click="openPlaylist(playlist)">
                        <div class="playlist-cover" :class="{ 'no-image': !playlist.songs.length }">
                            <div v-if="playlist.songs.length" class="mosaic-grid">
                                <div v-for="(cover, idx) in getRandomCovers(playlist)" 
                                     :key="idx" 
                                     class="mosaic-item"
                                     :style="{ backgroundImage: cover ? 'url(' + cover + ')' : 'none' }">
                                    <i v-if="!cover" class="fas fa-music"></i>
                                </div>
                            </div>
                            <i v-else class="fas fa-music"></i>
                            <button class="delete-btn" @click.stop="confirmDeletePlaylist(index)">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="playlist-info">
                            <div class="playlist-text">
                                <div class="playlist-name">{{ playlist.name }}</div>
                                <div class="playlist-details">{{ playlist.songs.length }} músicas</div>
                            </div>
                            <button class="play-btn" @click.stop="playPlaylist(playlist)">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de Criação de Playlist -->
            <div class="modal" v-if="showCreateModal">
                <div class="modal-overlay" @click="showCreateModal = false"></div>
                <div class="modal-content">
                    <h3>Criar Nova Playlist</h3>
                    <div class="modal-input">
                        <input type="text" 
                               v-model="newPlaylistName" 
                               placeholder="Nome da playlist"
                               @keyup.enter="confirmCreatePlaylist">
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" @click="showCreateModal = false">Cancelar</button>
                        <button class="modal-btn confirm" 
                                @click="confirmCreatePlaylist"
                                :disabled="!newPlaylistName.trim()">
                            Criar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal de Confirmação de Exclusão -->
            <div class="modal" v-if="showDeleteModal">
                <div class="modal-overlay" @click="showDeleteModal = false"></div>
                <div class="modal-content">
                    <h3>Excluir Playlist</h3>
                    <p>Tem certeza que deseja excluir a playlist "{{ playlistToDelete?.name }}"?</p>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" @click="showDeleteModal = false">Cancelar</button>
                        <button class="modal-btn confirm" @click="deletePlaylist">
                            Excluir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            playlists: [],
            isLoading: true,
            showCreateModal: false,
            showDeleteModal: false,
            newPlaylistName: '',
            playlistToDelete: null,
            playlistIndexToDelete: null
        }
    },
    methods: {
        async loadPlaylists() {
            try {
                this.isLoading = true;
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "info",
                        data: {
                            user: this.$parent.userId
                        }
                    })
                });

                const data = await response.json();
                
                // Formata as playlists garantindo que todos os campos necessários estejam presentes
                this.playlists = (data.playlists || []).map(playlist => ({
                    name: playlist.name,
                    songs: (playlist.songs || []).map(song => ({
                        id_song: song.id_song,
                        song_name: song.song_name,
                        song_artist: song.song_artist,
                        song_duration: song.song_duration,
                        song_thumbnail: song.song_thumbnail,
                        song_url: song.song_url,
                        // Adiciona campos de compatibilidade para o player
                        name: song.song_name,
                        artist: song.song_artist,
                        cover: song.song_thumbnail,
                        url: song.song_url,
                        duration: song.song_duration,
                        isFavorite: this.$parent.isSongFavorite(song.id_song)
                    }))
                }));

                console.log('Playlists carregadas com sucesso:', this.playlists);
            } catch (error) {
                console.error('Erro ao carregar playlists:', error);
                this.playlists = [];
            } finally {
                this.isLoading = false;
            }
        },
        createPlaylist() {
            console.log('Criar nova playlist');
        },
        confirmDeletePlaylist(index) {
            this.playlistToDelete = this.playlists[index];
            this.playlistIndexToDelete = index;
            this.showDeleteModal = true;
        },
        async deletePlaylist() {
            if (!this.playlistToDelete) return;

            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users/playlists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'remove_playlist',
                        data: {
                            user: this.$parent.userId,
                            playlist_name: this.playlistToDelete.name
                        }
                    })
                });

                await response.json();
                
                // Remove a playlist da lista
                this.playlists.splice(this.playlistIndexToDelete, 1);
                console.log('Playlist removida com sucesso:', this.playlistToDelete.name);

                // Limpa os dados e fecha o modal
                this.playlistToDelete = null;
                this.playlistIndexToDelete = null;
                this.showDeleteModal = false;
            } catch (error) {
                console.error('Erro ao remover playlist:', error);
            }
        },
        async playPlaylist(playlist) {
            if (playlist.songs.length > 0) {
                const firstSong = playlist.songs[0];
                try {
                    const response = await fetch(`${BASE_API_URL}/musicas`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            method: 'audio_stream',
                            data: {
                                url: firstSong.song_url
                            }
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Erro HTTP: ${response.status}`);
                    }

                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);

                    this.$parent.currentTrack = {
                        name: firstSong.song_name,
                        song_name: firstSong.song_name,
                        artist: firstSong.song_artist,
                        cover: firstSong.song_thumbnail,
                        url: audioUrl,
                        song_url: firstSong.song_url,
                        id_song: firstSong.id_song,
                        song_duration: firstSong.song_duration,
                        song_thumbnail: firstSong.song_thumbnail,
                        song_artist: firstSong.song_artist
                    };

                    this.$parent.isPlaying = true;
                    this.$parent.startProgressUpdate();

                } catch (error) {
                    console.error('Erro ao reproduzir playlist:', error);
                }
            }
        },
        openPlaylist(playlist) {
            this.$parent.selectedPlaylist = playlist;
            this.$parent.changePage('playlist-details');
        },
        getRandomCovers(playlist) {
            const availableCovers = playlist.songs
                .filter(song => song.song_thumbnail)
                .map(song => song.song_thumbnail);
            
            const covers = [...availableCovers];
            while (covers.length < 4) {
                covers.push(null);
            }
            
            return covers
                .sort(() => Math.random() - 0.5)
                .slice(0, 4);
        },
        async confirmCreatePlaylist() {
            if (!this.newPlaylistName.trim()) return;

            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users/playlists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'create',
                        data: {
                            user: this.$parent.userId,
                            name: this.newPlaylistName.trim()
                        }
                    })
                });

                await response.json();
                
                // Adiciona a nova playlist à lista
                this.playlists.push({
                    name: this.newPlaylistName.trim(),
                    songs: []
                });

                // Limpa o formulário e fecha o modal
                this.newPlaylistName = '';
                this.showCreateModal = false;

                console.log('Playlist criada com sucesso:', this.newPlaylistName);
            } catch (error) {
                console.error('Erro ao criar playlist:', error);
            }
        },
        async addSongToPlaylist(playlist) {
            if (!this.trackToAdd) {
                console.error('trackToAdd está vazio');
                return;
            }

            if (!playlist || !playlist.name) {
                console.error('playlist inválida:', playlist);
                return;
            }

            // Extrai o ID do vídeo da URL do YouTube se id_song não estiver definido
            let songId = this.trackToAdd.id_song;
            if (!songId && this.trackToAdd.song_url) {
                const urlParams = new URLSearchParams(new URL(this.trackToAdd.song_url).search);
                songId = urlParams.get('v');
                if (!songId) {
                    console.error('Não foi possível extrair o ID do vídeo da URL:', this.trackToAdd.song_url);
                    return;
                }
            }

            const songData = {
                id_song: songId,
                song_name: this.trackToAdd.song_name || this.trackToAdd.name,
                song_artist: this.trackToAdd.song_artist || this.trackToAdd.artist,
                song_duration: this.trackToAdd.song_duration || (this.duration ? Math.floor(this.duration) : 0),
                song_thumbnail: this.trackToAdd.song_thumbnail || this.trackToAdd.cover,
                song_url: this.trackToAdd.song_url || this.trackToAdd.url
            };

            // Verifica se todos os campos obrigatórios estão presentes
            if (!songData.id_song || !songData.song_name || !songData.song_url) {
                console.error('Dados da música incompletos:', songData);
                return;
            }

            console.log('Dados que serão enviados:', {
                method: 'add_songs',
                data: {
                    user: this.$parent.userId,
                    playlist_name: playlist.name,
                    songs: [songData]
                }
            });

            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users/playlists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'add_songs',
                        data: {
                            user: this.$parent.userId,
                            playlist_name: playlist.name,
                            songs: [songData]
                        }
                    })
                });

                const responseData = await response.json();
                console.log('Resposta da API:', responseData);
                
                // Recarrega todas as playlists para garantir que os dados estejam sincronizados
                await this.loadPlaylists();

                // Fecha o modal e limpa o trackToAdd
                this.showAddToPlaylistModal = false;
                this.trackToAdd = null;
                console.log('Música adicionada à playlist:', playlist.name);
            } catch (error) {
                console.error('Erro ao adicionar música à playlist:', error);
                console.error('Detalhes da música:', this.trackToAdd);
                console.error('Detalhes da playlist:', playlist);
            }
        },
        startDragging() {
            // Método para lidar com o início do arrasto da barra de progresso
            document.addEventListener('mousemove', this.updateProgress);
            document.addEventListener('mouseup', () => {
                document.removeEventListener('mousemove', this.updateProgress);
            });
        },
        updateProgress(event) {
            const progressBar = event.target.closest('.progress-bar');
            if (!progressBar) return;

            const rect = progressBar.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.min(Math.max(x / width * 100, 0), 100);
            
            this.progress = percentage;
            if (this.audio) {
                this.audio.currentTime = (percentage / 100) * this.duration;
            }
        },
        toggleShuffle() {
            this.shuffle = !this.shuffle;
            if (this.shuffle && this.playlistQueue && this.playlistQueue.length > 0) {
                // Embaralha a fila de reprodução mantendo a música atual na posição atual
                const currentSong = this.playlistQueue[this.currentPlaylistIndex];
                const remainingSongs = this.playlistQueue
                    .slice(0, this.currentPlaylistIndex)
                    .concat(this.playlistQueue.slice(this.currentPlaylistIndex + 1));
                
                // Embaralha as músicas restantes
                for (let i = remainingSongs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
                }
                
                // Reconstrói a fila com a música atual na mesma posição
                this.playlistQueue = [
                    ...remainingSongs.slice(0, this.currentPlaylistIndex),
                    currentSong,
                    ...remainingSongs.slice(this.currentPlaylistIndex)
                ];
            }
        },
        toggleRepeat() {
            const modes = ['off', 'all', 'one'];
            const currentIndex = modes.indexOf(this.repeatMode);
            this.repeatMode = modes[(currentIndex + 1) % modes.length];
        }
    },
    mounted() {
        this.loadPlaylists();
    }
};

const History = {
    props: ['searchState'],
    template: `
        <div class="page history">
            <div class="page-header">
                <h2>Histórico</h2>
                <button class="clear-btn" @click="showConfirmModal = true" v-if="historyList.length > 0">
                    <i class="fas fa-trash"></i>
                    Limpar Histórico
                </button>
            </div>
            <div class="history-content">
                <div v-if="isLoading" class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando histórico...</p>
                </div>
                <div v-else-if="historyList.length === 0" class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Seu histórico está vazio</p>
                </div>
                <ul v-else class="history-list">
                    <li v-for="(item, index) in historyList" :key="item.id_song" class="history-item" @click="playTrack(item)">
                        <div class="item-cover" :class="{ 'no-image': !item.song_thumbnail }">
                            <img v-if="item.song_thumbnail" :src="item.song_thumbnail" :alt="item.song_name">
                            <i v-else class="fas fa-music"></i>
                        </div>
                        <div class="item-info">
                            <p class="item-name">{{ item.song_name }}</p>
                            <p class="item-artist">{{ item.song_artist }}</p>
                            <p class="item-time">{{ formatHistoryDate(item.played_at) }}</p>
                        </div>
                        <div class="item-actions" @click.stop>
                            <button class="action-btn" :class="{ active: item.isFavorite }" @click="toggleFavorite(index)">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="action-btn" @click="addToPlaylist(item)">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button class="action-btn" @click="removeFromHistory(index)">
                                <i class="fas fa-times"></i>
                            </button>
                            <button class="download-btn" @click="downloadTrack(item)">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </li>
                </ul>
            </div>

            <!-- Modal de Confirmação -->
            <div class="modal" v-if="showConfirmModal">
                <div class="modal-overlay" @click="showConfirmModal = false"></div>
                <div class="modal-content">
                    <h3>Limpar Histórico</h3>
                    <p>Tem certeza que deseja limpar todo o histórico?</p>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" @click="showConfirmModal = false">Cancelar</button>
                        <button class="modal-btn confirm" @click="confirmClearHistory">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            historyList: [],
            isLoading: true,
            showConfirmModal: false
        }
    },
    watch: {
        '$parent.favoriteIds': {
            handler(newFavoriteIds) {
                // Atualiza o estado de favorito das músicas quando favoriteIds mudar
                this.historyList = this.historyList.map(song => ({
                    ...song,
                    isFavorite: newFavoriteIds.has(song.id_song)
                }));
            },
            deep: true
        }
    },
    methods: {
        async loadHistory() {
            try {
                const response = await this.$parent.fetchWithRetry(`${BASE_API_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "info",
                        data: {
                            user: this.$parent.userId
                        }
                    })
                });

                const data = await response.json();
                // Ordena o histórico pela data mais recente primeiro e adiciona o estado de favorito
                this.historyList = (data.history || [])
                    .map(song => ({
                        ...song,
                        isFavorite: this.$parent.isSongFavorite(song.id_song)
                    }))
                    .sort((a, b) => {
                        return new Date(b.played_at) - new Date(a.played_at);
                    });
            } catch (error) {
                console.error('Erro ao carregar histórico:', error);
                this.historyList = [];
            } finally {
                this.isLoading = false;
            }
        },
        async clearHistory() {
            try {
                const response = await fetch(`${BASE_API_URL}/users/history`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'clear',
                        data: {
                            user: this.$parent.userId
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                this.historyList = [];
                console.log('Histórico limpo com sucesso');
            } catch (error) {
                console.error('Erro ao limpar histórico:', error);
            } finally {
                this.showConfirmModal = false;
            }
        },
        confirmClearHistory() {
            this.clearHistory();
        },
        async removeFromHistory(index) {
            const track = this.historyList[index];
            try {
                const response = await fetch(`${BASE_API_URL}/users/history`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'remove_single',
                        data: {
                            user: this.$parent.userId,
                            song_id: track.id_song
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                this.historyList.splice(index, 1);
                console.log('Música removida do histórico:', track.song_name);
            } catch (error) {
                console.error('Erro ao remover música do histórico:', error);
            }
        },
        async playTrack(track) {
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.$parent.currentTrack = {
                    name: track.song_name,
                    song_name: track.song_name,
                    artist: track.song_artist,
                    cover: track.song_thumbnail,
                    url: audioUrl,
                    song_url: track.song_url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail,
                    song_artist: track.song_artist
                };

                this.$parent.isPlaying = true;
                this.$parent.startProgressUpdate();

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        async toggleFavorite(index) {
            const track = this.historyList[index];
            if (track.isFavorite) {
                const success = await this.$parent.removeFromFavorites(track);
                if (success) {
                    track.isFavorite = false;
                    console.log('Removido dos favoritos:', track.song_name);
                }
            } else {
                const success = await this.$parent.addToFavorites(track);
                if (success) {
                    track.isFavorite = true;
                    console.log('Adicionado aos favoritos:', track.song_name);
                }
            }
        },
        async addToPlaylist(track) {
            this.$parent.addToPlaylist(track);
        },
        downloadTrack(track) {
            const formattedTrack = {
                song_name: track.song_name,
                name: track.song_name,
                song_url: track.song_url,
                url: track.song_url
            };
            this.$parent.downloadTrack(formattedTrack);
        },
        formatHistoryDate(date) {
            const now = new Date();
            const diff = now - new Date(date);
            const minutes = Math.floor(diff / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) {
                return `${days} dia${days > 1 ? 's' : ''} atrás`;
            } else if (hours > 0) {
                return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
            } else if (minutes > 0) {
                return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
            } else {
                return 'Agora mesmo';
            }
        }
    },
    mounted() {
        this.loadHistory();
    }
};

const app = createApp({
    data() {
        return {
            userId: USER_ID,
            currentPage: 'home',
            currentTrack: {
                name: 'Selecione uma música',
                artist: 'Artista',
                cover: './assets/images/default-album.png',
                url: null
            },
            favoriteIds: new Set(),
            audio: null,
            isPlaying: false,
            isFavorite: false,
            shuffle: false,
            repeatMode: 'off',
            bluetooth: false,
            volume: 50,
            previousVolume: 50,
            showVolumeSlider: false,
            volumeTimeout: null,
            progress: 0,
            currentTime: 0,
            duration: 0,
            updateProgressInterval: null,
            selectedPlaylist: null,
            isMobile: false,
            deviceType: 'desktop',
            searchState: {
                query: '',
                results: [],
                isLoading: false
            },
            isDragging: false,
            showAddToPlaylistModal: false,
            trackToAdd: null,
            showCreatePlaylistInput: false,
            newPlaylistName: '',
            playlists: []
        }
    },
    computed: {
        currentComponent() {
            const components = {
                home: Home,
                search: Search,
                favorites: Favorites,
                playlists: Playlists,
                history: History,
                'playlist-details': PlaylistDetails
            };
            return components[this.currentPage];
        }
    },
    watch: {
        'currentTrack.url'(newUrl) {
            if (newUrl) {
                if (this.audio) {
                    this.audio.pause();
                    this.audio = null;
                }
                this.audio = new Audio(newUrl);
                this.audio.volume = this.volume / 100;
                
                this.audio.addEventListener('loadedmetadata', () => {
                    this.duration = Math.floor(this.audio.duration);
                    this.currentTime = 0;
                    this.progress = 0;
                });

                this.audio.addEventListener('play', () => {
                    this.addToHistory(this.currentTrack);
                }, { once: true });

                this.audio.addEventListener('timeupdate', () => {
                    if (!this.isDragging) {
                        this.currentTime = Math.floor(this.audio.currentTime);
                        this.progress = (this.currentTime / this.duration) * 100;
                    }
                });

                this.audio.addEventListener('ended', this.handleTrackEnd);
                this.audio.play();
            }
        },
        'currentTrack.id_song': {
            handler(newId) {
                if (newId) {
                    // Atualiza o estado de favorito quando uma nova música é carregada
                    this.isFavorite = this.isSongFavorite(newId);
                }
            },
            immediate: true
        },
        volume(newVolume) {
            if (this.audio) {
                this.audio.volume = newVolume / 100;
            }
        }
    },
    created() {
        this.detectDevice();
        window.addEventListener('resize', this.detectDevice);
        this.loadFavoriteIds();
    },
    beforeUnmount() {
        this.stopProgressUpdate();
        window.removeEventListener('resize', this.detectDevice);
    },
    methods: {
        detectDevice() {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileDevice = /mobile|android|iphone|ipad|ipod|windows phone/i.test(userAgent);
            
            const isMobileWidth = window.innerWidth <= 768;
            
            this.isMobile = isMobileDevice || isMobileWidth;
            
            if (this.isMobile) {
                this.deviceType = window.innerWidth <= 480 ? 'smartphone' : 'tablet';
            } else {
                this.deviceType = 'desktop';
            }
            
            console.log('Tipo de dispositivo:', this.deviceType);
        },
        changePage(page) {
            this.currentPage = page;
        },
        togglePlay() {
            this.isPlaying = !this.isPlaying;
            if (this.audio) {
            if (this.isPlaying) {
                    this.audio.play();
                this.startProgressUpdate();
            } else {
                    this.audio.pause();
                this.stopProgressUpdate();
                }
            }
        },
        previousTrack() {
            if (!this.playlistQueue || this.playlistQueue.length === 0) return;
            
            if (this.currentPlaylistIndex > 0) {
                this.currentPlaylistIndex--;
                const previousSong = this.playlistQueue[this.currentPlaylistIndex];
                this.playTrack(previousSong);
            } else if (this.repeatMode === 'all') {
                // Se estiver no início e repeat all estiver ativo, vai para a última música
                this.currentPlaylistIndex = this.playlistQueue.length - 1;
                const lastSong = this.playlistQueue[this.currentPlaylistIndex];
                this.playTrack(lastSong);
            }
        },
        async playTrack(track) {
            try {
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: track.song_url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                this.currentTrack = {
                    name: track.song_name,
                    song_name: track.song_name,
                    artist: track.song_artist,
                    cover: track.song_thumbnail,
                    url: audioUrl,
                    song_url: track.song_url,
                    id_song: track.id_song,
                    song_duration: track.song_duration,
                    song_thumbnail: track.song_thumbnail,
                    song_artist: track.song_artist
                };

                this.isPlaying = true;
                this.startProgressUpdate();

            } catch (error) {
                console.error('Erro ao reproduzir música:', error);
            }
        },
        nextTrack() {
            if (!this.playlistQueue || this.playlistQueue.length === 0) return;
            
            if (this.shuffle) {
                // Modo aleatório: escolhe uma música aleatória da fila
                const currentIndex = this.currentPlaylistIndex;
                let newIndex;
                do {
                    newIndex = Math.floor(Math.random() * this.playlistQueue.length);
                } while (newIndex === currentIndex && this.playlistQueue.length > 1);
                
                this.currentPlaylistIndex = newIndex;
                this.playTrack(this.playlistQueue[this.currentPlaylistIndex]);
            } else {
                // Modo normal: vai para a próxima música ou volta para o início se repeat all estiver ativo
                if (this.currentPlaylistIndex < this.playlistQueue.length - 1) {
                    this.currentPlaylistIndex++;
                    this.playTrack(this.playlistQueue[this.currentPlaylistIndex]);
                } else if (this.repeatMode === 'all') {
                    this.currentPlaylistIndex = 0;
                    this.playTrack(this.playlistQueue[0]);
                }
            }
        },
        toggleFavorite() {
            if (this.currentTrack && this.currentTrack.id_song) {
                if (this.isFavorite) {
                    this.removeFromFavorites(this.currentTrack);
                } else {
                    this.addToFavorites(this.currentTrack);
                }
            }
        },
        async addToPlaylist(track) {
            this.trackToAdd = track;
            await this.loadPlaylists();
            this.showAddToPlaylistModal = true;
        },
        toggleShuffle() {
            this.shuffle = !this.shuffle;
            if (this.shuffle && this.playlistQueue && this.playlistQueue.length > 0) {
                // Embaralha a fila de reprodução mantendo a música atual na posição atual
                const currentSong = this.playlistQueue[this.currentPlaylistIndex];
                const remainingSongs = this.playlistQueue
                    .slice(0, this.currentPlaylistIndex)
                    .concat(this.playlistQueue.slice(this.currentPlaylistIndex + 1));
                
                // Embaralha as músicas restantes
                for (let i = remainingSongs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
                }
                
                // Reconstrói a fila com a música atual na mesma posição
                this.playlistQueue = [
                    ...remainingSongs.slice(0, this.currentPlaylistIndex),
                    currentSong,
                    ...remainingSongs.slice(this.currentPlaylistIndex)
                ];
            }
        },
        toggleRepeat() {
            const modes = ['off', 'all', 'one'];
            const currentIndex = modes.indexOf(this.repeatMode);
            this.repeatMode = modes[(currentIndex + 1) % modes.length];
        },
        toggleBluetooth() {
            this.bluetooth = !this.bluetooth;
            console.log(`Bluetooth ${this.bluetooth ? 'ativado' : 'desativado'}`);
        },
        toggleVolumeSlider() {
            this.showVolumeSlider = !this.showVolumeSlider;
            
            if (this.showVolumeSlider) {
                if (this.volumeTimeout) {
                    clearTimeout(this.volumeTimeout);
                }
                
                this.volumeTimeout = setTimeout(() => {
                    this.showVolumeSlider = false;
                }, 3000);
            }
        },
        updateVolume(event) {
            this.volume = event.target.value;
            if (this.volume > 0) {
                this.previousVolume = this.volume;
            }
            console.log('Volume alterado para:', this.volume);
        },
        toggleMute() {
            if (this.volume > 0) {
                this.previousVolume = this.volume;
                this.volume = 0;
            } else {
                this.volume = this.previousVolume;
            }
            console.log('Volume:', this.volume > 0 ? 'ativado' : 'mudo');
        },
        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        },
        startProgressUpdate() {
            this.stopProgressUpdate();
            if (this.isPlaying && this.audio) {
            this.updateProgressInterval = setInterval(() => {
                    if (!this.isDragging) {
                        this.currentTime = Math.floor(this.audio.currentTime);
                        this.progress = (this.currentTime / this.duration) * 100;
                }
            }, 1000);
            }
        },
        stopProgressUpdate() {
            clearInterval(this.updateProgressInterval);
        },
        handleTrackEnd() {
            this.isPlaying = false;
            this.progress = 0;
            this.currentTime = 0;
            
            if (this.repeatMode === 'one') {
                // Repete a música atual
                this.audio.currentTime = 0;
                this.audio.play();
                this.isPlaying = true;
            } else if (this.repeatMode === 'all' || this.shuffle) {
                if (this.shuffle) {
                    // Modo aleatório: escolhe uma música aleatória da fila
                    if (this.playlistQueue && this.playlistQueue.length > 0) {
                        const currentIndex = this.currentPlaylistIndex;
                        let newIndex;
                        do {
                            newIndex = Math.floor(Math.random() * this.playlistQueue.length);
                        } while (newIndex === currentIndex && this.playlistQueue.length > 1);
                        
                        this.currentPlaylistIndex = newIndex;
                        this.playTrack(this.playlistQueue[this.currentPlaylistIndex]);
                    }
            } else {
                    // Modo repeat all: vai para a próxima música ou volta para o início
                    if (this.playlistQueue && this.playlistQueue.length > 0) {
                        if (this.currentPlaylistIndex < this.playlistQueue.length - 1) {
                            this.currentPlaylistIndex++;
                        } else {
                            this.currentPlaylistIndex = 0;
                        }
                        this.playTrack(this.playlistQueue[this.currentPlaylistIndex]);
                    }
                }
            }
        },
        openPlaylist(playlist) {
            this.selectedPlaylist = playlist;
            this.changePage('playlist-details');
        },
        updateSearchQuery(query) {
            this.searchState.query = query;
        },
        updateSearchResults(results) {
            this.searchState.results = results;
        },
        setSearchLoading(loading) {
            this.searchState.isLoading = loading;
        },
        downloadTrack: async function(track) {
            const trackToDownload = track || this.currentTrack;
            
            if (!trackToDownload || (!trackToDownload.song_url && !trackToDownload.url)) {
                console.error('Dados da música inválidos para download');
                return;
            }
            
            try {
                console.log('Iniciando download:', trackToDownload.name);
                
                const response = await fetch(`${BASE_API_URL}/musicas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'audio_stream',
                        data: {
                            url: trackToDownload.song_url || trackToDownload.url
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }

                // Obtém o blob do áudio
                const audioBlob = await response.blob();
                
                // Cria um URL temporário para o blob
                const blobUrl = URL.createObjectURL(audioBlob);
                
                // Cria um elemento <a> temporário para download
                const downloadLink = document.createElement('a');
                downloadLink.href = blobUrl;
                
                // Define o nome do arquivo como o nome da música + .mp3
                const fileName = `${trackToDownload.song_name || trackToDownload.name || 'download'}.mp3`;
                downloadLink.download = fileName;
                
                // Adiciona o link ao documento, clica nele e remove
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Limpa o URL do blob
                setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

            } catch (error) {
                console.error('Erro ao baixar música:', error);
            }
        },
        async addToHistory(track) {
            try {
                const response = await fetch(`${BASE_API_URL}/users/history`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'add',
                        data: {
                            user: this.userId,
                            songs: [{
                                id_song: track.id_song || 'song1',
                                song_name: track.song_name || track.name,
                                song_artist: track.song_artist || track.artist,
                                song_duration: track.song_duration || Math.floor(this.duration),
                                song_thumbnail: track.song_thumbnail || track.cover,
                                song_url: track.song_url || track.url,
                                played_at: new Date().toISOString()
                            }]
                        }
                    })
                });

                await response.json();
                console.log('Música adicionada ao histórico:', track.song_name || track.name);
            } catch (error) {
                console.error('Erro ao adicionar música ao histórico:', error);
            }
        },
        async loadFavoriteIds() {
            try {
                const response = await this.fetchWithRetry(`${BASE_API_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "info",
                        data: {
                            user: this.userId
                        }
                    })
                });

                const data = await response.json();
                this.favoriteIds = new Set((data.favorites || []).map(song => song.id_song));
                console.log('Favoritos carregados:', this.favoriteIds);
            } catch (error) {
                console.error('Erro ao carregar favoritos:', error);
                this.favoriteIds = new Set();
            }
        },
        isSongFavorite(songId) {
            return this.favoriteIds.has(songId);
        },
        async addToFavorites(track) {
            try {
                const response = await this.fetchWithRetry(`${BASE_API_URL}/users/favorites`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'add',
                        data: {
                            user: this.userId,
                            songs: [{
                                id_song: track.id_song,
                                song_name: track.song_name || track.name,
                                song_artist: track.song_artist || track.artist,
                                song_duration: track.song_duration || Math.floor(this.duration),
                                song_thumbnail: track.song_thumbnail || track.cover,
                                song_url: track.song_url || track.url
                            }]
                        }
                    })
                });

                await response.json();
                this.favoriteIds.add(track.id_song);
                
                // Atualiza o estado de favorito em todos os componentes
                if (this.searchState.results.length > 0) {
                    this.searchState.results = this.searchState.results.map(song => ({
                        ...song,
                        isFavorite: song.id_song === track.id_song ? true : song.isFavorite
                    }));
                }
                
                // Atualiza o estado no player principal
                if (this.currentTrack.id_song === track.id_song) {
                    this.isFavorite = true;
                }
                
                console.log('Música adicionada aos favoritos:', track.song_name || track.name);
                return true;
            } catch (error) {
                console.error('Erro ao adicionar música aos favoritos:', error);
                return false;
            }
        },
        async removeFromFavorites(track) {
            try {
                const response = await this.fetchWithRetry(`${BASE_API_URL}/users/favorites`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'remove_single',
                        data: {
                            user: this.userId,
                            song_id: track.id_song
                        }
                    })
                });

                await response.json();
                this.favoriteIds.delete(track.id_song);
                
                // Atualiza o estado de favorito em todos os componentes
                if (this.searchState.results.length > 0) {
                    this.searchState.results = this.searchState.results.map(song => ({
                        ...song,
                        isFavorite: song.id_song === track.id_song ? false : song.isFavorite
                    }));
                }
                
                // Atualiza o estado no player principal
                if (this.currentTrack.id_song === track.id_song) {
                    this.isFavorite = false;
                }
                
                console.log('Música removida dos favoritos:', track.song_name || track.name);
                return true;
            } catch (error) {
                console.error('Erro ao remover música dos favoritos:', error);
                return false;
            }
        },
        async fetchWithRetry(url, options, maxRetries = 3, delayMs = 1000) {
            let lastError;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                    }
                    
                    const response = await fetch(url, options);
                    
                    if (response.status === 429) {
                        console.log(`Tentativa ${attempt + 1}/${maxRetries}: Muitas requisições, aguardando...`);
                        continue;
                    }
                    
                    if (!response.ok) {
                        throw new Error(`Erro HTTP: ${response.status}`);
                    }
                    
                    return response;
                } catch (error) {
                    console.log(`Tentativa ${attempt + 1}/${maxRetries} falhou:`, error.message);
                    lastError = error;
                    
                    if (error.message.includes('429')) {
                        continue;
                    }
                    
                    throw error;
                }
            }
            
            throw lastError;
        },
        async loadPlaylists() {
            try {
                this.isLoading = true;
                const response = await this.fetchWithRetry(`${BASE_API_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: "info",
                        data: {
                            user: this.userId
                        }
                    })
                });

                const data = await response.json();
                
                // Formata as playlists garantindo que todos os campos necessários estejam presentes
                this.playlists = (data.playlists || []).map(playlist => ({
                    name: playlist.name,
                    songs: (playlist.songs || []).map(song => ({
                        id_song: song.id_song,
                        song_name: song.song_name,
                        song_artist: song.song_artist,
                        song_duration: song.song_duration,
                        song_thumbnail: song.song_thumbnail,
                        song_url: song.song_url,
                        // Adiciona campos de compatibilidade para o player
                        name: song.song_name,
                        artist: song.song_artist,
                        cover: song.song_thumbnail,
                        url: song.song_url,
                        duration: song.song_duration,
                        isFavorite: this.isSongFavorite(song.id_song)
                    }))
                }));

                console.log('Playlists carregadas com sucesso:', this.playlists);
            } catch (error) {
                console.error('Erro ao carregar playlists:', error);
                this.playlists = [];
            } finally {
                this.isLoading = false;
            }
        },
        async addSongToPlaylist(playlist) {
            if (!this.trackToAdd) {
                console.error('trackToAdd está vazio');
                return;
            }

            if (!playlist || !playlist.name) {
                console.error('playlist inválida:', playlist);
                return;
            }

            // Extrai o ID do vídeo da URL do YouTube se id_song não estiver definido
            let songId = this.trackToAdd.id_song;
            if (!songId && this.trackToAdd.song_url) {
                const urlParams = new URLSearchParams(new URL(this.trackToAdd.song_url).search);
                songId = urlParams.get('v');
                if (!songId) {
                    console.error('Não foi possível extrair o ID do vídeo da URL:', this.trackToAdd.song_url);
                    return;
                }
            }

            const songData = {
                id_song: songId,
                song_name: this.trackToAdd.song_name || this.trackToAdd.name,
                song_artist: this.trackToAdd.song_artist || this.trackToAdd.artist,
                song_duration: this.trackToAdd.song_duration || (this.duration ? Math.floor(this.duration) : 0),
                song_thumbnail: this.trackToAdd.song_thumbnail || this.trackToAdd.cover,
                song_url: this.trackToAdd.song_url || this.trackToAdd.url
            };

            // Verifica se todos os campos obrigatórios estão presentes
            if (!songData.id_song || !songData.song_name || !songData.song_url) {
                console.error('Dados da música incompletos:', songData);
                return;
            }

            console.log('Dados que serão enviados:', {
                method: 'add_songs',
                data: {
                    user: this.userId,
                    playlist_name: playlist.name,
                    songs: [songData]
                }
            });

            try {
                const response = await this.fetchWithRetry(`${BASE_API_URL}/users/playlists`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'add_songs',
                        data: {
                            user: this.userId,
                            playlist_name: playlist.name,
                            songs: [songData]
                        }
                    })
                });

                const responseData = await response.json();
                console.log('Resposta da API:', responseData);
                
                // Recarrega todas as playlists para garantir que os dados estejam sincronizados
                await this.loadPlaylists();

                // Fecha o modal e limpa o trackToAdd
                this.showAddToPlaylistModal = false;
                this.trackToAdd = null;
                console.log('Música adicionada à playlist:', playlist.name);
            } catch (error) {
                console.error('Erro ao adicionar música à playlist:', error);
                console.error('Detalhes da música:', this.trackToAdd);
                console.error('Detalhes da playlist:', playlist);
            }
        },
        async createAndAddToPlaylist() {
            if (!this.newPlaylistName.trim() || !this.trackToAdd) return;

            try {
                // Primeiro cria a playlist
                const createResponse = await this.fetchWithRetry('http://localhost:3000/users/playlists', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        method: 'create',
                        data: {
                            user: this.userId,
                            name: this.newPlaylistName.trim()
                        }
                    })
                });

                await createResponse.json();
                
                // Cria a nova playlist localmente
                const newPlaylist = {
                    name: this.newPlaylistName.trim(),
                    songs: []
                };
                this.playlists.push(newPlaylist);

                // Adiciona a música à playlist recém-criada
                await this.addSongToPlaylist(newPlaylist);

                // Limpa o formulário e fecha o modal
                this.newPlaylistName = '';
                this.showCreatePlaylistInput = false;
                this.showAddToPlaylistModal = false;
                this.trackToAdd = null;

                console.log('Playlist criada e música adicionada com sucesso');
            } catch (error) {
                console.error('Erro ao criar playlist e adicionar música:', error);
            }
        },
        startDragging() {
            // Método para lidar com o início do arrasto da barra de progresso
            document.addEventListener('mousemove', this.updateProgress);
            document.addEventListener('mouseup', () => {
                document.removeEventListener('mousemove', this.updateProgress);
            });
        },
        updateProgress(event) {
            const progressBar = event.target.closest('.progress-bar');
            if (!progressBar) return;

            const rect = progressBar.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const width = rect.width;
            const percentage = Math.min(Math.max(x / width * 100, 0), 100);
            
            this.progress = percentage;
            if (this.audio) {
                this.audio.currentTime = (percentage / 100) * this.duration;
            }
        }
    },
    mounted() {
        this.detectDevice();
        this.loadFavoriteIds();
        this.loadPlaylists();
        
        // Inicializa os gestos de swipe
        if (window.innerWidth <= 768) {  // Só ativa em dispositivos móveis
            const hammer = new Hammer(document.querySelector('#app'));
            
            // Configura para detectar gestos horizontais
            hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
            
            // Manipula o gesto de swipe
            hammer.on('swipeleft swiperight', (ev) => {
                const currentIndex = PAGE_ORDER.indexOf(this.currentPage);
                
                if (ev.type === 'swipeleft') {
                    // Próxima página
                    const nextIndex = (currentIndex + 1) % PAGE_ORDER.length;
                    this.changePage(PAGE_ORDER[nextIndex]);
                } else if (ev.type === 'swiperight') {
                    // Página anterior
                    const prevIndex = (currentIndex - 1 + PAGE_ORDER.length) % PAGE_ORDER.length;
                    this.changePage(PAGE_ORDER[prevIndex]);
                }
                
                // Adiciona feedback visual
                const content = document.querySelector('.content');
                content.style.transition = 'transform 0.3s ease-out';
                content.style.transform = `translateX(${ev.type === 'swipeleft' ? '-' : ''}10px)`;
                
                setTimeout(() => {
                    content.style.transform = 'translateX(0)';
                }, 300);
            });
        }
    }
});

app.mount('#app'); 