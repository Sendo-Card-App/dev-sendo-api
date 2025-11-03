import axios from "axios";
import crypto from "crypto";
import { parseStringPromise } from "xml2js";

class PaymentologyService {
    private baseUrl = process.env.API_PAYMENTOLOGY_URL || "https://apidev.voucherengine.com/card/v1/xmlrpc.cfm";
    private terminalId = process.env.TERMINAL_ID_PAYMENTOLOGY || "0014682067";
    private terminalPassword = process.env.PASSWORD_PAYMENTOLOGY || "064A40BEB7";

    /**
     * Crée une carte virtuelle Paymentology
     * @param data Données nécessaires à la création de la carte
     */
    async createVirtualCard(data: {
        campaignUUID: string;
        customerReference: string;
        cardLabel: string;
        notificationNumber: string;
        expiryDate: string; // format: YYYYMMDD ou ISO8601
        transactionID: string;
        transactionDate: string; // format: YYYYMMDD ou ISO8601
    }) {
        try {
            const {
                campaignUUID,
                customerReference,
                cardLabel,
                notificationNumber,
                expiryDate,
                transactionID,
                transactionDate,
            } = data;

            // 1️⃣ Génération du checksum (HMAC-SHA256)
            const methodName = "CreateVirtualCard";
            const concatenated =
                methodName +
                this.terminalId +
                campaignUUID +
                customerReference +
                cardLabel +
                notificationNumber +
                expiryDate +
                transactionID +
                transactionDate;

            const checksum = crypto
            .createHmac("sha256", this.terminalPassword)
            .update(concatenated)
            .digest("hex")
            .toUpperCase();

            // 2️⃣ Construction du corps XML-RPC
            const xmlBody = `
            <?xml version="1.0"?>
            <methodCall>
                <methodName>${methodName}</methodName>
                <params>
                <param><value><string>${this.terminalId}</string></value></param>
                <param><value><string>${campaignUUID}</string></value></param>
                <param><value><string>${customerReference}</string></value></param>
                <param><value><string>${cardLabel}</string></value></param>
                <param><value><string>${notificationNumber}</string></value></param>
                <param><value><dateTime.iso8601>${expiryDate}</dateTime.iso8601></value></param>
                <param><value><string>${transactionID}</string></value></param>
                <param><value><dateTime.iso8601>${transactionDate}</dateTime.iso8601></value></param>
                <param><value><string>${checksum}</string></value></param>
                </params>
            </methodCall>
            `;

            // 3️⃣ Envoi de la requête vers Paymentology
            const response = await axios.post(this.baseUrl, xmlBody, {
                headers: {
                    "Content-Type": "text/xml",
                },
            });

            // 4️⃣ Parsing du XML en JSON
            const parsed = await parseStringPromise(response.data, { explicitArray: false });

            // 5️⃣ Extraction des données utiles
            const struct = parsed?.methodResponse?.params?.param?.value?.struct?.member;

            if (!struct) {
                throw new Error("Structure inattendue dans la réponse Paymentology");
            }

            const result: Record<string, any> = {};
            if (Array.isArray(struct)) {
                struct.forEach((item) => {
                    const key = item.name;
                    const value =
                        item.value?.string ||
                        item.value?._ ||
                        item.value?.int ||
                        item.value?.["dateTime.iso8601"] ||
                        null;
                    result[key] = value;
                });
            }

            return result;
        } catch (error: any) {
            console.error("Erreur lors de la création de la carte virtuelle :", error.message);
            throw new Error("Échec de la création de la carte virtuelle");
        }
    }
}

export default new PaymentologyService()