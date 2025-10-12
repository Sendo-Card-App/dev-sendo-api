import { TypesCurrency, TypesStatusSharedExpense } from "@utils/constants";
import { BaseEntity } from "./BaseEntity";

export interface SharedExpense extends BaseEntity {
    id: number;
    totalAmount: number;
    description: string;
    userId: number;
    initiatorPart: number;
    status: TypesStatusSharedExpense;
    limitDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface SharedExpenseCreate {
    totalAmount: number;
    description: string;
    userId: number;
    limitDate: Date;
    currency?: TypesCurrency;
    participants: Array<{
        matriculeWallet: string;
        amount?: number; // Optional, used for manual share calculation
    }>;
    includeMyself: boolean;
    methodCalculatingShare?: 'auto' | 'manual';
}