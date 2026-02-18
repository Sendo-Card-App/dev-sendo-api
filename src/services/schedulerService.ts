import { addDays, addWeeks, addMonths, isBefore } from "date-fns";

import TontineModel from "@models/tontine.model";
import UserModel from "@models/user.model";

import tontineService from "./tontineService";
import transactionService from "./transactionService";
import cardService from "./cardService";
import neeroService from "./neeroService";
import FundSubscriptionService from "./fundSubscriptionService";
import notificationService from "./notificationService";
import { sendEmailWithHTML } from "./emailService";

import { typesNotification } from "@utils/constants";
import logger from "@config/logger";
import sequelize from "@config/db";

class SchedulerService {
    private neeroTransactionInterval: NodeJS.Timeout | null = null;
    private penaliteInterval: NodeJS.Timeout | null = null;
    private rappelInterval: NodeJS.Timeout | null = null;
    private onboardingSessionInterval: NodeJS.Timeout | null = null;

    /* ===============================
       TRANSACTIONS NEERO
    =============================== */
    startCheckTransactionsNeero() {
        if (this.neeroTransactionInterval) return;

        this.neeroTransactionInterval = setInterval(async () => {
            try {
                await transactionService.checkPendingTransactionsNeero();
            } catch (error: any) {
                logger.error("[SCHEDULER] Erreur check transactions Neero", error);
            }
        }, 2 * 60 * 1000);
    }

    /* ===============================
       PÉNALITÉS TONTINES
    =============================== */
    startPenaliteChecks() {
        if (this.penaliteInterval) return;

        this.penaliteInterval = setInterval(async () => {
            try {
                const penalites = await tontineService.checkUnpaidPenalite();

                for (const penalite of penalites) {
                    const user = penalite.membre?.user;
                    if (!user || !penalite.tontine) continue;

                    if (user.email) {
                        await sendEmailWithHTML(
                            user.email,
                            "Rappel paiement pénalité tontine SENDO",
                            `<h3>Rappel paiement pénalité tontine</h3>
                             <p>Cher ${user.firstname} ${user.lastname},</p>
                             <p>Veuillez régler la pénalité liée à la tontine <b>${penalite.tontine.nom}</b>.</p>
                             <p>Montant : <b>${penalite.montant} FCFA</b></p>`
                        );
                    }

                    const tokenExpo = await notificationService.getTokenExpo(user.id);
                    if (tokenExpo) {
                        await notificationService.save({
                            userId: user.id,
                            type: typesNotification["1"],
                            title: "Sendo",
                            content: `Veuillez régler la pénalité (${penalite.montant} FCFA) de la tontine ${penalite.tontine.nom}.`,
                            status: "SENDED",
                            token: tokenExpo.token
                        });
                    }
                }
            } catch (error: any) {
                logger.error("[SCHEDULER] Erreur pénalités", error);
            }
        }, 12 * 60 * 60 * 1000);
    }

    /* ===============================
       RAPPELS DE COTISATION
    =============================== */
    startRappelsCotisation() {
        if (this.rappelInterval) return;

        this.rappelInterval = setInterval(async () => {
            try {
                const tontines = await tontineService.getPendingFirstTours();
                const maintenant = new Date();

                for (const tontine of tontines) {
                    const prochainRappel = this.getNextReminderDate(tontine);
                    if (!prochainRappel || isBefore(maintenant, prochainRappel)) continue;

                    for (const membre of tontine.membres ?? []) {
                        const user = membre.user;
                        if (!user) continue;

                        if (user.email) {
                            await sendEmailWithHTML(
                                user.email,
                                `[${tontine.nom}] Rappel cotisation SENDO`,
                                this.genererContenuEmail(user, tontine)
                            );
                        }

                        const tokenExpo = await notificationService.getTokenExpo(user.id);
                        if (tokenExpo) {
                            await notificationService.save({
                                userId: user.id,
                                type: typesNotification["1"],
                                title: "Sendo",
                                content: `Bonjour ${user.firstname}, rappel de cotisation pour ${tontine.nom} (${tontine.montant} FCFA).`,
                                status: "SENDED",
                                token: tokenExpo.token
                            });
                        }
                    }

                    await tontine.update({ lastChecked: maintenant });
                }
            } catch (error: any) {
                logger.error("[SCHEDULER] Erreur rappels cotisation", error);
            }
        }, 12 * 60 * 60 * 1000);
    }

    /* ===============================
       ONBOARDING CARTES
    =============================== */
    startCheckPendingOnboardingSession() {
        if (this.onboardingSessionInterval) return;

        this.onboardingSessionInterval = setInterval(async () => {
            try {
                const sessions = await cardService.getPartySessionPending();

                for (const session of sessions) {
                    if (!session.sessionId || !session.user) continue;

                    const newSession = await neeroService.getOnboardingSession(session.sessionId);
                    if (newSession.onboardingSessionStatus !== "VERIFIED") continue;

                    await sendEmailWithHTML(
                        session.user.email ?? "",
                        "Documents KYC validés",
                        `<h3>Bonjour ${session.user.firstname},</h3>
                         <p>Vos documents KYC ont été validés. Vous pouvez créer votre carte virtuelle SENDO.</p>`
                    );

                    const tokenExpo = await notificationService.getTokenExpo(session.user.id);
                    if (tokenExpo) {
                        await notificationService.save({
                            userId: session.user.id,
                            type: typesNotification["1"],
                            title: "Sendo",
                            content: "Vos documents KYC ont été validés.",
                            status: "SENDED",
                            token: tokenExpo.token
                        });
                    }
                }
            } catch (error: any) {
                logger.error("[SCHEDULER] Erreur onboarding cartes", error);
            }
        }, 4 * 60 * 60 * 1000);
    }

    /* ===============================
       CRON ANNUEL (ISOLÉ)
    =============================== */
    async startAnnualFundMaturity() {
        await sequelize.authenticate();

        logger.info("[CRON] Maturation annuelle des fonds");

        try {
            await FundSubscriptionService.matureSubscriptions();
            logger.info("[CRON] Maturation terminée");
        } catch (error: any) {
            logger.error("[CRON] Erreur maturation fonds", error);
        }
    }

    /* ===============================
       UTILS
    =============================== */
    private genererContenuEmail(user: UserModel, tontine: TontineModel) {
        return `<h3>Bonjour ${user.firstname},</h3>
                <p>Rappel de cotisation pour la tontine <strong>${tontine.nom}</strong>.</p>
                <p>Montant : <strong>${tontine.montant} FCFA</strong></p>
                <p>Prochaine échéance : ${this.getNextReminderDate(tontine)?.toLocaleDateString()}</p>`;
    }

    private getNextReminderDate(tontine: TontineModel): Date | null {
        const baseDate = tontine.lastChecked || new Date();

        switch (tontine.frequence?.toUpperCase()) {
            case "DAILY":
                return addDays(baseDate, 1);
            case "WEEKLY":
                return addWeeks(baseDate, 1);
            case "MONTHLY":
                return addMonths(baseDate, 1);
            default:
                return null;
        }
    }

    stop() {
        [
            this.neeroTransactionInterval,
            this.penaliteInterval,
            this.rappelInterval,
            this.onboardingSessionInterval
        ].forEach(interval => interval && clearInterval(interval));
    }
}

export default new SchedulerService();