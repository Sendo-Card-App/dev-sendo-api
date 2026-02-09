import FundSubscriptionModel from "@models/fund-subscription.model";
import FundModel from "@models/fund.model";
import WithdrawalFundRequestModel from "@models/withdrawal-fund-request.model";
import { Op } from "sequelize";
import walletService from "./walletService";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";
import transactionService from "./transactionService";
import userService from "./userService";
import sequelize from "@config/db";
import notificationService from "./notificationService";
import { sendEmailWithHTML } from "./emailService";


export default class FundSubscriptionService {
    static async getAllFunds(
        limit: number,
        startIndex: number
    ) {
        return FundModel.findAndCountAll({
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']]
        });
    }

    static async getFundById(id: string) {
        const fund = await FundModel.findByPk(id);
        if (!fund) throw new Error("Fonds introuvable");
        return fund;
    }

    static checkSubscriptionPeriod(date: Date) {
        const month = date.getMonth() + 1;
        if (month < 1 || month > 6) {
            throw new Error("Période de souscription expirée");
        }
    }

    static calculateProratedCommission(
        annualCommission: number,
        investmentDate: Date
    ): number {
        const month = investmentDate.getMonth() + 1;
        const monthsRemaining = 12 - (month - 1);
        const commission = annualCommission * (monthsRemaining / 12);
        return Number(commission.toFixed(2));
    }

    static async getUserTotal(userId: number, currency: "XAF" | "CAD") {
        const total = await FundSubscriptionModel.sum("amount", {
            where: { 
                userId, 
                currency,
                status: "ACTIVE"
            },
        });
        return total || 0;
    }

    static async validateLimits(
        userId: number,
        currency: "XAF" | "CAD",
        amount: number
    ) {
        const total = await this.getUserTotal(userId, currency);

        if (currency === "XAF" && (total + amount) > 1000000)
            throw new Error("Plafond XAF dépassé");

        if (currency === "CAD" && (total + amount) > 1000)
            throw new Error("Plafond CAD dépassé");
    }

    static async subscribe(
        userId: number,
        fundId: string,
        currency: "XAF" | "CAD"
    ) {
        const fund = await FundModel.findByPk(fundId);
        if (!fund) throw new Error("Fonds introuvable");

        const amount = currency === "XAF" ? fund.amountXAF : fund.amountCAD;

        const user = await userService.getUserById(userId)
        if (!user) throw new Error("Utilisateur introuvable")
        if (Number(user.wallet!.balance) < amount) throw new Error("Solde insuffisant")

        const now = new Date();
        this.checkSubscriptionPeriod(now);
        await this.validateLimits(userId, currency, amount);

        const commissionRate = this.calculateProratedCommission(
            fund.annualCommission,
            now
        );
        
        const endDate = new Date(now.getFullYear(), 11, 31);

        const transactionCreated = await transactionService.createTransaction({
            userId: user.id,
            type: "FUND_SUBSCRIPTION",
            amount,
            totalAmount: amount,
            currency,
            receiverId: user.id,
            receiverType: 'User',
            method: 'WALLET',
            provider: 'WALLET',
            status: 'COMPLETED',
            description: `Souscription : #${fund.name}`
        })

        await walletService.debitWallet(
            user.wallet!.matricule,
            amount,
            `Souscription : #${fund.name}`,
            user.id,
            transactionCreated.id
        )

        const token = await userService.getTokenExpoUser(user.id)
        await notificationService.save({
            userId: user.id,
            token: token.token,
            status: 'SENDED',
            type: 'INFORMATION',
            title: "Sendo",
            content: `Félicitations ${user.firstname} ! Votre investissement vient d'être enregistré, vous recevrez vos intérêtes le 1er janvier prochain`
        })

        await sendEmailWithHTML(
            user.email,
            "Sendo investissement",
            `<p>Félicitations ${user.firstname} ! Votre investissement vient d'être enregistré, vous recevrez vos intérêtes le 1er janvier prochain</p>`
        )

        return FundSubscriptionModel.create({
            userId,
            fundId,
            currency,
            amount,
            commissionRate,
            startDate: now,
            endDate
        });
    }

    static async getAllSubscriptions(
        limit: number,
        startIndex: number,
        status?: 'ACTIVE' | 'MATURED' | 'CLOSED',
        userId?: number,
        currency?: "XAF" | "CAD"
    ) {
        const where: Record<string, any> = {};
        if (status) where.status = status;
        if (userId) where.userId = userId;
        if (currency) where.currency = currency;

        return FundSubscriptionModel.findAndCountAll({
            where,
            offset: startIndex,
            limit,
            order: [['createdAt', 'DESC']],
            include: [{
                model: FundModel,
                as: 'fund'
            }],
        });
    }

    // A exécuter le 1er janvier de chaque année
    static async matureSubscriptions() {
        const today = new Date();

        const subscriptions = await FundSubscriptionModel.findAll({
            where: {
                status: "ACTIVE",
                endDate: { [Op.lte]: today },
            }
        });

        for (const sub of subscriptions) {
            const interest =
                sub.amount * (sub.commissionRate / 100);

            sub.interestAmount = Number(interest.toFixed(2));
            sub.status = "MATURED";
            await sub.save();
        }
    }

    static async requestWithdrawal(
        userId: number,
        subscriptionId: string,
        type: "INTEREST_ONLY" | "FULL_WITHDRAWAL"
    ) {
        const sub = await FundSubscriptionModel.findByPk(subscriptionId, {
            include: [{
                model: UserModel,
                as: 'user'
            }] 
        });

        if (!sub) throw new Error("Souscription invalide");
        if (sub.userId !== userId) throw new Error("Souscription invalide");
        if (sub.status !== "MATURED") throw new Error("Fonds non disponibles");

        const token = await userService.getTokenExpoUser(userId)
        await notificationService.save({
            userId,
            token: token.token,
            status: 'SENDED',
            type: 'INFORMATION',
            title: "Sendo",
            content: "Votre demande de retrait a bien été enregistrée."
        })

        await sendEmailWithHTML(
            sub.user!.email,
            "Sendo investissement",
            `<p>${sub.user!.firstname} Votre demande de retrait a bien été enregistrée.</p>`
        )

        return WithdrawalFundRequestModel.create({
            userId,
            subscriptionId,
            type,
        });
    }

    static async processRequest(
        requestId: string,
        action: "APPROVED" | "REJECTED",
        adminId: number
    ) {
        const request = await WithdrawalFundRequestModel.findByPk(requestId, {
            include: [
                {
                    model: FundSubscriptionModel,
                    as: 'fundSubscription',
                    include: [{
                        model: FundModel,
                        as: 'fund'
                    }]
                },
                {
                    model: UserModel,
                    as: 'user',
                    include: [{
                        model: WalletModel,
                        as: 'wallet'
                    }]
                }
            ],
        });

        if (!request) throw new Error("Demande introuvable");

        request.status = action;
        request.processedAt = new Date();

        if (action === "APPROVED") {
            const sub = request.fundSubscription;

            if (sub && request.type === "FULL_WITHDRAWAL") {
                // On retourne le capital investi
                const transactionCapital = await transactionService.createTransaction({
                    userId: request!.user!.id,
                    type: "FUND_SUBSCRIPTION",
                    method: 'WALLET',
                    status: "COMPLETED",
                    receiverId: request!.user!.id,
                    receiverType: "User",
                    amount: sub.amount,
                    totalAmount: sub.amount,
                    currency: request.fundSubscription!.currency,
                    description: `Capital d'investissement : ${request.fundSubscription?.fund?.name}`,
                })
                await walletService.creditWallet(
                    request.user!.wallet!.matricule,
                    sub.amount,
                    "Déblocage capital d'investissement",
                    adminId,
                    transactionCapital.id
                )

                // On retourne les intérêts
                const transactionInterest = await transactionService.createTransaction({
                    userId: request!.user!.id,
                    type: "FUND_SUBSCRIPTION",
                    method: 'WALLET',
                    status: "COMPLETED",
                    receiverId: request!.user!.id,
                    receiverType: "User",
                    amount: sub.interestAmount,
                    totalAmount: sub.interestAmount,
                    currency: request.fundSubscription!.currency,
                    description: `Intérêts d'investissement : ${request.fundSubscription?.fund?.name}`,
                })
                await walletService.creditWallet(
                    request.user!.wallet!.matricule,
                    sub.interestAmount,
                    `Intérêts d'investissement : ${request.fundSubscription?.fund?.name}`,
                    adminId,
                    transactionInterest.id
                )

                const token = await userService.getTokenExpoUser(request.user!.id)
                await notificationService.save({
                    userId: request.user!.id,
                    token: token.token,
                    status: 'SENDED',
                    type: 'INFORMATION',
                    title: "Sendo",
                    content: `Un montant total de ${sub.interestAmount + sub.amount} ${sub.currency} vient d'être versé sur votre portefeuille.`
                })

                await sendEmailWithHTML(
                    sub.user!.email,
                    "Sendo investissement",
                    `<p>Un montant total de ${sub.interestAmount + sub.amount} ${sub.currency} vient d'être versé sur votre portefeuille. Ceci représente votre capital investi plus les intérêts générés au cours de l'année précédente.</p>`
                )

                sub.status = "CLOSED";
            } else if (sub && request.type === "INTEREST_ONLY") {
                // On retourne les intérêts
                const transactionInterest = await transactionService.createTransaction({
                    userId: request!.user!.id,
                    type: "FUND_SUBSCRIPTION",
                    method: 'WALLET',
                    status: "COMPLETED",
                    receiverId: request!.user!.id,
                    receiverType: "User",
                    amount: sub.interestAmount,
                    totalAmount: sub.interestAmount,
                    currency: request.fundSubscription!.currency,
                    description: `Intérêts d'investissement : ${request.fundSubscription?.fund?.name}`,
                })
                await walletService.creditWallet(
                    request.user!.wallet!.matricule,
                    sub.interestAmount,
                    `Intérêts d'investissement : ${request.fundSubscription?.fund?.name}`,
                    adminId,
                    transactionInterest.id
                )

                // Et on créé un nouvel investissement
                const now = new Date()
                const endDate = new Date(now.getFullYear(), 11, 31);
                await FundSubscriptionModel.create({
                    userId: sub.userId,
                    fundId: sub.fundId,
                    currency: sub.currency,
                    amount: sub.amount,
                    commissionRate: sub.commissionRate,
                    startDate: now,
                    endDate
                });

                const token = await userService.getTokenExpoUser(request.user!.id)
                await notificationService.save({
                    userId: request.user!.id,
                    token: token.token,
                    status: 'SENDED',
                    type: 'INFORMATION',
                    title: "Sendo",
                    content: `Un montant total de ${sub.interestAmount} ${sub.currency} vient d'être versé sur votre portefeuille.`
                })

                await sendEmailWithHTML(
                    sub.user!.email,
                    "Sendo investissement",
                    `<p>Un montant total de ${sub.interestAmount + sub.amount} ${sub.currency} vient d'être versé sur votre portefeuille. Ceci représente les intérêts générés au cours de l'année précédente.</p>`
                )

                sub.status = "CLOSED";
            }

            if (sub) await sub.save();
        }

        if (action === "REJECTED") {
            const token = await userService.getTokenExpoUser(request.user!.id)
            await notificationService.save({
                userId: request.user!.id,
                token: token.token,
                status: 'SENDED',
                type: 'INFORMATION',
                title: "Sendo",
                content: `Votre demande de retrait sur le service Sendo Investissement vient d'être rejetée`
            })

            await sendEmailWithHTML(
                request.user!.email,
                "Sendo investissement",
                `<p>${request.user!.firstname}, votre demande de retrait sur le service <b>Sendo Investissement</b> vient d'être rejetée</p>`
            )
        }

        await request.save();
        return request;
    }
}