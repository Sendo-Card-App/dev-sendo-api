import { ConfigModelCreate } from "@models/config.model"

export const typesToken = [
    'AUTH',
    'VERIFICATION',
    'FORGOT_PASSWORD',
    'NOTIFICATION',
    'EXPO'
] as const
export type TypesToken = typeof typesToken[number]

export const typesTransaction = [
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER',
    'PAYMENT',
    'WALLET_TO_WALLET',
    'SHARED_PAYMENT',
    'FUND_REQUEST_PAYMENT',
    'TONTINE_PAYMENT',
    'VIEW_CARD_DETAILS',
] as const
export type TypesTransaction = typeof typesTransaction[number];

export const typesMethodTransaction = [
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'VIRTUAL_CARD',
    'WALLET',
    'AGENT'
]as const;
export type TypesMethodTransaction = typeof typesMethodTransaction[number];

export const typesStatusTransaction = [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'BLOCKED'
] as const;
export type TypesStatusTransaction = typeof typesStatusTransaction[number];

export const typesStatusWallet = [
    'ACTIVE',
    'BLOCKED'
] as const
export type TypesStatusWallet = typeof typesStatusWallet[number]

export const typesStatusCard = [
    'PRE_ACTIVE',
    'ACTIVE',
    'FROZEN', 
    'TERMINATED',
    'IN_TERMINATION',
    'SUSPENDED',
    'BLOCKED',
] as const
export type TypesStatusCard = typeof typesStatusCard[number]

export const typesStatusUser = [
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED'
] as const
export type TypesStatusUser = typeof typesStatusUser[number]

export const roles: any[] = [
    { name: 'SUPER_ADMIN' },
    { name: 'SYSTEM_ADMIN' },
    { name: 'TECHNICAL_DIRECTOR' },
    { name: 'COMPLIANCE_OFFICER' },
    { name: 'MANAGEMENT_CONTROLLER' },
    { name: 'CUSTOMER_ADVISER' },
    { name: 'CARD_MANAGER' },
    { name: 'CUSTOMER' },
    { name: 'MERCHANT' }
]

export const configs: ConfigModelCreate[] = [
    {
        name: "USD_REAL_TIME_VALUE",
        value: 555,
        description: "Valeur en temps réel du dollar américain (XAF)"
    },
    {
        name: "USD_SENDO_VALUE",
        value: 640,
        description: "Valeur SENDO du dollar américain (XAF)"
    },
    {
        name: "EUR_REAL_TIME_VALUE",
        value: 650,
        description: "Valeur en temps réel de l'euro (XAF)"
    },
    {
        name: "EUR_SENDO_VALUE",
        value: 700,
        description: "Valeur SENDO de l'euro (XAF)"
    },
    {
        name: "CAD_REAL_TIME_VALUE",
        value: 420,
        description: "Valeur en temps réel du dollar canadien (XAF)"
    },
    {
        name: "CAD_SENDO_VALUE",
        value: 410,
        description: "Valeur SENDO du dollar canadien (XAF)"
    },
    {
        name: "YEN_REAL_TIME_VALUE",
        value: 3.92,
        description: "Valeur en temps réel du yen (JPY)"
    },
    {
        name: "YEN_SENDO_VALUE",
        value: 4.10,
        description: "Valeur SENDO du yen (JPY)"
    },
    {
        name: "SALT_ROUND",
        value: 3,
        description: "Nombre de chiffres après la virgule à considérer"
    },
    {
        name: "SENDO_SERVICE_FEES",
        value: 0,
        description: "Frais de service SENDO (%)"
    },
    {
        name: "EXCHANGE_RATES_FEES",
        value: 0.01,
        description: "Frais du taux de change SENDO (%)"
    },
    {
        name: "SPONSORSHIP_FEES",
        value: 1000,
        description: "Frais de parrainage SENDO (XAF)"
    },
    {
        name: "PARTNER_VISA_FEES",
        value: 1.79,
        description: "Frais du partenaire VISA (%)"
    },
    {
        name: "NIU_REQUEST_FEES",
        value: 3000,
        description: "Frais de création d'un NIU (XAF)"
    },
    {
        name: "MIN_AMOUNT_TO_TRANSFER_FROM_CANADA",
        value: 5000,
        description: "Montant minimum à transférer du CANADA (XAF)"
    },
    {
        name: "TRANSFER_FEES",
        value: 1,
        description: "Frais de transfert en dollars CAD ($)"
    },
    {
        name: "TONTINE_FEES_TRANSACTION",
        value: 3,
        description: "Frais SENDO appliqués sur chaque paiement de tontine (%)"
    },
    {
        name: "TONTINE_FEES_DISTRIBUTION",
        value: 1,
        description: "Frais SENDO appliqués sur chaque distribution de tontine (%)"
    },
    {
        name: "SENDO_WITHDRAWAL_PERCENTAGE",
        value: 1,
        description: "Frais SENDO appliqués lors du retrait d'argent du portefeuille (%)"
    },
    {
        name: "SENDO_WITHDRAWAL_FEES",
        value: 0,
        description: "Frais SENDO appliqués lors du retrait d'argent du portefeuille (XAF)"
    },
    {
        name: "SENDO_DEPOSIT_PERCENTAGE",
        value: 0,
        description: "Frais SENDO appliqués lors de la recharge du portefeuille (%)"
    },
    {
        name: "SENDO_DEPOSIT_FEES",
        value: 0,
        description: "Frais SENDO appliqués lors de la recharge du portefeuille (XAF)"
    },
    {
        name: "SENDO_CREATING_CARD_FEES",
        value: 0,
        description: "Frais SENDO appliqués lors de la création d'une carte (XAF)"
    },
    {
        name: "IS_FREE_FIRST_CREATING_CARD",
        value: 1,
        description: "La première création de carte est-elle gratuite ? 1 pour Oui et 0 pour non"
    },
    {
        name: "SENDO_DEPOSIT_CARD_FEES",
        value: 0,
        description: "Frais SENDO appliqués lors d'une recharge de carte (XAF)"
    },
    {
        name: 'SENDO_WITHDRAWAL_CARD_FEES',
        value: 0,
        description: "Frais SENDO appliqués lors d'un retrait de carte (XAF)"
    },
    {
        name: 'SENDO_TRANSACTION_CARD_FEES',
        value: 150,
        description: "Frais SENDO appliqués lors d'un paiement sur la carte (XAF)"
    },
    {
        name: 'SENDO_TRANSACTION_CARD_PERCENTAGE',
        value: 1,
        description: "Frais SENDO appliqués lors d'un paiement sur la carte (%)"
    },
    {
        name: 'NEERO_TRANSACTION_CARD_FEES',
        value: 200,
        description: "Frais NEERO appliqués lors d'un paiement sur la carte (XAF)"
    },
    {
        name: 'NEERO_TRANSACTION_CARD_PERCENTAGE',
        value: 1.5,
        description: "Frais NEERO appliqués lors d'un paiement sur la carte (%)"
    },
    {
        name: 'SENDO_TRANSACTION_CARD_REJECT_FEES',
        value: 200,
        description: "Frais SENDO appliqués lors du rejet d'une transaction de carte (XAF)"
    },
    {
        name: 'SENDO_UNLOCK_CARD_FEES',
        value: 1000,
        description: "Frais SENDO appliqués pour débloquer une carte (XAF)"
    },
    {
        name: 'SENDO_VIEW_DETAILS_CARD_FEES',
        value: 1000,
        description: "Frais SENDO appliqués pour voir les détails cachés d'une carte (XAF)"
    }
]

export const typesCurrency = [
    'XAF',
    'USD',
    'EUR',
    'CAD',
    'JPY'
] as const;
export type TypesCurrency = typeof typesCurrency[number];

export const typesConfig = [
    'USD_REAL_TIME_VALUE',
    'USD_SENDO_VALUE',
    'SALT_ROUND',
    'SENDO_SERVICE_FEES',
    'EXCHANGE_RATES_FEES',
    'SPONSORSHIP_FEES',
    'PARTNER_VISA_FEES',
    'EUR_REAL_TIME_VALUE',
    'EUR_SENDO_VALUE',
    'CAD_REAL_TIME_VALUE',
    'CAD_SENDO_VALUE',
    'YEN_REAL_TIME_VALUE',
    'YEN_SENDO_VALUE',
    'NIU_REQUEST_FEES',
    'TRANSFER_FEES',
    'MIN_AMOUNT_TO_TRANSFER_FROM_CANADA',
    'TONTINE_FEES_TRANSACTION',
    'TONTINE_FEES_DISTRIBUTION',
    "SENDO_WITHDRAWAL_PERCENTAGE",
    "SENDO_WITHDRAWAL_FEES",
    'SENDO_DEPOSIT_PERCENTAGE',
    'SENDO_DEPOSIT_FEES',
    'SENDO_CREATING_CARD_FEES',
    'IS_FREE_FIRST_CREATING_CARD',
    'SENDO_DEPOSIT_CARD_FEES',
    'SENDO_WITHDRAWAL_CARD_FEES',
    'SENDO_TRANSACTION_CARD_FEES',
    'SENDO_TRANSACTION_CARD_PERCENTAGE',
    'NEERO_TRANSACTION_CARD_FEES',
    'NEERO_TRANSACTION_CARD_PERCENTAGE',
    'SENDO_TRANSACTION_CARD_REJECT_FEES',
    'SENDO_UNLOCK_CARD_FEES',
    'SENDO_VIEW_DETAILS_CARD_FEES'
] as const;
export type TypesConfig = typeof typesConfig[number];

export const typesNotification = [
    'SUCCESS_ACCOUNT_VERIFIED',
    'INFORMATION',
    'MARKETING',
    'SUCCESS_KYC_VERIFIED',
    'SUCCESS_TRANSFER_FUNDS',
    'SUCCESS_DEPOSIT_WALLET',
    'SUCCESS_DEPOSIT_CARD',
    'PAYMENT_FAILED',
    'SUCCESS_ADD_SECOND_NUMBER',
    'SUCCESS_VERIFY_SECOND_NUMBER',
    'SUCCESS_CREATING_CARD',
    'ERROR',
    'SUCCESS_MODIFY_PASSWORD',
    'SUCCESS_MODIFY_ACCOUNT_INFORMATIONS',
    'DELETE_ACCOUNT',
    'ENABLED_ACCOUNT',
    'DISABLED_ACCOUNT',
    'PROCESSED_REQUEST',
    'MESSAGE',
    'FUND_REQUEST',
    'SHARED_EXPENSE',
    'TONTINE',
    'SUCCESS_WITHDRAWAL_WALLET',
    'SUCCESS_WITHDRAWAL_CARD',
    'SUCCESS_TRANSACTION_CARD',
    'DELETE_CARD',
    'SUCCESS_ONBOARDING_PARTY'
] as const;
  
export type TypesNotification = typeof typesNotification[number];

export const typesDemande = [
    'NIU_REQUEST'
] as const;
export type TypesDemande = typeof typesDemande[number];

export const typesStatusDemande = [
    'PROCESSED',
    'UNPROCESSED',
    'REJECTED'
] as const
export type TypesStatusDemande = typeof typesStatusDemande[number]

export const typesProviderMobile = [
    'CMORANGEOM',
    'MTNMOMO'
] as const;
export type TypesProviderMobile = typeof typesProviderMobile[number];

export const typesKYCFile = [
    'ID_PROOF', 'ADDRESS_PROOF', 'NIU_PROOF', 'SELFIE', 'RCCM', 'ARTICLES_ASSOCIATION_PROOF'
] as const
export type TypesKYCFile = typeof typesKYCFile[number]

export const typesKYCStatus = [
    'PENDING', 'APPROVED', 'REJECTED'
] as const
export type TypesKYCStatus = typeof typesKYCStatus[number]

export const typesStatusNotification = [
    'SENDED', 'NOT_SENDED'
] as const
export type TypesStatusNotification = typeof typesStatusNotification[number]

export const typesStatusConversation = [
    'OPEN', 'CLOSED', 'PENDING'
] as const
export type TypesStatusConversation = typeof typesStatusConversation[number]

export const typesStatusSharedExpense = [
    'PENDING', 'COMPLETED', 'CANCELLED'
] as const
export type TypesStatusSharedExpense = typeof typesStatusSharedExpense[number]

export const typesPaymentStatusSharedExpense = [
    'PENDING', 'PAYED', 'LATE', 'REFUSED'
] as const
export type TypesPaymentStatusSharedExpense = typeof typesPaymentStatusSharedExpense[number]