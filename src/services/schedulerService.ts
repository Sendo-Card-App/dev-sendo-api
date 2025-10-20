import TontineModel from "@models/tontine.model";
import { sendEmailWithHTML } from "./emailService";
import tontineService from "./tontineService";
import transactionService from "./transactionService";
import { addDays, addWeeks, addMonths, isBefore } from 'date-fns';
import UserModel from "@models/user.model";
import cardService from "./cardService";
import neeroService from "./neeroService";
import notificationService from "./notificationService";
import { typesNotification } from "@utils/constants";

class SchedulerService {
    private smobilpayTransactionInterval: NodeJS.Timeout | null = null;
    private neeroTransactionInterval: NodeJS.Timeout | null = null;
    private penaliteInterval: NodeJS.Timeout | null = null;
    private rappelInterval: NodeJS.Timeout | null = null;
    private onboardingSessionInterval: NodeJS.Timeout | null = null;

    /*startCheckTransactionsSmobilpay() {
        if (this.smobilpayTransactionInterval) {
            clearInterval(this.smobilpayTransactionInterval);
        }

        this.smobilpayTransactionInterval = setInterval(() => {
            transactionService.checkPendingTransactionsSmobilpay()
        }, 2 * 60 * 1000); // Toutes les 2 minutes
    }*/

    startCheckTransactionsNeero() {
        if (this.neeroTransactionInterval) {
            clearInterval(this.neeroTransactionInterval);
        }

        this.neeroTransactionInterval = setInterval(() => {
            transactionService.checkPendingTransactionsNeero()
        }, 2 * 60 * 1000); // Toutes les 2 minutes
    }

    startPenaliteChecks() {
        if (this.penaliteInterval) {
            clearInterval(this.penaliteInterval);
        }

        this.penaliteInterval = setInterval(async() => {
            const penalites = await tontineService.checkUnpaidPenalite()
            for (const penalite of penalites) {
                const email = penalite.membre?.user?.email;
                const tokenExpo = await notificationService.getTokenExpo(penalite.membre?.user?.id ?? 0);
                if (email && penalite.tontine) {
                    await sendEmailWithHTML(
                        email,
                        'Rappel paiement pénalité tontine SENDO',
                        `<h3>Rappel paiement pénalité tontine</h3>
                        <p>Cher ${penalite.membre?.user?.firstname+' '+penalite.membre?.user?.lastname}, 
                        veuillez effectuer le paiement de la pénalité créée sur la tontine <b>${penalite.tontine.nom}</b></p>
                        <p>Le paiement s'élève à <b>${penalite.montant} FCFA</b></p>`
                    );
                }
                await notificationService.save({
                    userId: penalite.membre?.user?.id ?? 0,
                    type: typesNotification['1'],
                    title: 'Sendo',
                    content: `Cher ${penalite.membre?.user?.firstname+' '+penalite.membre?.user?.lastname}, veuillez effectuer le paiement de la pénalité créée sur la tontine ${penalite?.tontine?.nom}. Le paiement s'élève à ${penalite.montant} FCFA</p>`,
                    status: 'SENDED',
                    token: tokenExpo?.token ?? ''
                });
            }
        }, 12 * 60 * 60 * 1000); //Toutes les 12 heures
    }

    startRappelsCotisation() {
        this.rappelInterval = setInterval(async () => {
            const tontines = await tontineService.getPendingFirstTours();
            
            for (const tontine of tontines) {
                const frequence = tontine.frequence.toLowerCase();
                const maintenant = new Date();
                let prochainRappel: Date;

                // Détermine l'intervalle selon la fréquence
                switch(frequence) {
                    case 'DAILY':
                        prochainRappel = addDays(tontine.lastChecked || new Date(), 1);
                        break;
                    case 'WEEKLY':
                        prochainRappel = addWeeks(tontine.lastChecked || new Date(), 1);
                        break;
                    case 'MONTHLY':
                        prochainRappel = addMonths(tontine.lastChecked || new Date(), 1);
                        break;
                    default:
                        continue;
                }

                // Vérifie si le rappel est dû
                if (isBefore(maintenant, prochainRappel)) continue;

                // Envoi des emails
                if (tontine.membres) {
                    for (const membre of tontine.membres) {
                        if (membre.user?.email) {
                            await sendEmailWithHTML(
                                membre.user.email,
                                `[${tontine.nom}] Rappel cotisation SENDO`,
                                this.genererContenuEmail(membre.user, tontine)
                            );
                        }
                        const tokenExpo = await notificationService.getTokenExpo(membre?.user?.id ?? 0);
                        await notificationService.save({
                            userId: membre?.user?.id ?? 0,
                            type: typesNotification['1'],
                            title: `Sendo`,
                            content: `Bonjour ${membre?.user?.firstname}, n'oubliez pas votre cotisation pour la tontine ${tontine.nom}. Le montant à verser est de ${tontine.montant} FCFA et la prochaine échéance : ${this.getNextDate(tontine)}`,
                            status: 'SENDED',
                            token: tokenExpo?.token ?? ''
                        });
                    }
                }

                // Met à jour la date du dernier rappel
                await tontine.update({ lastChecked: maintenant });
            }
        }, 12 * 60 * 60 * 1000); // Vérifie toutes les 12 heures
    }

    startCheckPendingOnboardingSession() {
        this.onboardingSessionInterval = setInterval(async () => {
            const sessions = await cardService.getPartySessionPending();
            
            for (const session of sessions) {
                const newSession = await neeroService.getOnboardingSession(session.sessionId ?? '')
                if (newSession.onboardingSessionStatus === 'VERIFIED') {
                    await sendEmailWithHTML(
                        session.user?.email ?? '',
                        'Documents KYC pour création de carte validés',
                        `<h3>Bonjour ${session.user?.firstname},</h3>
                        <p>Vos documents KYC pour la création de votre carte virtuelle ont été validés.</p>
                        <p>Vous pouvez maintenant créer votre première carte virtuelle SENDO</p>`
                    )
                    const tokenExpo = await notificationService.getTokenExpo(session.user?.id ?? 0);
                    await notificationService.save({
                        userId: session.user?.id ?? 0,
                        type: typesNotification['1'],
                        title: 'Sendo',
                        content: `Bonjour ${session.user?.firstname}, vos documents KYC pour la création de votre carte virtuelle ont été validés. Vous pouvez maintenant créer votre première carte virtuelle SENDO`,
                        status: 'SENDED',
                        token: tokenExpo?.token ?? ''
                    });
                }
            }
        }, 4 * 60 * 60 * 1000); // Vérifie toutes les 4 heures
    }

    private genererContenuEmail(user: UserModel, tontine: TontineModel) {
        return `<h3>Bonjour ${user.firstname},</h3>
              <p>N'oubliez pas votre cotisation pour la tontine <strong>${tontine.nom}</strong> !</p>
              <p>Montant à verser : <strong>${tontine.montant} FCFA</strong></p>
              <p>Prochaine échéance : ${this.getNextDate(tontine)}</p>`;
    }

    private getNextDate(tontine: TontineModel) {
        const derniereDate = tontine.lastChecked || new Date();
        switch(tontine.frequence.toLowerCase()) {
            case 'DAILY': return addDays(derniereDate, 1).toLocaleDateString();
            case 'WEEKLY': return addWeeks(derniereDate, 1).toLocaleDateString();
            case 'MONTHLY': return addMonths(derniereDate, 1).toLocaleDateString();
            default: return '';
        }
    }

    stop() {
        [
            this.smobilpayTransactionInterval, 
            this.neeroTransactionInterval, 
            this.penaliteInterval, 
            this.rappelInterval,
            this.onboardingSessionInterval
        ].forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }
}

export default new SchedulerService();
