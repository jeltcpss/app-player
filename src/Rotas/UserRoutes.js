import express from 'express';
import { userOperations, Users } from '../DataBase/index.js';
import { validateUser } from '../Middleware/Middleware.js';

const router = express.Router();

// Rota unificada para todas as operações
router.post('/', async (req, res, next) => {
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
                const users = await userOperations.getAll();
                return res.json(users);

            case 'create':
                if (!data.validade_date) {
                    return res.status(400).json({
                        erro: 'Data de validade não fornecida',
                        detalhes: 'A data de validade é obrigatória'
                    });
                }

                const userData = {
                    id_user: data.id_user || Date.now().toString(),
                    user_status: data.user_status || 'active',
                    validade_date: data.validade_date
                };

                const validatedCreateData = Users.parse(userData);
                await userOperations.create(validatedCreateData);
                return res.status(201).json(validatedCreateData);

            case 'get':
                if (!data.user) {
                    return res.status(400).json({
                        erro: 'ID do usuário não fornecido',
                        detalhes: 'O ID do usuário é obrigatório'
                    });
                }

                const user = await userOperations.getById(data.user);
                if (!user) {
                    return res.status(404).json({
                        erro: 'Usuário não encontrado',
                        detalhes: `Usuário com ID ${data.user} não existe`
                    });
                }
                return res.json(user);

            case 'update':
                if (!data.user || !data.user_status || !data.validade_date) {
                    return res.status(400).json({
                        erro: 'Dados incompletos',
                        detalhes: 'ID do usuário, status e data de validade são obrigatórios'
                    });
                }

                const updateData = {
                    id_user: data.user,
                    user_status: data.user_status,
                    validade_date: data.validade_date
                };

                const validatedUpdateData = Users.parse(updateData);
                await userOperations.update(validatedUpdateData);
                return res.json(validatedUpdateData);

            case 'delete':
                if (!data.user) {
                    return res.status(400).json({
                        erro: 'ID do usuário não fornecido',
                        detalhes: 'O ID do usuário é obrigatório'
                    });
                }

                const userToDelete = await userOperations.getById(data.user);
                if (!userToDelete) {
                    return res.status(404).json({
                        erro: 'Usuário não encontrado',
                        detalhes: `Usuário com ID ${data.user} não existe`
                    });
                }

                await userOperations.delete(data.user);
                return res.json({
                    mensagem: 'Usuário deletado com sucesso',
                    detalhes: `Usuário com ID ${data.user} foi deletado`
                });

            case 'info':
                if (!data.user) {
                    return res.status(400).json({
                        erro: 'ID do usuário não fornecido',
                        detalhes: 'O ID do usuário é obrigatório'
                    });
                }

                const userInfo = await userOperations.getAllUserInfo(data.user);
                if (!userInfo) {
                    return res.status(404).json({
                        erro: 'Informações não encontradas',
                        detalhes: `Não foi possível encontrar informações para o usuário ${data.user}`
                    });
                }
                return res.json(userInfo);

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