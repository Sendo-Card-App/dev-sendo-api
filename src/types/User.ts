import { BaseEntity } from "./BaseEntity";

export interface User extends BaseEntity { 
    id: number
    firstname: string;
    lastname: string;
    email: string;
    isVerifiedEmail: boolean;
    password: string;
    phone: string;
    address: string;
    profession: string;
    region: string;
    city: string;
    district: string;
    picture: string;
    isVerifiedKYC: boolean;
    wallet: any;
    virtualCard: any;
    transactions: any;
}  

export interface UserCreate {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    country: string;
    dateOfBirth: string;
    placeOfBirth: string;
    status?: string;
    profession?: string;
    region?: string;
    city?: string;
    district?: string;
}

export interface UserUpdate {
    firstname?: string;
    lastname?: string;
    address?: string;
    profession?: string;
    region?: string;
    city?: string;
    district?: string;
    picture?: string;
    numberOfCardsCreated?: number;
}