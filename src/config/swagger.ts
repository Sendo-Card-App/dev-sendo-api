import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';


const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Documentation API Sendo',
      version: '1.1.0',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        PasscodeAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Passcode',
          description: 'Passcode de sécurité (4-6 chiffres)'
        }
      },
      responses: {
        Unauthorized: {
          description: 'Token manquant ou invalide',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        Forbidden: {
          description: "Droits insuffisants pour l'opération",
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ServerError: {
          description: 'Erreur serveur',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        User: {
          description: 'User retourné',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserModel' }
            }
          }
        },
        Request: {
          description: 'Demande retournée',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RequestModel' }
            }
          }
        },
        Contact: {
          description: 'Contact retourné',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Contact' }
            }
          }
        },
        Conversation: {
          description: 'Conversation retournée',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Conversation' }
            }
          }
        },
        Message: {
          description: 'Message retournée',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Message' }
            }
          }
        },
        TransactionMobileMoney: {
          description: 'Transaction mobile retournée',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransactionMobileMoney' }
            }
          }
        }
      },
      schemas: {
        ApiResponse: { 
          type: 'object',
          properties: {
            status: {
              type: 'number',
            },
            message: {
              type: 'string',
            },
            data: {
              type: 'object',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } }
          }
        },
        KycDocument: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            type: { 
              type: 'string',
              enum: ['ID_PROOF', 'ADDRESS_PROOF', 'INCOME_PROOF']
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED']
            },
            url: { type: 'string' },
            rejectionReason: { type: 'string' },
            reviewedAt: { type: 'string', format: 'date-time' }
          }
        },
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            phone: { type: 'string' },
            userId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          },
        },
        UserModel: {
          type: 'object',
          properties: {
            firstname: { type: 'string' },
            lastname: { type: 'string' },
            password: { type: 'string'},
            email: { type: 'string' },
            isVerifiedEmail: { type: 'boolean' },
            phone: { type: 'string' },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'BLOCKED']
            },
            passcode: { 
              type: 'string',
              description: 'Code secret à 4-6 chiffres',
              example: '123456'
            },
            address: { type: 'string' },
            region: { type: 'string' },
            profession: { type: 'string' },
            city: { type: 'string' },
            district: { type: 'string' },
            isVerifiedKYC: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          }
        },
        Request: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            status: { type: 'string' },
            description: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'integer' },
            adminId: { type: 'integer' },
            status: {
              type: 'string',
              enum: ['OPEN', 'CLOSED', 'PENDING']
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            senderType: {
              type: 'string',
              enum: ['CUSTOMER', 'ADMIN']
            },
            userId: { type: 'integer' },
            conversationId: { type: 'integer' },
            read: { type: 'boolean' },
            attachments: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: 'string', format: 'date-time' }
          }
        },
        TransactionMobileMoney: {
          type: 'object',
          properties: {
            ptn: { type: 'string' },
            serviceid: { type: 'string' },
            merchant: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            receiptNumber: { type: 'string' },
            veriCode: { type: 'string' },
            clearingDate: { type: 'string', format: 'date-time' },
            trid: { type: 'string' },
            priceLocalCur: { type: 'string' },
            priceSystemCur: { type: 'string' },
            localCur: { type: 'string' },
            systemCur: { type: 'string' },
            pin: null,
            tag: null,
            status: { type: 'string' },
            payItemDescr: null,
            payItemId: { type: 'string' },
            errorCode: null
          }
        }
      },
    },
    servers: [
      {
        url: 'https://dev.api.sf-e.ca/api',
        description: 'Serveur de test en production',
      },
      {
        url: 'http://localhost:3001/api',
        description: 'Serveur de test en local',
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Gestion de l\'authentification des utilisateurs'
      },
      {
        name: 'Users',
        description: 'Gestion des utilisateurs'
      },
      {
        name: 'Wallets',
        description: 'Gestion des portefeuilles'
      },
      {
        name: 'Virtual Cards',
        description: 'Gestion des cartes virtuelles'
      },
      {
        name: 'Debts',
        description: 'Gestion des dettes'
      },
      {
        name: 'Transactions',
        description: 'Gestion des transactions'
      },
      {
        name: 'Admin',
        description: 'Gestion des opérations administratives'
      },
      {
        name: 'KYC',
        description: 'Gestion de la vérification d\'identité (KYC)'
      },
      {
        name: 'Requests',
        description: 'Gestion des demandes des utilisateurs'
      },
      {
        name: 'Configs',
        description: 'Gestion des valeurs configurables'
      },
      {
        name: 'Notifications',
        description: "Gestion de l'envoi et la réception des notifications push"
      },
      {
        name: 'Contacts',
        description: 'Gestion des contacts de l\'utilisateur'
      },
      {
        name: 'Chat',
        description: 'Gestion de la messagerie instantanée'
      },
      {
        name: 'Mobile Money',
        description: 'Gestion de la recharge et retrait mobile money'
      },
      {
        name: 'Transfert Argent',
        description: 'Gestion des transferts d\'argent Canada-Cameroun'
      },
      {
        name: 'Dépenses Partagées',
        description: 'Gestion des dépenses partagées entre utilisateurs'
      },
      {
        name: 'Demandes Fonds',
        description: "Gestion de la demande de fonds pour service rendu"
      },
      {
        name: 'Tontines',
        description: "Gestion des tontines numériques"
      },
      {
        name: 'Publicités',
        description: 'Gestion des publicités et promotions'
      },
      {
        name: 'Webhook',
        description: 'Gestion des retours externes'
      },
      {
        name: 'Email',
        description: 'Gestion de l\'envoi d\'emails'
      }
    ]
  },
  security: [{
    BearerAuth: [],
    PasscodeAuth: []
  }],
  apis: ['./src/routes/*.ts'],
};

const specs = swaggerJsdoc(options);

export default (app: Express) => {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(specs)
  );
};