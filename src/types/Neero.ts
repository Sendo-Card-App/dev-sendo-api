import { TypesStatusCard } from "@utils/constants";
import { DownloadedFile } from "@utils/functions";

export interface PartyInfo {
  firstName: string;
  familyName: string;
  givenName: string;
  birthDate: string; // format ISO date "YYYY-MM-DD"
  idDocumentType: string; // ex: "ID_CARD", "PASSPORT", etc.
  idDocumentNumber: string;
  taxIdNumber: string;
  nationality: string; // code pays ISO 2 lettres
}

export type LocationType = 
  | "PLACEOFBIRTH"
  | "DOMICILEADDRESS"
  | "WORKADDRESS"
  | "DELIVERYPOINTADDRESS";

export interface Location {
  address1: string;
  address2: string;
  address3: string;
  postalCode: string;
  city: string;
  region: string;
  country: string; // code pays ISO 2 lettres
  longitude: number | null;
  latitude: number | null;
  type: LocationType;
}

export type ContactPointType = "EMAIL" | "PHONENUMBER" | "SOCIALNETWORK" | "SITEWEB";

export interface ContactPoint {
  type: ContactPointType;
  country: string; // code pays ISO 2 lettres
  value: string;
}

export type CapacityCode = "CAN_MANAGE_CARDS" | "CAN_INITIATE_PAYMENTS";

export interface Capacity {
  code: CapacityCode;
  enabled: boolean;
}

export type PartyType = "PERSON" | "ORGANISATION";

export interface PartyObject {
  type: PartyType;
  partyInfo: PartyInfo;
  locations: Location[];
  contactPoints: ContactPoint[];
  capacities: Capacity[];
}

export interface RequiredDocument {
  name: string;
  type: "ALL_REQUIRED" | "ANY_REQUIRED";
  documents: {
    code: string;
  }[];
}

export type OnboardingStatus =
  | "INIT"
  | "WAITING_FOR_INFORMATION"
  | "UNDER_VERIFICATION"
  | "VERIFIED"
  | "REFUSED"
  | "REFUSED_TIMEOUT";

export interface CreateOnboardingSessionResponse {
  key: string;
  expirationDateTime: string; // ISO date-time string
  status: OnboardingStatus;
  merchantkey: string;
  store_id: string;
  partyKey: string;
  requiredDocument: RequiredDocument[];
}

export interface UploadDocumentsPayload {
  files: DownloadedFile[] // selon environnement (navigateur ou Node.js)
  documentType: string;
}

export interface UploadDocumentsResponse {
  message?: string; // ex: "Upload successful"
  success?: boolean;
}

export interface CreateCardPayload {
  partyId: string;
  cardName: string;
}

export interface CreateCardResponse {
  cardId: number;
  cardName: string;
  last4Digits: string;
  status: string;
  expirationDate: string;
  createdAt: string;
  storeId: string;
  merchantKey: string;
}

export interface CreateCardModel {
  cardId: number;
  last4Digits: string;
  partyId: string;
  status: TypesStatusCard;
  userId: number;
  cardName: string;
  expirationDate: string;
}

export interface FreezeCardPayload extends CardPayload {
  freeze: boolean;
}

export interface CardPayload {
  cardId: number;
  cardCategory: 'VIRTUAL' | 'PHYSICAL';
}