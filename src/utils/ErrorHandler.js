// Classe personalizada para erros da API
export class APIError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.details = details;
    }
}

// Classe para erros de validação
export class ValidationError extends APIError {
    constructor(message, details) {
        super(400, message, details);
        this.name = 'ValidationError';
    }
}

// Classe para erros de autenticação
export class AuthenticationError extends APIError {
    constructor(message, details = null) {
        super(401, message, details);
        this.name = 'AuthenticationError';
    }
}

// Classe para erros de autorização
export class AuthorizationError extends APIError {
    constructor(message, details = null) {
        super(403, message, details);
        this.name = 'AuthorizationError';
    }
}

// Classe para erros de recursos não encontrados
export class NotFoundError extends APIError {
    constructor(resource, id = null) {
        const message = id 
            ? `${resource} não encontrado(a) com o identificador: ${id}`
            : `${resource} não encontrado(a)`;
        super(404, message);
        this.name = 'NotFoundError';
    }
}

// Classe para erros de conflito
export class ConflictError extends APIError {
    constructor(message, details = null) {
        super(409, message, details);
        this.name = 'ConflictError';
    }
}

// Função para formatar erro para resposta
export const formatError = (error) => {
    return {
        erro: error.message,
        detalhes: error.details || null,
        ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            name: error.name
        })
    };
}; 