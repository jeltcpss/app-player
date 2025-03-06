//exportar schema users
import { z } from "zod";

const Users = z.object({ //schema para armazenamento
    id_user: z.string().min(1), //id do usuário - qualquer string não vazia
    user_status: z.enum(["active", "inactive"]), //status do usuário
    validade_date: z.string().datetime(), //data de validade como string ISO
})

export { Users }; //exportar o schema users
