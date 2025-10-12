import { TypesCurrency } from "@utils/constants";

export interface WalletCreate {
    userId: number;
    balance: number;
    currency: TypesCurrency;
    matricule: string;
}