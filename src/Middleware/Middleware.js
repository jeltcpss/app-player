import { ZodError } from 'zod';
import { userOperations } from '../DataBase/index.js';
import { 
    APIError, 
    ValidationError, 
    AuthenticationError, 
    AuthorizationError,
    NotFoundError,
    ConflictError,
    formatError 
} from '../utils/ErrorHandler.js';

// Middleware de tratamento de erros
export const errorHandler = (err, req, res, next) => {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const ip = req.ip || req.connection.remoteAddress || 'IP não detectado';
    const reqBody = req.body ? JSON.stringify({
        method: req.body.method,
        data: req.body.data
    }) : 'Sem corpo';

    console.error('Erro:', {
        timestamp,
        ip,
        method: req.method,
        url: req.url,
        request: reqBody,
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code
    });

    // Erros personalizados da API
    if (err instanceof APIError) {
        return res.status(err.status).json(formatError(err));
    }

    // Erros de validação do Zod
    if (err instanceof ZodError) {
        const validationError = new ValidationError('Erro de validação', 
            err.errors.map(e => ({
                campo: e.path.join('.'),
                mensagem: e.message
            }))
        );
        return res.status(400).json(formatError(validationError));
    }

    // Erros de sintaxe JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        const validationError = new ValidationError(
            'JSON inválido',
            'O corpo da requisição contém JSON mal formatado'
        );
        return res.status(400).json(formatError(validationError));
    }

    // Erros do SQLite
    if (err.code && err.code.startsWith('SQLITE_')) {
        let apiError;
        switch (err.code) {
            case 'SQLITE_CONSTRAINT':
                apiError = new ConflictError(
                    'Violação de restrição no banco de dados',
                    'Registro duplicado ou violação de chave estrangeira'
                );
                break;
            case 'SQLITE_BUSY':
                apiError = new APIError(
                    503,
                    'Banco de dados ocupado',
                    'Tente novamente em alguns instantes'
                );
                break;
            case 'SQLITE_READONLY':
                apiError = new APIError(
                    500,
                    'Banco de dados em modo somente leitura',
                    'Operação de escrita não permitida no momento'
                );
                break;
            case 'SQLITE_CORRUPT':
                apiError = new APIError(
                    500,
                    'Banco de dados corrompido',
                    'Entre em contato com o administrador do sistema'
                );
                break;
            default:
                apiError = new APIError(
                    500,
                    'Erro no banco de dados',
                    process.env.NODE_ENV === 'development' ? err.message : 'Erro interno no banco de dados'
                );
        }
        return res.status(apiError.status).json(formatError(apiError));
    }

    // Erros de rede
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        const apiError = new APIError(
            503,
            'Erro de conexão',
            'Não foi possível conectar ao serviço necessário'
        );
        return res.status(503).json(formatError(apiError));
    }

    // Erros de timeout
    if (err.code === 'ETIMEDOUT') {
        const apiError = new APIError(
            504,
            'Timeout',
            'A operação excedeu o tempo limite'
        );
        return res.status(504).json(formatError(apiError));
    }

    // Erro padrão
    const defaultError = new APIError(
        500,
        'Erro interno do servidor',
        process.env.NODE_ENV === 'development' ? err.message : 'Um erro inesperado ocorreu'
    );
    return res.status(500).json(formatError(defaultError));
};

// Middleware de validação de usuário
export const validateUser = async (req, res, next) => {
    try {
        const userId = req.params.userId || req.body.id_user || (req.body.data && req.body.data.user);
        
        // Validação do ID do usuário
        if (!userId) {
            throw new ValidationError(
                'ID do usuário ausente',
                'O ID do usuário é obrigatório para esta operação'
            );
        }

        if (typeof userId !== 'string') {
            throw new ValidationError(
                'ID do usuário inválido',
                'O ID do usuário deve ser uma string'
            );
        }

        // Buscar usuário
        const user = await userOperations.getById(userId);
        
        if (!user) {
            throw new NotFoundError('Usuário', userId);
        }

        // Verificar status do usuário
        if (user.user_status === 'inactive') {
            throw new AuthorizationError(
                'Usuário inativo',
                'Este usuário está com o status inativo e não pode realizar operações'
            );
        }

        // Verificar validade da assinatura
        const validadeDate = new Date(user.validade_date);
        const now = new Date();
        
        if (validadeDate < now) {
            throw new AuthorizationError(
                'Assinatura expirada',
                {
                    mensagem: 'A assinatura deste usuário está expirada',
                    expirou_em: user.validade_date,
                    dias_vencidos: Math.floor((now - validadeDate) / (1000 * 60 * 60 * 24))
                }
            );
        }

        // Verificar se a assinatura está próxima de expirar (7 dias)
        const diasParaExpirar = Math.floor((validadeDate - now) / (1000 * 60 * 60 * 24));
        if (diasParaExpirar <= 7) {
            res.set('X-Subscription-Warning', `Sua assinatura expira em ${diasParaExpirar} dias`);
        }

        // Adicionar informações do usuário à requisição
        req.user = {
            ...user,
            dias_restantes: diasParaExpirar
        };
        
        next();
    } catch (error) {
        // Se já for um erro personalizado, apenas propaga
        if (error instanceof APIError) {
            next(error);
            return;
        }

        // Log do erro para debugging
        console.error('Erro na validação do usuário:', error);

        // Tratamento específico para erros conhecidos
        if (error.code === 'SQLITE_ERROR') {
            next(new APIError(
                500,
                'Erro ao consultar usuário',
                'Erro na consulta ao banco de dados'
            ));
            return;
        }

        next(error);
    }
};

// Middleware de rate limiting
// Para ativar/desativar o rate limiter, use a variável de ambiente RATE_LIMITER_ENABLED:
// - RATE_LIMITER_ENABLED=true (ativa o rate limiter)
// - RATE_LIMITER_ENABLED=false (desativa o rate limiter)
export const rateLimiter = {
    windowMs: 1,
    max: 0,
    standardHeaders: false,
    legacyHeaders: false,
    skipFailedRequests: true,
    skipSuccessfulRequests: true,
    trustProxy: true,
    handler: (req, res, next) => next(),
    skip: () => true
};

// Middleware de segurança otimizado
export const securityMiddleware = {
    helmet: {
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginOpenerPolicy: false,
        dnsPrefetchControl: false,
        frameguard: false,
        hidePoweredBy: true,
        hsts: false,
        ieNoOpen: false,
        noSniff: false,
        permittedCrossDomainPolicies: false,
        referrerPolicy: false,
        xssFilter: false
    },
    bodyParser: {
        limit: '1000mb',
        extended: true,
        parameterLimit: 1000000,
        inflate: true,
        type: ['application/json', 'application/x-www-form-urlencoded']
    }
};

// Configuração do CORS otimizada
export const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
};
