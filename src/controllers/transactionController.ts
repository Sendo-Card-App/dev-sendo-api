import transactionService from "@services/transactionService";
import { PaginatedData } from "../types/BaseEntity";
import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from "express";

class TransactionController {
    async getTransactions(req: Request, res: Response) {
        const { page, limit, startIndex, type, status, method, startDate, endDate } = res.locals.pagination;

        try {
            const transactions = await transactionService.getAllTransactions(
                limit,
                startIndex,
                type,
                status,
                method,
                startDate,
                endDate
            )
            const totalPages = Math.ceil(transactions.count / limit);
                  
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: transactions.count,
                items: transactions.rows
            };
    
            sendResponse(res, 200, 'Transactions récupérées', responseData);
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getTransaction(req: Request, res: Response) {
        const { transactionId } = req.params
        try {
            if (!transactionId) {
                throw new Error('Veuillez fournir le transactionId')
            }
            
            const transaction = await transactionService.getTransactionWithReceiver(transactionId)
            
            sendResponse(res, 200, 'Transaction retrouvée avec succès', transaction)
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }

    async getAllTransactionsUser(req: Request, res: Response) {
        const { userId } = req.params
        const { page, limit, startIndex, type, status, method, startDate, endDate } = res.locals.pagination;
               
        try {
            if (!userId) {
                throw new Error('Veuillez fournir le userId')
            }
            const response = await transactionService.getTransactionsUser(
                parseInt(userId), 
                limit,
                startIndex,
                type,
                status,
                method,
                startDate,
                endDate
            )
            const totalPages = Math.ceil(response.transactions.count / limit);
            const responseData: PaginatedData = {
                page,
                totalPages,
                totalItems: response.transactions.count,
                items: response.transactions.rows
            };

            sendResponse(res, 200, 'Transactions récupérées', {
                user: response.user,
                transactions: responseData
            });
        } catch (error: any) {
            sendError(res, 500, 'Erreur serveur', [error.message]);
        }
    }
}

export default new TransactionController();