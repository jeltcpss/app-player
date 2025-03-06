//exportar schema favorites, history, playLists e users
import { Favorites } from "./Routers/Favorites.js"; //importar Favorites
import { History } from "./Routers/History.js"; //importar History
import { PlayLists, CreatePlaylistSchema, AddSongsToPlaylistSchema } from "./Routers/PlayLists.js"; //importar PlayLists
import { Users } from "./Routers/Users.js"; //importar Users
import sqlite3 from 'sqlite3'; //importar sqlite3
import path from 'path'; //importar path
import { fileURLToPath } from 'url'; //importar fileURLToPath
import { z } from 'zod';
import fs from 'fs';

// Configuração do caminho do banco de dados
const __filename = fileURLToPath(import.meta.url); //caminho do arquivo
const __dirname = path.dirname(__filename); //caminho do diretório

// Criar pasta do banco de dados se não existir
const dbFolder = path.join(__dirname, '../../banco_de_dados');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
    console.log('Pasta do banco de dados criada:', dbFolder);
}

// Configuração do banco de dados
const dbPath = path.join(dbFolder, 'database.sqlite');
console.log('Caminho do banco de dados:', dbPath);

// Conexão com o banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
    } else {
        console.log('Conectado ao banco de dados SQLite');
    }
});

// Schema para músicas (usado em vários lugares)
export const Song = z.object({
    id_song: z.string(),
    song_name: z.string(),
    song_artist: z.string(),
    song_duration: z.number(),
    song_thumbnail: z.string(),
    song_url: z.string()
});

// Schema para playlists
export const Playlist = z.object({
    id_user: z.string(),
    playlists: z.array(z.object({
        name: z.string(),
        songs: z.array(Song)
    }))
});

// Função para inicializar o banco de dados
const initializeDatabase = () => {
    // Criar tabela de usuários
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id_user TEXT PRIMARY KEY,
            user_status TEXT CHECK(user_status IN ('active', 'inactive')) NOT NULL,
            validade_date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Criar tabela de favoritos
    db.run(`
        CREATE TABLE IF NOT EXISTS favorites (
            id_user TEXT PRIMARY KEY,
            song_favorites BLOB,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_user) REFERENCES users(id_user)
        )
    `);

    // Criar tabela de histórico
    db.run(`
        CREATE TABLE IF NOT EXISTS history (
            id_user TEXT PRIMARY KEY,
            song_history BLOB,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_user) REFERENCES users(id_user)
        )
    `);

    // Criar tabela de playlists
    db.run(`
        CREATE TABLE IF NOT EXISTS playlists (
            id_user TEXT PRIMARY KEY,
            playlists BLOB,
            FOREIGN KEY (id_user) REFERENCES users(id_user)
        )
    `); 
};

// Inicializar o banco de dados
initializeDatabase(); //inicializar o banco de dados

// Função auxiliar para converter JSON para BLOB
const jsonToBlob = (data) => {
    return Buffer.from(JSON.stringify(data)); //converter JSON para BLOB
};

// Função auxiliar para converter BLOB para JSON
const blobToJson = (blob) => {
    return JSON.parse(blob.toString()); //converter BLOB para JSON
};

// Funções para manipular usuários
const userOperations = {
    // Buscar todas as informações do usuário
    getAllUserInfo: async (userId) => { //função para buscar todas as informações do usuário
        try {
            const user = await userOperations.getById(userId); //buscar usuário por id
            if (!user) return null; //se não houver usuário, retornar null

            const favorites = await favoritesOperations.getByUserId(userId); //buscar favoritos por id do usuário
            const history = await historyOperations.getByUserId(userId); //buscar histórico por id do usuário
            const playlists = await playlistOperations.getByUserId(userId); //buscar playlist por id do usuário

            return {
                user, //retornar o objeto row
                favorites: favorites?.song_favorites || [], //retornar o objeto row
                history: history?.song_history || [], //retornar o objeto row
                playlists: playlists?.playlists || [] //retornar o objeto row
            };
        } catch (error) { //se houver erro, retornar o erro
            throw error; //throw error
        }
    },

    // Listar todos os usuários
    getAll: () => { //função para buscar todos os usuários
        return new Promise((resolve, reject) => { //retornar uma promise
            db.all(
                'SELECT * FROM users', //consulta para buscar todos os usuários
                [], //parâmetros para a consulta
                (err, rows) => err ? reject(err) : resolve(rows) //callback para o resultado da consulta
            );
        });
    },

    // Criar novo usuário
    create: (user) => { //função para criar usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            const stmt = db.prepare(`
                INSERT INTO users (id_user, user_status, validade_date)
                VALUES (?, ?, ?)
            `);
            
            stmt.run([user.id_user, user.user_status, user.validade_date], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...user });
                }
            });
            
            stmt.finalize();
        });
    },

    // Buscar usuário por ID
    getById: (userId) => {
        return new Promise((resolve, reject) => { //retornar uma promise
            db.get(
                'SELECT * FROM users WHERE id_user = ?', //consulta para buscar usuário por id
                [userId], //parâmetro para a consulta
                (err, row) => err ? reject(err) : resolve(row) //callback para o resultado da consulta
            );
        });
    },

    // Buscar usuário por email
    getByEmail: (email) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM users WHERE email = ?', //consulta para buscar usuário por email
                [email], //parâmetro para a consulta
                (err, row) => err ? reject(err) : resolve(row) //callback para o resultado da consulta
            );
        });
    },

    // Atualizar usuário
    update: (userData) => { //função para atualizar usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            const { id_user, user_status, validade_date } = userData; //desestruturar o objeto userData
            const stmt = db.prepare(`
                UPDATE users SET user_status = ?, validade_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id_user = ?
            `);
            
            stmt.run([user_status, validade_date, id_user], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    },

    // Deletar usuário
    delete: (userId) => { //função para deletar usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            const stmt = db.prepare(`
                DELETE FROM users WHERE id_user = ?
            `);
            
            stmt.run([userId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            
            stmt.finalize();
        });
    }
};

// Funções para manipular favoritos
const favoritesOperations = {
    // Criar/Atualizar favoritos
    upsert: (userId, favorites) => { //função para criar/atualizar favoritos
        return new Promise((resolve, reject) => { //retornar uma promise
            const blobData = jsonToBlob(favorites); //converter JSON para BLOB
            const stmt = db.prepare(`
                INSERT INTO favorites (id_user, song_favorites, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id_user) DO UPDATE SET
                song_favorites = excluded.song_favorites,
                updated_at = CURRENT_TIMESTAMP
            `);
            
            stmt.run([userId, blobData], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id_user: userId, song_favorites: favorites });
                }
            });
            
            stmt.finalize();
        });
    },

    // Buscar favoritos por ID do usuário
    getByUserId: (userId) => { //função para buscar favoritos por id do usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            db.get(
                'SELECT * FROM favorites WHERE id_user = ?', //consulta para buscar favoritos por id do usuário
                [userId], //parâmetro para a consulta
                (err, row) => { //callback para o resultado da consulta
                    if (err) reject(err);
                    else if (!row || !row.song_favorites) resolve(null);
                    else {
                        const songFavorites = blobToJson(row.song_favorites);
                        resolve({
                            id_user: row.id_user,
                            song_favorites: songFavorites,
                            updated_at: row.updated_at
                        });
                    }
                }
            );
        });
    },

    // Buscar todos os favoritos
    getAllFavorites: () => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM favorites',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const favorites = rows.map(row => ({
                            id_user: row.id_user,
                            song_favorites: row.song_favorites ? blobToJson(row.song_favorites) : [],
                            updated_at: row.updated_at
                        }));
                        resolve(favorites);
                    }
                }
            );
        });
    }
};

// Funções para manipular histórico
const historyOperations = {
    // Adicionar/Atualizar histórico
    upsert: (userId, history) => { //função para criar/atualizar histórico
        return new Promise((resolve, reject) => { //retornar uma promise
            const blobData = jsonToBlob(history); //converter JSON para BLOB
            const stmt = db.prepare(`
                INSERT INTO history (id_user, song_history, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id_user) DO UPDATE SET
                song_history = excluded.song_history,
                updated_at = CURRENT_TIMESTAMP
            `);
            
            stmt.run([userId, blobData], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id_user: userId, song_history: history });
                }
            });
            
            stmt.finalize();
        });
    },

    // Buscar histórico por ID do usuário
    getByUserId: (userId) => { //função para buscar histórico por id do usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            db.get(
                'SELECT * FROM history WHERE id_user = ?', //consulta para buscar histórico por id do usuário
                [userId], //parâmetro para a consulta
                (err, row) => { //callback para o resultado da consulta
                    if (err) reject(err); //se houver erro, retornar o erro
                    else if (!row || !row.song_history) resolve(null); //se não houver row, retornar null
                    else resolve({ //retornar o objeto row
                        ...row, //retornar o objeto row
                        song_history: blobToJson(row.song_history) //converter BLOB para JSON
                    });
                }
            );
        });
    }
};

// Funções para manipular playlists
const playlistOperations = {
    // Criar/Atualizar playlist
    upsert: (userId, playlists) => { //função para criar/atualizar playlist
        return new Promise((resolve, reject) => { //retornar uma promise
            const blobData = jsonToBlob(playlists); //converter JSON para BLOB
            const stmt = db.prepare(`
                INSERT INTO playlists (id_user, playlists)
                VALUES (?, ?)
                ON CONFLICT(id_user) DO UPDATE SET
                playlists = excluded.playlists
            `);
            
            stmt.run([userId, blobData], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id_user: userId, playlists: playlists });
                }
            });
            
            stmt.finalize();
        });
    },

    // Buscar playlist por ID do usuário
    getByUserId: (userId) => { //função para buscar playlist por id do usuário
        return new Promise((resolve, reject) => { //retornar uma promise
            db.get(
                'SELECT * FROM playlists WHERE id_user = ?', //consulta para buscar playlist por id do usuário
                [userId],  //parâmetro para a consulta
                (err, row) => { //callback para o resultado da consulta
                    if (err) reject(err); //se houver erro, retornar o erro
                    else if (!row || !row.playlists) resolve(null); //se não houver row, retornar null
                    else resolve({ //retornar o objeto row
                        ...row, //retornar o objeto row
                        playlists: blobToJson(row.playlists) //converter BLOB para JSON
                    });
                }
            );
        });
    }
};

// Exportar schemas, conexão do banco e funções auxiliares
export { 
    Favorites, //schema para armazenamento
    History, //schema para armazenamento
    PlayLists, //schema para armazenamento
    CreatePlaylistSchema, //schema para criar playlist
    AddSongsToPlaylistSchema, //schema para adicionar músicas à playlist
    Users, //schema para armazenamento
    db, //conexão do banco de dados
    jsonToBlob, //função para converter JSON para BLOB
    blobToJson, //função para converter BLOB para JSON
    userOperations, //funções de manipulação de usuários
    favoritesOperations, //funções de manipulação de favoritos
    historyOperations, //funções de manipulação de histórico
    playlistOperations //funções de manipulação de playlists
};


