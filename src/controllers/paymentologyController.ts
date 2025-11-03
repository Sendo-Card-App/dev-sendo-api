import WebhookEventModel from "@models/event-webhook.model";
import neeroService, { WebhookEventCreate } from "@services/neeroService";
import paymentologyService from "@services/paymentologyService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";

const COMPAIGN_UUID_PAYMENTOLOGY = process.env.CAMPAIGN_UUID_PAYMENTOLOGY ||"0609AFC0-F6DA-E790-4853B85D4F5F0A92"
class PaymentologyController {
    async createVirtualCard(req: Request, res: Response) {
        try {
            const card = await paymentologyService.createVirtualCard({
                campaignUUID: COMPAIGN_UUID_PAYMENTOLOGY,
                customerReference: "TEST_CUSTOMER",
                cardLabel: "TestCard Sendo",
                notificationNumber: "1122334455",
                expiryDate: "20271125T00:00:00",
                transactionID: "d12d3df4-5e14-45a5-a32c-678c1234dfdb",
                transactionDate: "20251103T00:00:00",
            });

            // On enregistre le webhook event
            const event: WebhookEventCreate = {
                statusCode: 201,
                statusMessage: "Carte virtuelle créée",
                webhookId: card.customerReference,
                content: JSON.stringify(card)
            };
            await WebhookEventModel.create(event);

            console.log("Carte virtuelle créée :", card);
            sendResponse(res, 201, 'Carte créée avec succès', card);
        } catch (error: any) {
            sendError(res, 500, 'Erreur de création', [error.message]);
        }
    }
}

export default new PaymentologyController()