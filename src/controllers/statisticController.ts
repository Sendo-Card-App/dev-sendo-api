import statisticService from "@services/statisticService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { TypesTransaction } from "@utils/constants";
import { Request, Response } from "express";

/**
 * StatisticController
 * @description Controller for handling statistics-related requests.
 */
class StatisticController {
    async getStatistics(req: Request, res: Response) {
        const { startDate, endDate } = res.locals.pagination;
        try {
            const userStats = await statisticService.getUserStatistics()
            const roleStats = await statisticService.getRoleStatistics()
            const walletStats = await statisticService.getWalletStatistics();
            const transactionStats = await statisticService.getTransactionStatistics(startDate, endDate);
            const cardStats = await statisticService.getVirtualCardStatistics(startDate, endDate);
            const requestStats = await statisticService.getRequestStatistics(startDate, endDate);
            const sharedExpensesStats = await statisticService.getSharedExpenseStatistics(startDate, endDate);
            const requestFundsStats = await statisticService.getRequestFundsStatistics(startDate, endDate);
            const tontineStats = await statisticService.getTontineStatistics(startDate, endDate);
            const merchantStats = await statisticService.getMerchantStatistics(startDate, endDate);
            const merchantFeesStats = await statisticService.getMerchantFeesStatistics(startDate, endDate);
            const merchantWithdrawStats = await statisticService.getMerchantWithdrawalsStatistics(startDate, endDate)

            sendResponse(res, 200, 'Statistiques récupérées avec succès', {
                userStats,
                walletStats,
                transactionStats,
                cardStats,
                requestStats,
                sharedExpensesStats,
                requestFundsStats,
                tontineStats,
                merchantStats,
                merchantFeesStats,
                merchantWithdrawStats,
                roleStats
            });
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des statistiques', [error.message]);
        }
    }

    async getStatisticsForMerchant(req: Request, res: Response) {
        const { startDate, endDate } = res.locals.pagination;
        const { merchantId } = req.params
        try {
            const statsForMerchant = await statisticService.getStatisticsForMerchant(
                Number(merchantId),
                startDate, 
                endDate
            )

            sendResponse(res, 200, 'Statistiques récupérées avec succès', statsForMerchant);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des statistiques', [error.message]);
        }
    }

    async getCommissionStatistics(req: Request, res: Response) {
        const { startDate, endDate, type } = res.locals.pagination;
        try {
            const commissionStats = await statisticService.getSendoFeesStatistics(startDate, endDate, type as TypesTransaction | undefined);
            sendResponse(res, 200, 'Commissions récupérées avec succès', commissionStats);
        } catch (error: any) {
            sendError(res, 500, 'Erreur lors de la récupération des commissions', [error.message]);
        }
    }
}

export default new StatisticController();