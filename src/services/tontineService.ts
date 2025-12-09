// services/tontine.service.ts
import { literal, Op, Transaction } from 'sequelize';
import TontineModel from '@models/tontine.model';
import MembreTontineModel from '@models/membre-tontine.model';
import PenaliteModel from '@models/penalite.model';
import CotisationModel from '@models/cotisation.model';
import TourDeDistributionModel from '@models/tour-distribution.model';
import CompteSequestreModel from'@models/compte-sequestre.model';
import UserModel from '@models/user.model';
import WalletModel from '@models/wallet.model';
import walletService from './walletService';
import { TransactionCreate } from '../types/Transaction';
import transactionService from './transactionService';
import configService from './configService';
import notificationService from './notificationService';
import { sendEmailWithHTML } from './emailService';
import { typesMethodTransaction, typesTransaction } from '@utils/constants';
import sequelize from '@config/db';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

class TontineService {
    async createTontine(data: {
        nom: string;
        type: 'FIXE' | 'ALEATOIRE' | 'VOTE';
        frequence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
        montant: number;
        createurId: number;
        modeVersement: 'AUTOMATIC' | 'MANUAL';
        description?: string
    }) {
        return sequelize.transaction(async (t: Transaction) => {
            const tontine = await TontineModel.create({
                ...data,
                nombreMembres: 1,
                etat: 'ACTIVE'
            }, { transaction: t });

            const admin = await MembreTontineModel.create({
                tontineId: tontine.id,
                userId: data.createurId,
                role: 'ADMIN',
                etat: 'ACTIVE'
            }, { 
                transaction: t,
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['firstname', 'lastname', 'email']
                }]
            });

            await CompteSequestreModel.create({
                tontineId: tontine.id,
                responsableGestionId: admin.id,
                soldeActuel: 0,
                etatCompte: 'ACTIVE',
                montantBloque: 0
            }, { transaction: t });

            if (admin.user?.email) {
                await sendEmailWithHTML(
                    admin.user?.email,
                    'Création tontine sur Sendo',
                    `<h3>Création tontine sur Sendo</h3>
                    <p>La création de votre tontine <b>${tontine.nom}</b> sur Sendo a été un succès</p>`
                )
            }

            // Sauvegarder la notification dans ta base
            const tokenExpo = await notificationService.getTokenExpo(admin?.user?.id ?? 0)
            if (tokenExpo) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${admin.user?.firstname} vous venez de créer la tontine ${tontine.nom} sur Sendo`,
                    userId: admin?.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpo.token,
                    type: 'TONTINE'
                }); 
            }

            return { tontine, admin };
        });
    }

    async ajouterMembre(tontineId: number, userId: number) {
        const tontine = await TontineModel.findByPk(tontineId);
        if (!tontine) throw new Error('Tontine introuvable');

        const user = await UserModel.findByPk(userId);
        if (!user) throw new Error('Utilisateur introuvable')

        const membre = await MembreTontineModel.create({
            tontineId,
            userId,
            role: 'MEMBER',
            etat: 'PENDING'
        });
        const membreSaved = await UserModel.findByPk(membre.userId)

        const admin = await MembreTontineModel.findOne({
            where: {
                tontineId,
                role: 'ADMIN'
            }
        })
        const adminSaved = await UserModel.findByPk(admin?.userId)

        // Envoyer un email à l'utilisateur invité
        if (membreSaved?.email && adminSaved) {
            await sendEmailWithHTML(
                membreSaved?.email,
                'Invitation à la tontine Sendo',
                `<h3>Invitation tontine Sendo</h3>
                <p>${membreSaved.firstname}, vous avez été invité par <b>${adminSaved.firstname} ${adminSaved.lastname}</b>
                    à rejoindre la tontine <b>${tontine.nom}</b>. Montant ${tontine.frequence} ${tontine.montant} XAF.</p>
                <p>Veuillez utiliser ce code d'invitation pour accéder à la tontine dans l'application : <b>${tontine.invitationCode}</b></p>`
            )
        }
        
        // Sauvegarder la notification dans ta base
        const tokenExpo = await notificationService.getTokenExpo(membreSaved?.id ?? 0)
        if (tokenExpo && adminSaved) {
            await notificationService.save({
                title: 'Sendo',
                content: `Vous avez été invité par ${adminSaved?.firstname} ${adminSaved?.lastname} à rejoindre la tontine ${tontine.nom}. Montant ${tontine.frequence} ${tontine.montant} XAF. Veuillez utiliser ce code d'invitation pour accéder à la tontine dans l'application : ${tontine.invitationCode}`,
                userId: adminSaved?.id ?? 0,
                status: 'SENDED',
                token: tokenExpo.token,
                type: 'TONTINE'
            }); 
        }
        
        return { tontine, admin, membre }
    }

    async accederTontine(memberId: number, type: 'JOIN' | 'REJECT' = 'JOIN', invitationCode?: string) {
        let tontine: TontineModel | null = null;
        const membre = await MembreTontineModel.findOne({
            where: { 
                //tontineId: tontine.id,
                id: memberId
            },
            include: [
                {
                    model: TontineModel,
                    as: 'tontine'
                },
                {
                    model: UserModel,
                    as: 'user',
                    attributes: ['email', 'firstname', 'lastname']
                }
            ]
        })

        if (invitationCode && type === 'JOIN') {
            tontine = await TontineModel.findOne({
                where: { invitationCode },
                include: [{
                    model: MembreTontineModel,
                    where: { role: 'ADMIN' },
                    as: 'admin',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id','email', 'firstname', 'lastname']
                    }]
                }]
            })
            if (tontine) {
                tontine.nombreMembres = tontine.nombreMembres + 1
                await tontine.save();
            }
        } else {
            tontine = await TontineModel.findOne({
                where: { invitationCode: membre?.tontine?.invitationCode },
                include: [{
                    model: MembreTontineModel,
                    where: { role: 'ADMIN' },
                    as: 'admin',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id','email', 'firstname', 'lastname']
                    }]
                }]
            })
        }

        if (!tontine) throw new Error('Tontine introuvable');
        if (!membre) throw new Error('Membre introuvable');

        if (membre.etat === 'ACTIVE') throw new Error("Vous êtes déjà dans la tontine")
        if (membre.etat === 'EXCLUDED' || membre.etat === 'SUSPENDED') 
            throw new Error("Vous avez été suspendu ou exclu de la tontine")

        if (type === 'JOIN') membre.etat = 'ACTIVE'
        else if (type === 'REJECT') membre.etat = 'REJECTED'
        
        await membre.save();

        // Envoyer une notification au membre de la tontine
        const tokenExpoMembre = await notificationService.getTokenExpo(membre?.user?.id ?? 0)
        if (tokenExpoMembre) {
            await notificationService.save({
                title: 'Sendo',
                content: `${membre.user?.firstname} ${membre.user?.lastname} votre adhésion à la tontine ${tontine.nom} a été confirmée.`,
                userId: membre?.user?.id ?? 0,
                status: 'SENDED',
                token: tokenExpoMembre.token,
                type: 'TONTINE'
            }); 
        }

        // Envoyer une notification à l'admin de la tontine
        const tokenExpoAdmin = await notificationService.getTokenExpo(tontine.admin?.user?.id ?? 0)
        if (tokenExpoAdmin && tontine.admin) {
            await notificationService.save({
                title: 'Sendo',
                content: `${membre.user?.firstname} ${membre.user?.lastname} vient d'accéder à votre tontine ${tontine.nom} sur Sendo`,
                userId: tontine.admin?.user?.id ?? 0,
                status: 'SENDED',
                token: tokenExpoAdmin.token,
                type: 'TONTINE'
            }); 
        }

        const newMembre = await MembreTontineModel.findOne({
            where: { 
                tontineId: tontine.id,
                id: memberId
            },
            include: [{
                model: UserModel,
                as: 'user',
                attributes: ['email', 'firstname', 'lastname']
            }]
        })

        if (membre?.user?.email) {
            if (membre.etat === 'ACTIVE') {
                await sendEmailWithHTML(
                    membre.user.email,
                    'Réponse invitation tontine Sendo',
                    `<p>Vous venez d'accéder à la tontine <b>${tontine?.nom}</b> sur Sendo</p>`
                )
            } else if (membre.etat === 'REJECTED') {
                await sendEmailWithHTML(
                    membre.user.email,
                    'Réponse invitation tontine Sendo',
                    `<p>Vous venez de refuser d'accéder à la tontine <b>${tontine?.nom}</b> sur Sendo</p>`
                )
            }
        }
        
        if (membre && tontine.admin?.user?.email) {
            if (membre.etat === 'ACTIVE') {
                await sendEmailWithHTML(
                    tontine.admin.user.email,
                    'Réponse invitation tontine Sendo',
                    `<p><b>${membre.user?.firstname} ${membre.user?.lastname}</b> 
                    vient d'accéder à votre tontine <b>${tontine.nom}</b> sur Sendo</p>`
                )
            } else if (membre.etat === 'REJECTED') {
                await sendEmailWithHTML(
                    tontine.admin.user.email,
                    'Réponse invitation tontine Sendo',
                    `<p><b>${membre.user?.firstname} ${membre.user?.lastname}</b> 
                    vient de refuser d'accéder à votre tontine <b>${tontine.nom}</b> sur Sendo</p>`
                )
            }
        }

        return {
            membre: newMembre,
            tontine
        }
    }

    async payerCotisation(data: {
        tontineId: number;
        membreId: number;
        cotisationId: number
    }) {
        const tontine = await TontineModel.findByPk(data.tontineId, {
            include: [{
                model: MembreTontineModel,
                where: { role: 'ADMIN' },
                as: 'admin',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['email', 'firstname', 'lastname', 'id']
                }]
            }]
        })

        return sequelize.transaction(async (t: Transaction) => {
            // 0. On vérifie si la tontine est active
            if (tontine?.etat !== 'ACTIVE') {
                throw new Error("Tontine bloquée ou suspendue")
            }

            // 1. Vérifier que le membre appartient bien à la tontine
            const membre = await MembreTontineModel.findOne({
                where: {
                    id: data.membreId,
                    tontineId: data.tontineId
                },
                transaction: t
            });

            if (!membre) {
                throw new Error("Le membre spécifié n'appartient pas à la tontine");
            }

            // 3. Chargement complet avec associations nécessaires
            const cotisationComplete = await CotisationModel.findByPk(data.cotisationId, {
                include: [{
                    model: MembreTontineModel,
                    as: 'membre',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'firstname', 'lastname', 'email'],
                            include: [{
                                model: WalletModel,
                                as: 'wallet',
                                attributes: ['matricule', 'balance', 'userId'],
                            }]
                        }
                    ]
                }],
                transaction: t
            });

            if (!cotisationComplete) {
                throw new Error("Cotisation introuvable");
            }

            if (cotisationComplete.statutPaiement === 'VALIDATED') {
                throw new Error("Cette cotisation a déjà été payée");
            }

            const walletPayeur = cotisationComplete.membre?.user?.wallet;
            if (!walletPayeur?.matricule) {
                throw new Error("Matricule du wallet du payeur introuvable");
            }

            // 4. Débit du wallet
            const config = await configService.getConfigByName("TONTINE_FEES_TRANSACTION")
            if (!config) {
                throw new Error("Configuration introuvable")
            }
            const amountWallet = cotisationComplete.montant * (1 + config.value / 100)
            await walletService.debitWallet(walletPayeur.matricule, amountWallet, 'Paiement tontine');

            // 5. Création de la transaction financière
            const transaction: TransactionCreate = {
                amount: cotisationComplete.montant,
                userId: cotisationComplete.membre?.user?.id ?? 0,
                type: 'TONTINE_PAYMENT',
                status: 'COMPLETED',
                totalAmount: amountWallet,
                currency: 'XAF',
                sendoFees: amountWallet - cotisationComplete.montant,
                provider: typesMethodTransaction['3'],
                receiverId: cotisationComplete.membre?.user?.id ?? 0,
                receiverType: 'User',
                method: typesMethodTransaction['3'],
                description: `Cotisation tontine #${data.tontineId}`
            };
            await transactionService.createTransaction(transaction, { transaction: t});

            // 6. Mise à jour du statut de la cotisation
            cotisationComplete.statutPaiement = 'VALIDATED';
            await cotisationComplete.save({ transaction: t });

            // 7. Incrément du solde du compte séquestre
            await CompteSequestreModel.increment('soldeActuel', {
                by: cotisationComplete.montant,
                where: { tontineId: data.tontineId },
                transaction: t
            });

            //On notifie l'admin de la tontine
            const emailAdmin = tontine.admin?.user?.email;
            if (emailAdmin) {
                await sendEmailWithHTML(
                    emailAdmin,
                    'Paiement cotisation sur Sendo',
                    `<h3>Paiement cotisation</h3>
                    <p>Cher administrateur d'une tontine Sendo, 
                    <b>${cotisationComplete.membre?.user?.firstname+' '+cotisationComplete.membre?.user?.lastname}</b> vient d'effectuer
                        un paiement de cotisation de <b>${cotisationComplete.montant} FCFA</b> 
                    sur la tontine <b>${tontine.nom}</b>`
                );
            }
            const emailMembre = cotisationComplete.membre?.user?.email;
            if (emailMembre) {
                await sendEmailWithHTML(
                    emailMembre,
                    'Paiement cotisation sur Sendo',
                    `<h3>Paiement cotisation</h3>
                    <p>Cher utilisateur Sendo, vous venez d'effectuer un paiement de cotisation de <b>${cotisationComplete.montant} FCFA</b> 
                    sur la tontine <b>${tontine.nom}</b>`
                );
            }

            //Envoyer une notification à l'admin de la tontine
            const tokenExpoAdmin = await notificationService.getTokenExpo(tontine.admin?.user?.id ?? 0)
            if (tokenExpoAdmin && tontine.admin && cotisationComplete.membre) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `Cher administrateur de la tontine ${tontine.nom}, ${cotisationComplete.membre.user?.firstname} ${cotisationComplete.membre.user?.lastname} vient d'effectuer un paiement de cotisation de ${cotisationComplete.montant} FCFA`,
                    userId: tontine.admin?.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpoAdmin.token,
                    type: 'TONTINE'
                }); 
            } 

            //Envoyer une notification au cotiseur de la tontine
            const tokenExpoMembre = await notificationService.getTokenExpo(cotisationComplete.membre?.user?.id ?? 0)
            if (tokenExpoMembre && tontine.admin && cotisationComplete.membre) {
                await notificationService.save({
                    title: 'Sendo',
                    content: `${cotisationComplete.membre?.user?.firstname}, vous venez d'effectuer un paiement de cotisation de ${cotisationComplete.montant} FCFA sur la tontine ${tontine.nom}`,
                    userId: cotisationComplete.membre?.user?.id ?? 0,
                    status: 'SENDED',
                    token: tokenExpoMembre.token,
                    type: 'TONTINE'
                }); 
            }

            return {
                cotisation: cotisationComplete,
                tontine
            };
        });
    }

    async effectuerDistribution(tontineId: number) {
        return sequelize.transaction(async (t: Transaction) => {
            // 1. Charger la tontine active avec son compte séquestre
            const tontine = await TontineModel.findOne({
                where: { 
                    id: tontineId,
                    etat: 'ACTIVE' 
                },
                include: [
                    {
                        model: CompteSequestreModel,
                        as: 'compteSequestre'
                    },
                    {
                        model: MembreTontineModel,
                        as: 'membres',
                        include: [{
                            model: UserModel,
                            as: 'user',
                            attributes: ['email', 'firstname', 'lastname']
                        }]
                    }
                ],
                transaction: t,
                //lock: t.LOCK.UPDATE
            });

            if (!tontine) {
                throw new Error('Tontine non disponible ou inactive');
            }

            // 2. Récupérer le premier tour de distribution en attente (pending)
            const tourEnAttente = await TourDeDistributionModel.findOne({
                where: {
                    tontineId,
                    etat: 'PENDING'
                },
                order: [['numeroDistribution', 'ASC']],
                transaction: t,
                //lock: t.LOCK.UPDATE
            });

            if (!tourEnAttente) {
                throw new Error('Aucun tour de distribution en attente pour cette tontine');
            }

            // 3. Récupérer les cotisations validées pour ce tour
            const cotisations = await CotisationModel.findAll({
                where: {
                    tontineId,
                    statutPaiement: 'VALIDATED',
                    tourDistributionId: tourEnAttente.id
                },
                transaction: t
            });
            if (cotisations.length === 0) {
                throw new Error("Personne n'a cotisé dans ce tour de distribution")
            }

            // 4. Vérifier que tous les membres actifs ont cotisé
            /*const membresSansCotisation = cotisations.filter(c => c.statutPaiement !== 'VALIDATED').map(c => c.membreId)

            if (cotisations.length > 0) {
                const nomsMembres = membresSansCotisation.map(m => `membreId:${m}`).join(', ');
                throw new Error(`Distribution impossible : les membres suivants n'ont pas cotisé : ${nomsMembres}`);
            }*/

            //const montantTotal = tontine.compteSequestre?.soldeActuel || 0;
            const montantTotal = cotisations.length * tontine.montant;
            if (tontine.compteSequestre!.soldeActuel <= 0) {
                throw new Error('Solde insuffisant pour effectuer la distribution');
            }

            // Récupérer le bénéficiaire (déjà défini dans le tour)
            const beneficiaire = await MembreTontineModel.findByPk(tourEnAttente.beneficiaireId, {
                include: [{ model: UserModel, as: 'user', include: ['wallet'] }],
                transaction: t
            });

            if (!beneficiaire || !beneficiaire.user?.wallet) {
                throw new Error('Bénéficiaire ou wallet introuvable');
            }

            // Récupérer les pénalités impayées du bénéficiaire
            /*const penalitesImpaye = await PenaliteModel.findAll({
                where: {
                    membreId: beneficiaire.id,
                    statut: 'UNPAID'
                },
                transaction: t
            });

            // Somme totale des pénalités impayées
            const totalPenalites = penalitesImpaye.reduce((sum, p) => sum + Number(p.montant), 0);

            // Montant à distribuer après déduction des pénalités
            let montantDistribueNet = montantTotal;
            if (totalPenalites > 0) {
                if (totalPenalites > montantTotal) {
                    throw new Error("Le montant des pénalités dépasse le montant total à distribuer");
                }

                montantDistribueNet = montantTotal - totalPenalites;

                // 1. Débiter les pénalités du bénéficiaire (on considère que c'est déduit du montant distribué)
                // 2. Répartir les pénalités entre les autres membres actifs

                // Récupérer les autres membres actifs (hors bénéficiaire)
                const autresMembres = await MembreTontineModel.findAll({
                    where: {
                        tontineId,
                        etat: 'ACTIVE',
                        id: { [Op.ne]: beneficiaire.id }
                    },
                    include: [{ model: UserModel, as: 'user', include: ['wallet'] }],
                    transaction: t
                });

                if (autresMembres.length === 0) {
                    throw new Error("Aucun autre membre actif pour répartir les pénalités");
                }

                const partParMembre = totalPenalites / autresMembres.length;

                // Créditer chaque membre de sa part et créer une transaction
                for (const membre of autresMembres) {
                    if (!membre.user?.wallet) {
                        throw new Error(`Wallet introuvable pour le membre ${membre.id}`);
                    }

                    await walletService.creditWallet(
                        membre.user.wallet.matricule,
                        partParMembre,
                        `Répartition pénalités tontine #${tontineId}`
                    );

                    // Créer transaction pour la part créditée
                    await transactionService.createTransaction({
                        amount: partParMembre,
                        userId: membre.user.id,
                        type: typesTransaction['7'],
                        status: 'COMPLETED',
                        totalAmount: partParMembre,
                        currency: 'XAF',
                        sendoFees: 0,
                        provider: typesMethodTransaction['3'],
                        description: `Répartition pénalités tontine #${tontineId}`,
                        receiverId: membre.user.id,
                        receiverType: 'User',
                        method: typesMethodTransaction['3']
                    });
                }   

                // Marquer les pénalités comme payées (ou partiellement payées selon votre logique)
                for (const penalite of penalitesImpaye) {
                    penalite.statut = 'PAID';
                    await penalite.save({ transaction: t });
                }
            }*/

            // Créditer le bénéficiaire avec le montant net
            const config = await configService.getConfigByName('TONTINE_FEES_DISTRIBUTION')
            if (!config) {
                throw new Error("Configuration introuvable")
            }

            const feesSendo = montantTotal * (config.value / 100)
            const amount = montantTotal - feesSendo
            await walletService.creditWallet(
                beneficiaire.user.wallet.matricule,
                amount,
                `Distribution tontine #${tontineId}`
            );

            // Mettre à jour le tour comme réussi
            await tourEnAttente.update({
                etat: 'SUCCESS',
                montantDistribue: montantTotal,
                dateDistribution: new Date()
            }, { transaction: t });

            // Remettre le solde du compte séquestre à zéro
            await CompteSequestreModel.update({
                soldeActuel: tontine.compteSequestre!.soldeActuel - montantTotal,
                dateDernierMouvement: new Date()
            }, {
                where: { tontineId },
                transaction: t
            });

            // Créer la transaction financière pour la distribution nette au bénéficiaire
            await transactionService.createTransaction({
                amount: montantTotal,
                userId: beneficiaire.user.id,
                type: typesTransaction['7'],
                status: 'COMPLETED',
                totalAmount: amount,
                currency: 'XAF',
                sendoFees: feesSendo,
                provider: typesMethodTransaction['3'],
                description: `Distribution tontine #${tontineId}`,
                receiverId: beneficiaire.user.id,
                receiverType: 'User',
                method: typesMethodTransaction['3']
            });

            if (tontine?.membres) {
                for (const membre of tontine.membres) {
                    const email = membre.user?.email;
                    const tokenExpoMembre = await notificationService.getTokenExpo(membre.user?.id ?? 0)
                    if (email && membre.user) {
                        await sendEmailWithHTML(
                            email,
                            `Distribution effectuée pour la tontine ${tontine.nom}`,
                            `<h3>Bonjour ${membre.user.firstname},</h3>
                            <p>La distribution des fonds pour la tontine <strong>${tontine.nom}</strong> a été réalisée avec succès.</p>
                            <p>Le tour de distribution #${tourEnAttente.numeroDistribution} est désormais fermé et le bénéficiaire a reçu les fonds.</p>`
                        );

                        if (tokenExpoMembre) {
                            await notificationService.save({
                                title: `Sendo`,
                                content: `Bonjour ${membre.user.firstname}, la distribution des fonds pour la tontine ${tontine.nom} a été réalisée avec succès. Le tour de distribution est désormais fermé et le bénéficiaire a reçu les fonds.`,
                                userId: membre.user?.id ?? 0,
                                status: 'SENDED',
                                token: tokenExpoMembre.token,
                                type: 'TONTINE'
                            });
                        }
                    }
                }
            }

            return tourEnAttente;
        });
    }

    _selectionnerBeneficiaire(tontine: TontineModel) {
        switch(tontine.type) {
            case 'FIXE':
                return this._selectionOrdreFixe(tontine);
            case 'ALEATOIRE':
                return this._selectionAleatoire(tontine);
            default:
                throw new Error('Méthode de sélection non implémentée');
        }
    }

    private _selectionOrdreFixe(tontine: TontineModel) {
        const membres = tontine.membres;
        if (!membres || membres.length === 0) {
            throw new Error("Aucun membre trouvé pour la tontine.");
        }
        const ordreRotation = tontine.ordreRotation;
        if (!ordreRotation) {
            throw new Error("ordreRotation est null ou non défini.");
        }
        const { index: currentIndex } = JSON.parse(ordreRotation as string);
        const nextIndex = (currentIndex + 1) % membres.length;

        tontine.ordreRotation = JSON.stringify({ index: nextIndex });
        return membres[nextIndex];
    }

    /**
   * Sélectionne aléatoirement un membre bénéficiaire parmi ceux n'ayant pas encore reçu la cagnotte dans le cycle en cours
   */
    private _selectionAleatoire(tontine: TontineModel) {
        // Récupérer la liste des membres actifs
        if (!tontine.membres) {
            throw new Error("Aucun membre trouvé pour la tontine.");
        }
        const membresActifs = tontine.membres.filter(m => m.etat === 'ACTIVE');

        // Récupérer la liste des bénéficiaires déjà servis dans le cycle en cours
        const toursEffectues = tontine.toursDeDistribution?.filter(t => t.etat === 'SUCCESS') || [];
        const beneficiairesServisIds = toursEffectues.map(t => t.beneficiaireId);

        // Filtrer les membres qui n'ont pas encore reçu la cagnotte
        const membresEligibles = membresActifs.filter(m => !beneficiairesServisIds.includes(m.id));

        if (membresEligibles.length === 0) {
            // Tous ont reçu la cagnotte, on peut redémarrer un nouveau cycle ou gérer autrement
            throw new Error('Tous les membres ont déjà bénéficié dans ce cycle');
        }

        // Tirage aléatoire parmi les membres éligibles
        const indexAleatoire = Math.floor(Math.random() * membresEligibles.length);
        return membresEligibles[indexAleatoire];
    }

    async updateOrdreRotation(tontineId: number, ordreRotation?: Array<any>) {
        const tontine = await TontineModel.findByPk(tontineId);
        if (!tontine) {
            throw new Error('Tontine introuvable');
        }
        tontine.ordreRotation = JSON.stringify(ordreRotation);
        await tontine.save();

        // Si type fixe, créer les tours de distribution
        if (tontine.type === 'FIXE' && tontine.ordreRotation && ordreRotation && ordreRotation.length > 0) {
            for (let i = 0; i < ordreRotation.length; i++) {
                const membreId = ordreRotation[i];
                const isExistTour = await TourDeDistributionModel.findOne({
                    where: {
                        tontineId: tontine.id,
                        beneficiaireId: parseInt(membreId)
                    }
                })
                if (!isExistTour) {
                   const tour = await TourDeDistributionModel.create({
                        tontineId: tontine.id,
                        numeroDistribution: i + 1,
                        beneficiaireId: parseInt(membreId),
                        etat: 'PENDING'
                    }); 
                    //Créer un enregistrement de la cotisation de chaque membre pour chaque tour de distribution avec le statut PENDING
                    for (let j = 0; j < tontine.nombreMembres; j++) {
                        await CotisationModel.create({
                            tourDistributionId: tour.id,
                            montant: tontine.montant,
                            statutPaiement: 'PENDING',
                            membreId: parseInt(ordreRotation[j]),
                            tontineId: tontine.id
                        })
                    }
                }
            }
        } else if (tontine.type === 'ALEATOIRE') {
            TontineService.initialiserOrdreAleatoire(tontine)
        }

        return tontine.reload()
    }

    async getSimpleTontineById(tontineId: number) {
        return TontineModel.findByPk(tontineId)
    }

    async getTontineById(tontineId: number) {
        /*const cacheKey = `tontineById:${tontineId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const tontine = await TontineModel.findByPk(tontineId, {
            include: [
                {
                    model: MembreTontineModel, 
                    as: 'membres',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                        },
                        {
                            model: PenaliteModel,
                            as: 'penalites'
                        }
                    ]
                },
                {
                    model: CotisationModel,
                    as: 'cotisations'
                },
                {
                    model: CompteSequestreModel, 
                    as: 'compteSequestre'
                },
                {
                    model: TourDeDistributionModel,
                    as: 'toursDeDistribution'
                }
            ]
        })

        /*if (tontine) {
            await redisClient.set(cacheKey, JSON.stringify(tontine), { EX: REDIS_TTL });
        }*/
        return tontine;
    }

    static async initialiserOrdreAleatoire(tontine: TontineModel) {
        // Récupérer les membres actifs
        const membres = await MembreTontineModel.findAll({
            where: { tontineId: tontine.id, etat: 'ACTIVE' }
        });

        // Mélanger aléatoirement la liste des membres (Fisher-Yates shuffle)
        for (let i = membres.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [membres[i], membres[j]] = [membres[j], membres[i]];
        }

        // Créer les tours de distribution dans cet ordre aléatoire
        for (let i = 0; i < membres.length; i++) {
            const isExistTour = await TourDeDistributionModel.findOne({
                where: {
                    tontineId: tontine.id,
                    beneficiaireId: membres[i].id
                }
            })
            if (!isExistTour) {
                const tour = await TourDeDistributionModel.create({
                    tontineId: tontine.id,
                    numeroDistribution: i + 1,
                    beneficiaireId: membres[i].id,
                    etat: 'PENDING'
                }); 
                //Créer un enregistrement de la cotisation de chaque membre pour chaque tour de distribution avec le statut PENDING
                for (let j = 0; j < tontine.nombreMembres; j++) {
                    await CotisationModel.create({
                        tourDistributionId: tour.id,
                        montant: tontine.montant,
                        statutPaiement: 'PENDING',
                        membreId: membres[j].id,
                        tontineId: tontine.id
                    })
                }
            }
        }
    }

    async getTourDistributionsTontine(tontineId: number) {
        /*const cacheKey = `tourDistributionsTontine:${tontineId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const tours = await TourDeDistributionModel.findAll({
            where: {
                tontineId
            },
            include: [{
                model: MembreTontineModel,
                as: 'beneficiaire',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname']
                }]
            }]
        })

        //await redisClient.set(cacheKey, JSON.stringify(tours), { EX: REDIS_TTL });
        return tours;
    }

    async getTontinesUser(userId: number, limit: number, startIndex: number) {
        /*const cacheKey = `tontinesUser:${userId}:${limit}:${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        // 1. Récupérer les IDs des tontines où l'utilisateur est membre
        const tontineIdsResult = await MembreTontineModel.findAll({
            attributes: ['tontineId'],
            where: { userId },
            raw: true,
            limit,
            offset: startIndex
        });

        const tontineIds = tontineIdsResult.map(r => r.tontineId);

        if (tontineIds.length === 0) {
            // Aucun résultat, on retourne un objet vide compatible findAndCountAll
            return { count: 0, rows: [] };
        }

        // 2. Récupérer les tontines avec tous leurs membres et infos associées
        const tontines = await TontineModel.findAndCountAll({
            where: { id: { [Op.in]: tontineIds } },
            include: [
                {
                    model: MembreTontineModel,
                    as: 'membres',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                        },
                        {
                            model: PenaliteModel,
                            as: 'penalites'
                        }
                    ]
                },
                {
                    model: CotisationModel,
                    as: 'cotisations'
                },
                {
                    model: CompteSequestreModel,
                    as: 'compteSequestre'
                },
                {
                    model: TourDeDistributionModel,
                    as: 'toursDeDistribution'
                }
            ],
            distinct: true,
            order: [['createdAt', 'DESC']]
        });

        //await redisClient.set(cacheKey, JSON.stringify(tontines), { EX: REDIS_TTL });
        return tontines;
    }

    async getTourDistributionsTontineUser(tontineId: number, memberId: number) {
        /*const cacheKey = `tourDistributionsTontineUser:tontineId=${tontineId}&memberId=${memberId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const tours = await TourDeDistributionModel.findAll({
            where: {
                tontineId,
                beneficiaireId: memberId
            },
            include: [{
                model: MembreTontineModel,
                as: 'beneficiaire',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname']
                }]
            }]
        })

        //await redisClient.set(cacheKey, JSON.stringify(tours), { EX: REDIS_TTL });
        return tours;
    }

    async getAllTontines(limit: number, startIndex: number) {
        /*const cacheKey = `allTontines:limit=${limit}&startIndex=${startIndex}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const tontines = await TontineModel.findAndCountAll({
            limit,
            offset: startIndex,
            include: [
                {
                    model: MembreTontineModel, 
                    as: 'membres',
                    include: [
                        {
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'firstname', 'lastname', 'phone', 'email']
                        },
                        {
                            model: PenaliteModel,
                            as: 'penalites'
                        }
                    ]
                },
                {
                    model: CotisationModel,
                    as: 'cotisations'
                },
                {
                    model: CompteSequestreModel, 
                    as: 'compteSequestre'
                },
                {
                    model: TourDeDistributionModel,
                    as: 'toursDeDistribution'
                }
            ],
            order: [['createdAt', 'DESC']]
        })

        //await redisClient.set(cacheKey, JSON.stringify(tontines), { EX: REDIS_TTL });
        return tontines;
    }

    async appliquerPenalite(data: {
        membreId: number;
        montant: number;
        type: 'RETARD' | 'ABSENCE' | 'AUTRE';
        tontineId: number;
        cotisationId?: number;
        description?: string;
    }) {
        return PenaliteModel.create({
            ...data,
            statut: 'UNPAID'
        }, {
            include: [
                {
                    model: TontineModel,
                    as: 'tontine'
                },
                {
                    model: MembreTontineModel,
                    as: 'membre',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        })
    }

    async getPenalitesTontineMembre(membreId: number, tontineId: number) {
        /*const cacheKey = `penalitesTontineMembre:${tontineId}:${membreId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const penalites = await PenaliteModel.findAll({
            where: { membreId, tontineId },
            include: [
                {
                    model: TontineModel,
                    as: 'tontine'
                },
                {
                    model: CotisationModel,
                    as: 'cotisation'
                },
                {
                    model: MembreTontineModel,
                    as: 'membre',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname']
                    }]
                }
            ]
        });

        //await redisClient.set(cacheKey, JSON.stringify(penalites), { EX: REDIS_TTL });
        return penalites;
    }

    async payerPenalite(penaliteId: number) {
        return sequelize.transaction(async (t) => {
            const penalite = await PenaliteModel.findByPk(penaliteId, { 
                transaction: t,
                include: [
                    {
                        model: TontineModel,
                        as: 'tontine'
                    },
                    {
                        model: MembreTontineModel,
                        as: 'membre',
                        include: [{
                            model: UserModel,
                            as: 'user',
                            attributes: ['id', 'firstname', 'lastname', 'email'],
                            include: [{
                                model: WalletModel,
                                as: 'wallet',
                                attributes: ['matricule', 'balance']
                            }]
                        }]
                    }
                ]
            });
            if (!penalite) throw new Error('Pénalité introuvable');

            if (penalite.tontine?.etat === 'CLOSED' || penalite.tontine?.etat === 'SUSPENDED') {
                throw new Error("Tontine bloquée ou suspendue")
            }
            if (penalite.statut === 'PAID') {
                throw new Error("Pénalité déjà payé")
            }

            await CompteSequestreModel.increment('soldeActuel', {
                by: penalite.montant,
                where: { tontineId: penalite.tontineId },
                transaction: t
            });
            
            penalite.statut = 'PAID';
            await penalite.save();

            const config = await configService.getConfigByName("TONTINE_FEES_TRANSACTION")
            if (!config) throw new Error("Configuration introuvable")
            const totalAmount = penalite.montant * (1 + (config.value / 100))
            const feesSendo = penalite.montant * (config.value / 100)

            const wallet = penalite.membre?.user?.wallet;
            if (!wallet) throw new Error('Wallet introuvable');

            await walletService.debitWallet(
                wallet.matricule, 
                totalAmount, 
                'Paiement pénalité'
            );

            const transaction: TransactionCreate = {
                amount: penalite.montant,
                userId: penalite.membre?.user?.id ?? 0,
                type: 'TONTINE_PAYMENT',
                status: 'COMPLETED',
                totalAmount: totalAmount,
                sendoFees: feesSendo,
                currency: 'XAF',
                description: 'Paiement pénalité',
                provider: 'WALLET_PAYMENT',
                receiverId: penalite.membre?.user?.id ?? 0,
                receiverType: 'User',
                method: 'WALLET'
            };
            await transactionService.createTransaction(transaction);

            if (penalite.tontine && penalite.membre?.user?.email) {
                await sendEmailWithHTML(
                    penalite.membre?.user?.email,
                    'Paiement pénalité tontine',
                    `<h3>Paiement pénalité tontine</h3>
                    <p><b>${penalite.membre?.user?.firstname+' '+penalite.membre?.user?.lastname}</b> vous venez 
                    d'effectuer un paiement de la pénalité de la tontine <b>${penalite.tontine.nom}</b> sur Sendo</p>`
                )
                const tokenExpo = await notificationService.getTokenExpo(penalite.membre?.user?.id ?? 0)
                if (tokenExpo) {
                    await notificationService.save({
                        title: `Sendo`,
                        content: `${penalite.membre.user.firstname}, vous venez d'effectuer un paiement de la pénalité de la tontine ${penalite.tontine.nom} sur Sendo`,
                        userId: penalite.membre.user?.id ?? 0,
                        status: 'SENDED',
                        token: tokenExpo.token,
                        type: 'TONTINE'
                    });
                }
            }

            return penalite;
        });
    }

    async updateStatusTontine(
        tontineId: number, 
        status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
    ) {
        const tontine = await TontineModel.findByPk(tontineId, {
            include: [{ 
                model: MembreTontineModel, 
                as: 'admin'
            }]
        });
        
        if (tontine && tontine.admin?.role !== 'ADMIN') {
            throw new Error("Vous n'êtes pas autorisé à effectuer cette action")
        }
        
        if (tontine) {
            tontine.etat = status;
            tontine.save();
        }
    }

    async updateStatusTontineAdmin(
        tontineId: number, 
        status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
    ) {
        const tontine = await TontineModel.findByPk(tontineId);
        if (tontine) {
            tontine.etat = status;
            tontine.save();
        }
    }

    async getCotisationsTontine(
        tontineId: number, 
        membreId?: number, 
        statutPaiement?: 'VALIDATED' | 'PENDING' | 'REJECTED'
    ) {
        /*const cacheKey = `cotisationsTontine:${tontineId}:${membreId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        where.tontineId = tontineId
        if (membreId) {
            where.membreId = membreId
        }
        if (statutPaiement) {
            where.statutPaiement = statutPaiement
        }

        const cotisations = await CotisationModel.findAll({
            where,
            include: [{
                model: MembreTontineModel,
                as: 'membre',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['id', 'firstname', 'lastname', 'phone']
                }]
            }]
        })

        //await redisClient.set(cacheKey, JSON.stringify(cotisations), { EX: REDIS_TTL });
        return cotisations;
    }

    async getPenalitesTontine(
        tontineId?: number, 
        membreId?: number, 
        statut?: 'PAID' | 'UNPAID',
        type?: 'ABSENCE' | 'RETARD' | 'AUTRE'
    ) {
        /*const cacheKey = `penalitesTontine:${tontineId}:${membreId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);*/

        const where: Record<string, any> = {};
        if (tontineId) where.tontineId = tontineId
        if (membreId) where.membreId = membreId
        if (statut) where.statut = statut
        if (type) where.type = type

        const penalites = await PenaliteModel.findAll({
            where,
            include: [{
                model: MembreTontineModel,
                as: 'membre',
                include: [{
                    model: UserModel,
                    as: 'user',
                    attributes: ['firstname', 'lastname', 'email', 'id']
                }]
            }]
        })

        //await redisClient.set(cacheKey, JSON.stringify(penalites), { EX: REDIS_TTL });
        return penalites;
    }

    async checkUnpaidPenalite() {
        const unpaidPenalites = await PenaliteModel.findAll({
            where: {
                statut: 'UNPAID',
                retryCount: { [Op.lt]: 2 }, // 2 tentatives max
            },
            include: [
                {
                    model: TontineModel,
                    as: 'tontine'
                },
                {
                    model: MembreTontineModel,
                    as: 'membre',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        })

        for (const penalite of unpaidPenalites) {
            await penalite.update({
                retryCount: penalite.retryCount + 1,
                lastChecked: new Date()
            }, {
                where: {
                    id: penalite.id
                }
            })
        }

        return unpaidPenalites
    }

    async getPendingFirstTours() {
        return TontineModel.findAll({
            where: { 
                etat: 'ACTIVE',
                [Op.or]: [
                    { lastChecked: null },
                    { lastChecked: { [Op.lt]: literal('NOW() - INTERVAL 1 DAY') } } // pour quotidien
                ]
            },
            include: [
                {
                    model: TourDeDistributionModel,
                    as: 'toursDeDistribution',
                    where: { etat: 'PENDING' },
                    order: [['numeroDistribution', 'ASC']],
                    limit: 1
                },
                {
                    model: MembreTontineModel,
                    as: 'membres',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'email', 'firstname', 'lastname']
                    }]
                }
            ]
        });
    }

    async updateSequestreAccount(
        tontineId: number, 
        amount: number, 
        adminId: number,
        action: 'DEPOSIT' | 'WITHDRAWAL'
    ) {
        const account = await CompteSequestreModel.findOne({
            where: { tontineId }
        })
        if (!account) {
            throw new Error("Compte introuvable")
        }
        if (account.etatCompte === 'BLOCKED') {
            throw new Error("Compte inactif")
        }

        if (action === 'DEPOSIT') account.soldeActuel = account.soldeActuel + amount;
        else if (action === 'WITHDRAWAL') account.soldeActuel = account.soldeActuel - amount;
        await account.save();

        const transaction: TransactionCreate = {
            amount: amount,
            userId: 1,
            type: 'ADMIN_SENDO',
            status: 'COMPLETED',
            totalAmount: amount,
            currency: 'XAF',
            description: action === 'DEPOSIT' ? `Dépôt par Sendo dans compte séquestre tontine #${account.tontineId}` : `Retrait par Sendo du compte séquestre tontine #${account.tontineId}`,
            provider: 'SYSTEM',
            receiverType: 'User',
            receiverId: 1,
            method: 'WALLET'
        };
        await transactionService.createTransaction(transaction);

        return account.reload();
    }

    async relancerMembreCotisation(cotisationId: number) {
        // Récupérer les informations nécessaires
        const cotisation = await CotisationModel.findByPk(cotisationId, {
            include: [
                {
                    model: TontineModel,
                    as: 'tontine'
                },
                {
                    model: MembreTontineModel,
                    as: 'membre',
                    include: [{
                        model: UserModel,
                        as: 'user',
                        attributes: ['id', 'firstname', 'lastname', 'email']
                    }]
                }
            ]
        })

        if (cotisation?.statutPaiement === 'VALIDATED') {
            throw new Error("La cotisation a déjà été payé");
        }

        // Envoyer l'email de relance
        if (cotisation?.membre && cotisation.membre.user?.email && cotisation.tontine) {
            await sendEmailWithHTML(
                cotisation.membre.user.email,
                `[${cotisation.tontine.nom}] Rappel de cotisation`,
                `<h3>Bonjour ${cotisation.membre.user.firstname},</h3>
                <p>Nous vous rappelons votre cotisation pour la tontine <strong>${cotisation.tontine.nom}</strong>.</p>
                <p>Montant à verser : <strong>${cotisation.tontine.montant} FCFA</strong></p>
                <p>Merci de régulariser votre situation dans les meilleurs délais.</p>`
            );
        }

        const tokenExpo = await notificationService.getTokenExpo(cotisation?.membre?.user?.id ?? 0)
        if (tokenExpo && cotisation && cotisation.tontine && cotisation.membre && cotisation.membre.user) {
            await notificationService.save({
                title: `Sendo`,
                content: `Attention ! Vous n'avez pas versé votre cotisation de ${cotisation.tontine.montant} FCFA sur la tontine ${cotisation.tontine.nom}. Une pénalité sera appliquée.`,
                userId: cotisation.membre.user?.id ?? 0,
                status: 'SENDED',
                token: tokenExpo.token,
                type: 'TONTINE'
            });
        }

        return cotisation;
    }   
}

export default new TontineService();