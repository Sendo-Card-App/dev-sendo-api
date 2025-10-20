import { randomInt } from 'crypto';
import crypto from 'crypto';
import { TypesDemande, TypesStatusCard, TypesStatusDemande, typesStatusTransaction } from './constants';
import FundRequestModel from '@models/fund-request.model';
import { Request } from 'express';
import axios from 'axios';
import { extname } from 'path';

// Interface pour représenter un fichier téléchargé
export interface DownloadedFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
}

export function generatePassword(): string {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return Array.from({length: 8}, () => 
        caracteres[randomInt(0, caracteres.length)]
    ).join('');
}

export function generateMethodSignature(methodName: string, args: any[], privateKey: string) {
    if (!privateKey) throw new Error('Clé privée manquante');
    
    // 1. Concaténation des éléments
    const data = [methodName, ...args.map(String)].join('|');
    
    // 2. Création du HMAC-SHA256
    const hmac = crypto.createHmac('sha256', privateKey);
    hmac.update(data, 'utf8');
    
    // 3. Conversion en hexadécimal
    return hmac.digest('hex');
}

export const generateMatriculeWallet = () => {
    return 'SDO' + Math.floor(100000 + Math.random() * 900000).toString();
};

export function generateTransactionId(): string {
    const now = new Date();

    // Date JJMMAA (02/05/2025 → 250502)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(2); // 2025 → 25
    const date = `${day}${month}${year}`; // 250502

    // Heure HHMM (15h46 → 1546)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const time = `${hours}${minutes}`; // 1546

    // Lettre majuscule aléatoire
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z

    // Cinq chiffres aléatoires
    const numbers = String(Math.floor(Math.random() * 100000)).padStart(5, '0'); // 0-99999

    return `SDO${date}.${time}.${letter}${numbers}`;
}

export function generateAlphaNumeriqueString(length: number) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({length: length}, () => 
        caracteres[randomInt(0, caracteres.length)]
    ).join('');
}

export async function generateUniqueReference() {
  let ref;
  let exists = true;
  while (exists) {
    ref = generateAlphaNumeriqueString(9);
    exists = (await FundRequestModel.findOne({ where: { reference: ref } })) !== null;
  }
  return ref;
}

export function getUTCBoundaries(dateStr: string) {
    // dateStr au format 'YYYY-MM-DD'
    const date = new Date(dateStr + 'T00:00:00Z'); // début de journée UTC
    const start = new Date(date);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999); // fin de journée UTC
    return { start, end };
}

export function getLibelleRequest(type: TypesDemande): string {
    switch (type) {
        case 'NIU_REQUEST':
            return 'Demande de NIU';
        default:
            return '';
    }
}

export function getLibelleStatutRequest(type: TypesDemande, statut: TypesStatusDemande): string {
    switch (type) {
        case 'NIU_REQUEST':
            switch (statut) {
                case 'PROCESSED':
                    return 'Traitée';
                case 'UNPROCESSED':
                    return 'En attente';
                case 'REJECTED':
                    return 'Rejetée';
                default:
                    return '';
            }
        default:
            return '';
    }
}

export function generateNumericCode(digits: number): string {
  if (digits <= 0) {
    throw new Error('Le nombre de chiffres doit être supérieur à 0');
  }
  const max = 10 ** digits;
  const code = Math.floor(Math.random() * max);
  return code.toString().padStart(digits, '0');
}

export function detectOperator(phoneNumber: string): { phone: string; operator: string } {
  // Regex Orange (Cameroon)
  const orangeRegex = /^(237)?((655|656|657|658|659|686|687|688|689)[0-9]{6}$|(69[0-9]{7})$)/;

  // Regex MTN (Cameroon)
  const mtnRegex = /^(237|00237|\+237)?((650|651|652|653|654|680|681|682|683)\d{6}$|(67\d{7}$|(4\d{10})))$/;

  // Nettoyer le numéro : retirer espaces, tirets, +, etc.
  const cleanedNumber = phoneNumber.replace(/[\s\-+]/g, '');

  let operator = "Inconnu";

  if (orangeRegex.test(cleanedNumber)) {
    operator = "Orange";
  } else if (mtnRegex.test(cleanedNumber)) {
    operator = "MTN";
  }

  return {
    phone: cleanedNumber,
    operator
  };
}

export function detectMoneyTransferType(phoneNumber: string): { phone: string; transferType: string } {
  // Regex Orange (Cameroun)
  const orangeRegex = /^(237)?((655|656|657|658|659|686|687|688|689)[0-9]{6}$|(69[0-9]{7})$)/;

  // Regex MTN (Cameroun)
  const mtnRegex = /^(237|00237|\+237)?((650|651|652|653|654|680|681|682|683)\d{6}$|(67\d{7}$|(4\d{10})))$/;

  // Nettoyer le numéro : retirer espaces, tirets, +, etc.
  const cleanedNumber = phoneNumber.replace(/[\s\-+]/g, '');

  let transferType = "UNKNOWN_TRANSFER";

  if (orangeRegex.test(cleanedNumber)) {
    transferType = "ORANGE_MONEY_TRANSFER";
  } else if (mtnRegex.test(cleanedNumber)) {
    transferType = "MTN_MONEY_TRANSFER";
  }

  return {
    phone: cleanedNumber,
    transferType
  };
}

export function detectOtherMoneyTransferType(phoneNumber: string): "ORANGE_MONEY" | "MTN_MONEY" {
  // Regex Orange (Cameroun)
  const orangeRegex = /^(237)?((655|656|657|658|659|686|687|688|689)[0-9]{6}$|(69[0-9]{7})$)/;

  // Regex MTN (Cameroun)
  const mtnRegex = /^(237|00237|\+237)?((650|651|652|653|654|680|681|682|683)\d{6}$|(67\d{7}$|(4\d{10})))$/;

  // Nettoyer le numéro : retirer espaces, tirets, +, etc.
  const cleanedNumber = phoneNumber.replace(/[\s\-+]/g, '');

  let transferType: "ORANGE_MONEY" | "MTN_MONEY" = "ORANGE_MONEY";

  if (orangeRegex.test(cleanedNumber)) {
    transferType = "ORANGE_MONEY";
  } else if (mtnRegex.test(cleanedNumber)) {
    transferType = "MTN_MONEY";
  }

  return transferType;
}

export function checkSignatureNeero(req: Request, webhookSecret: string) {
  const timeStamp = req.headers['X-TIMESTAMP'];
  const signatureFromRequest = req.headers['X-SIGNATURE'];
  const bodyContent = req.body;

  const stringToSign = timeStamp + bodyContent.toString('utf-8');

  const hmac = crypto.createHmac('sha512', webhookSecret);
  hmac.update(stringToSign);
  const calculatedSignature = hmac.digest('hex');

  return calculatedSignature == signatureFromRequest;
}

export function mapNeeroStatusToSendo(neeroStatus: string): 'PENDING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' {
  const statusMap: Record<string, string> = {
    'PENDING': typesStatusTransaction['0'],       // Statut initial
    'SUCCESSFUL': typesStatusTransaction['1'],     // Succès
    'FAILED': typesStatusTransaction['2'],        // Échec
    'INITIALIZED': typesStatusTransaction['0'],      // initié
    'SUCCESS': typesStatusTransaction['1'],     // Succès
  };

  return (statusMap[neeroStatus] || typesStatusTransaction['0']) as 'PENDING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
}

export function getCodeRegionCameroun(regionName: string): string | null {
    // Dictionnaire des régions avec leurs codes (abréviations usuelles)
    const regionsCodes: { [key: string]: string } = {
        "Adamaoua": "AD",
        "Centre": "CE",
        "Est": "ES",
        "Extrême-Nord": "EN",
        "Littoral": "LT",
        "Nord": "NO",
        "Nord-Ouest": "NW",
        "Ouest": "OU",
        "Sud": "SU",
        "Sud-Ouest": "SW"
    };

    // Normalisation simple du nom (trim + casse insensible)
    const normalized = regionName.trim().toLowerCase();

    // Recherche dans le dictionnaire en ignorant la casse
    for (const [region, code] of Object.entries(regionsCodes)) {
        if (region.toLowerCase() === normalized) {
            return code;
        }
    }

    // Si non trouvé, retourne null
    return null;
}

export function enleverPrefixe237(numero: string): string {
    // Supprime le préfixe +237 ou 237 s'il est au début de la chaîne
    if (numero.startsWith('+237')) {
      return numero.slice(4);
    } else if (numero.startsWith('237')) {
      return numero.slice(3);
    } else {
      return numero;
    }
}

export function formaterDateISO(dateInput: string | Date): string | null {
    const date = new Date(dateInput);

    // Vérifie si la date est valide
    if (isNaN(date.getTime())) {
        return null; // ou tu peux lancer une erreur selon besoin
    }

    // Récupère l'année, le mois et le jour en ajoutant un zéro devant si nécessaire
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // mois de 0 à 11 donc +1
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Compare deux dates au format ISO 8601 (avec ou sans microsecondes)
 * Retourne true si la première date est antérieure à la seconde.
 */
export function isBefore(date: string): boolean {
  const now = new Date().toISOString();
  console.log('date actuelle : ', now)
  // On coupe à 3 chiffres après le point pour être sûr que le parse fonctionne
  const parseDate = (d: string) => new Date(d.replace(/(\.\d{3})\d+/, '$1'));
  return parseDate(now).getTime() < parseDate(date).getTime();
}

/**
 * Télécharge et recrée des fichiers à partir d'une liste d'URLs.
 * @param urls Liste des URLs à télécharger
 * @returns Liste des fichiers sous forme d'objet { originalname, mimetype, buffer }
 */
/**
 * Télécharge et recrée des fichiers à partir d'une liste d'URLs.
 * @param urls Liste des URLs à télécharger
 * @returns Liste des fichiers sous forme d'objet { originalname, mimetype, buffer }
 */
export async function recreateFilesFromUrls(urls: string[]): Promise<DownloadedFile[]> {
    const files: DownloadedFile[] = [];

    for (const url of urls) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const contentType = response.headers['content-type'] || 'application/octet-stream';
            // Extraction du nom du fichier depuis l'URL (sans query string)
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            // Correction potentielle: assurez-vous que originalname est toujours significatif
            const originalname = pathname.split('/').pop() || `file${extname(pathname) || '.bin'}`; // Ajout d'une extension par défaut si aucune n'est trouvée
            
            files.push({
                originalname,
                mimetype: contentType,
                buffer: Buffer.from(response.data)
            });
        } catch (err) {
            console.error(`Erreur lors du téléchargement du fichier: ${url}`, err);
        }
    }

    return files;
}

export function mapDocumentType(input: string): string {
  switch (input) {
    case 'ID_PROOF':
      return 'NATIONALID';
    case 'ADDRESS_PROOF':
      return 'Locationmap';
    case 'SELFIE':
      return 'SELFIE';
    default:
      return 'NATIONALID';
  }
}

export function mapStatusCard(status: TypesStatusCard): string {
  switch (status) {
    case 'ACTIVE':
      return 'activée';
    case 'PRE_ACTIVE':
      return 'pré-activée';
    case 'BLOCKED':
      return 'bloquée';
    case 'FROZEN':
      return 'gêlée';
    case 'TERMINATED':
      return 'supprimée';
    default:
      return '';
  }
} 

export function validateAndTruncateCardName(cardName: string): string {
  if (cardName.length > 19) {
    return cardName.slice(0, 19);
  }
  return cardName;
}

export function ajouterPrefixe237(numero: string): string {
  if (numero.startsWith("+237")) {
    return numero;
  } else if (numero.startsWith("237")) {
    return "+" + numero;
  }
  return "+237" + numero;
}

export function roundToNextMultipleOfFive(num: number): number {
  return Math.ceil(num / 5) * 5;
}

export function roundToPreviousMultipleOfFive(num: number): number {
  return Math.floor(num / 5) * 5;
}

export function arrondiSuperieur(val: number): number {
  return Math.ceil(val);
}

export function troisChiffresApresVirgule(nombre: number): number {
  return Math.round(nombre * 1000) / 1000;
}

