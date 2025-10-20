import { TypesCurrency, TypesMethodTransaction, TypesProviderMobile, TypesStatusTransaction, TypesTransaction } from "@utils/constants";
import { BaseEntity } from "./BaseEntity";

export interface TransactionCreate {
    amount: number;
    type: TypesTransaction;
    status: TypesStatusTransaction;
    userId: number;
    receiverId: number;
    receiverType: 'User' | 'Destinataire';
    currency: TypesCurrency | string;
    virtualCardId?: number;
    totalAmount: number;
    exchangeRates?: number;
    sendoFees?: number;
    tva?: number;
    partnerFees?: number;
    description?: string;
    method?: TypesMethodTransaction | null;
    provider?: TypesProviderMobile | null | string;
    transactionReference?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface Transaction extends TransactionCreate {
    id: number;
    transactionId: string;
}