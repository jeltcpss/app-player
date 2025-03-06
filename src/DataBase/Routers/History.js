//exportar schema history
import { z } from "zod";

// Schema para as informações da música que serão armazenadas em JSON
const SongHistorySchema = z.object({
  id_song: z.string().min(1), //id da música
  song_name: z.string().min(1), //nome da música
  song_artist: z.string().min(1), //artista da música
  song_duration: z.number(), //duração da música
  song_thumbnail: z.string().url(), //thumbnail da música
  song_url: z.string().url(), //url da música
  played_at: z.string().datetime() //data e hora que foi tocada
});

const History = z.object({
  id_user: z.string().min(1),  // Chave primária
  song_history: z.array(SongHistorySchema),  // Array de músicas do histórico em formato JSON
  updated_at: z.date().default(() => new Date()) //data de atualização
});

export { History }; //exportar o schema history 