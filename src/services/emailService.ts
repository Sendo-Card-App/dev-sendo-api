import transporter from "@config/mailer";
import CardTransactionDebtsModel from "@models/card-transaction-debts.model";
import ParticipantSharedExpenseModel from "@models/participant-shared-expense.model";
import SharedExpenseModel from "@models/shared-expense.model";
import UserModel from "@models/user.model";
import { TypesCurrency, TypesKYCStatus, typesNotification } from "@utils/constants";

const sender = {
    address: process.env.EMAIL_FROM || '',
    name: "Sendo Team",
};

const senderRegularisation = {
    address: process.env.EMAIL_REGULARISATION || '',
    name: "Sendo Régularisation"
}

interface Attachment {
    filename: string;
    path?: string; // Chemin vers le fichier sur le disque
    content?: Buffer | string; // Ou contenu direct (ex: Buffer)
    contentType?: string;
}

export const sendEmailVerification = async (email: string, token: string) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: "Vérifiez votre compte",
        category: 'Création de compte',
        html: basicEmailTemplate(
            `<p>Vérifier votre compte en cliquant
                <a href="https://api.sf-e.ca/api/auth/email/verify?token=${token}"> ici</a></p>
                <p>ou cliquez sur ce lien <a href="https://api.sf-e.ca/api/auth/email/verify?token=${token}">https://api.sf-e.ca/api/auth/email/verify?token=${token}</a></p>
            `
        )
    })
}

export const sendEmailVerificationSuccess = async (user: UserModel) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Compte vérifié',
        category: typesNotification['0'],
        html: basicEmailTemplate(
            `<h3>Bonjour ${user.firstname} ${user.lastname}</h3>
            <p>Votre compte a été vérifié avec succès</p>`
        )
    });
}

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const resetUrl = `${process.env.APP_URL_FRONTEND}/auth/reset-password?token=${token}`;
    
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: 'Modification du mot de passe',
        category: typesNotification['12'],
        html: basicEmailTemplate(
            `
                <p>Vous avez demandé une modification du mot de passe.</p>
                <a href="${resetUrl}">Cliquez ici pour modifier</a>
                <p>Lien valide 1 heure</p>
            `
        )
    });
};

export const sendUserMail = async (
    user: UserModel, 
    password: string, 
    typeAccount: 'Particulier' | 'Entreprise' | 'Customer'
) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Nouveau compte créé',
        category: 'Création de compte',
        html: basicEmailTemplate(
            `
                <p>${user.firstname} ${user.lastname}, votre compte ${typeAccount != 'Customer' && 'agent'} a été créé, voici vos identifiants de connexion :</p>
                <ul>
                    <li><b>Email : </b>${user.email}</li>
                    <li><b>Mot de passe : </b>${password}</li>
                    ${typeAccount != 'Customer' ? `
                        <li><b>Type de compte agent : </b>${typeAccount}</li>
                        <li><b>Cliquez ici pour vous connecter : </b><a href='${process.env.APP_URL_MERCHANT_AUTH}'>${process.env.APP_URL_MERCHANT_AUTH}</a></li>` :
                        `<li><b>Cliquez ici pour vous connecter : </b><a href='${process.env.APP_URL_FRONTEND_AUTH}'>${process.env.APP_URL_FRONTEND_AUTH}</a></li>`
                    }
                </ul>
            `
        )
    });
}

export const successCreatingAccount = async (user: UserModel, code: string) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Nouveau compte Sendo créé',
        category: 'Création de compte',
        html: basicEmailTemplate(
            `
                <p>Félicitations ${user.firstname} ${user.lastname}, votre compte SENDO a été créé</p>
                <p>Voici votre code OTP : <b>${code}</b></p>
            `
        )
    });
}

export const sendPasswordModifiedMail = async (email: string) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: 'Modification du password',
        category: typesNotification['12'],
        html:  basicEmailTemplate(
            `<p>Votre mot de passe a été modifié</p>`
        )
    });
}

export const sendUserModifiedMail = async (user: UserModel) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Modification du compte',
        category: typesNotification['13'],
        html: basicEmailTemplate(
            `<p>Certaines informations ont été modifiées sur votre compte</p>`
        )
    });
}

export const sendEmailVerificationFailed = async (user: UserModel, reason: string, status: string) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Échec de la vérification du compte',
        category: typesNotification['3'],
        html: basicEmailTemplate(
            `
                <h1>Statut KYC : ${status}</h1>
                ${reason && `<p>Raison : ${reason}</p>`}
                <p>Connectez-vous pour plus de détails</p>
            `
        )
    });
}

export function mapKYCStatus(kycStatus: TypesKYCStatus): 'En cours de vérification' | 'Vérifié' | 'Rejeté' {
    const statusMap: Record<string, 'En cours de vérification' | 'Vérifié' | 'Rejeté'> = {
        'APPROVED': 'Vérifié',
        'PENDING': 'En cours de vérification',
        'REJECTED': 'Rejeté'
    };
    return statusMap[kycStatus] || 'En cours de vérification';
}

export const sendEmailVerificationKYC = async (user: UserModel) => {
    // S'assurer que les documents KYC sont bien présents
    const docs = user.kycDocuments ?? [];

    // Mapping des types reconnus pour l'affichage
    const typeLabels: Record<string, string> = {
        'ID_PROOF': "Pièce d'identité",
        'ID_PROOF_VERSO': "Pièce d'identité verso",
        'NIU_PROOF': "Document NIU",
        'ADDRESS_PROOF': "Plan de localisation",
        'SELFIE': "Selfie"
    };
    
    // Génère une liste du statut de chaque document reconnu, avec fallback si absent ou type inconnu
    const documentsListHTML = docs.length
        ? docs.map(doc =>
            `<li><b>${typeLabels[doc.type] || doc.type || 'Type inconnu'} :</b> ${mapKYCStatus(doc.status)}</li>`
        ).join('\n')
        : '<li>Aucun document KYC trouvé</li>';

    // Construction dynamique de l’email
    const emailHTML = basicEmailTemplate(`
        <h1>Status vérification KYC</h1>
        <p>Votre KYC a été vérifié, voici les statuts de vos documents :</p>
        <ul>
            ${documentsListHTML}
        </ul>
        <p>Lorsque tous vos documents sont validés, vous pouvez profiter de toutes les fonctionnalités de notre plateforme.</p>
    `);

    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Vérification KYC status',
        category: typesNotification['3'],
        html: emailHTML
    });
};

export const successAddingSecondPhone = async (user: UserModel, phone: string) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Ajout d\'un second numéro',
        category: typesNotification['8'],
        html: basicEmailTemplate(
            `
                <h1>Ajout d'un second numéro</h1>
                <p>${user.firstname} ${user.lastname} vous avez ajouté avec succès un second numéro sur votre profil</p>
                <p>Pour qu'il être utilisé, veuillez le vérifier.</p>
                <p>Lorsqu'il sera vérifié, vous pourrez désormais effectuer des recharges et retraits mobile money sur celui-ci.</p>
            `
        )
    });
}

export const successVerifySecondPhone = async (user: UserModel, phone: string) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: 'Vérification du second numéro',
        category: typesNotification['8'],
        html: basicEmailTemplate(
            `
                <h1>Vérification du second numero</h1>
                <p>${user.firstname} ${user.lastname}, la vérification de votre second numéro a été un succès</p>
                <p>Lorsque votre numéro est vérifié, vous pouvez désormais effectuer des recharges et retraits mobile money sur celui-ci.</p>
            `
        )
    });
}

export const successTransferFunds = async (
    senderP: UserModel, 
    email: string, 
    amount: number,
    currency: TypesCurrency
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: 'Transfert de fonds',
        category: typesNotification['4'],
        html: basicEmailTemplate(
            `
                <h1>Transfert de fonds</h1>
                <p>Vous avez reçu de <b>${senderP.firstname} ${senderP.lastname}</b> la somme de ${amount} ${currency}</p>
            `
        )
    });
}

export const successCreatingAccountWithYourRefferalCode = async (owner: UserModel, referred: UserModel, profit: number) => {
    await transporter.sendMail({
        from: sender,
        to: owner.email,
        subject: 'Compte Sendo créé avec succès via parrainage !',
        category: 'Création de compte',
        html: basicEmailTemplate(
            `
                <h1>Utilisation code de parrainage</h1>
                <p>${owner.firstname} ${owner.lastname}</p>
                <p>${referred.firstname} ${referred.lastname} a utilisé votre code de parrainage pour créer son compte.</p>
                <p>Vous recevez donc sur votre portefeuille comme cadeau la somme de ${profit} XAF après qu'il aura effectué une première transaction d'achat.</p>
            `
        )
    });
}

export const sendGlobalEmail = async (
    email: string, 
    subject: string, 
    html: string, 
    category?: string
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject,
        html: basicEmailTemplate(html),
        category
    });
}

export const sendEmailWithAttachments = async (
    email: string,
    subject: string,
    html: string,
    attachments?: Attachment[]
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject,
        html: basicEmailTemplate(html),
        category: typesNotification['17'],
        //attachments
    });
};

export const sendEmailWithHTML = async (
    email: string,
    subject: string,
    html: string
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject,
        category: typesNotification['18'],
        html: basicEmailTemplate(html)
    });
};

export const sendSharedExpenseCreatedOrUpdated = async (
    email: string, 
    sharedExpense: SharedExpenseModel,
    type: 'Create' | 'Update'
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: `${type === 'Create' ? 'Création' : 'Modification'} dépense partagée`,
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<p>Vous venez de ${type === 'Create' ? 'créer' : 'modifier'} une dépense partagée</p>
            <ul>
                <li>Méthode de calcul : ${sharedExpense.methodCalculatingShare}</li>
                <li>Votre part : ${sharedExpense.initiatorPart}</li>
                <li>Date limite de paiement : ${sharedExpense.limitDate}</li>
                <li>Montant total de la dépense : ${sharedExpense.totalAmount}</li>
            </ul>`
        )
    })
}

export const sendSharedExpenseCreatedToPaticipants = async (
    email: string, 
    sharedExpense: SharedExpenseModel,
    participantsSharedExpense: ParticipantSharedExpenseModel
) => {
    await transporter.sendMail({
        from: sender,
        to: email,
        subject: "Participer à une dépense",
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<h3>Invitation à une dépense partagée</h3>
            <p>Vous avez été invité à participer à une dépense partagée</p>
            <ul>
                <li>Créée le <b>${participantsSharedExpense.createdAt}</b></li>
                <li>Votre part s'élève à <b>${participantsSharedExpense.part}</b> XAF</li>
                <li>Date limite de paiement <b>${sharedExpense.limitDate}</b></li>
            </ul>`
        )
    })
}

export const sendSharedExpensePay = async (
    user: UserModel, 
    decline: boolean,
    description: string,
    participantsSharedExpense: ParticipantSharedExpenseModel
) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: "Paiement de la dépense partagée",
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<p>Bonjour ${user.firstname} ${user.lastname},</p>
            <p>Votre paiement de ${participantsSharedExpense.part} FCFA pour la dépense <b>${description}</b>
            a été ${decline ? 'refusé' : 'effectué'} pour la dépense partagée.</p>
            <p>Merci !</p>`
        )
    })
}

export const sendSharedExpensePayToInitiator = async (
    user: UserModel, 
    decline: boolean,
    participantSharedExpense: ParticipantSharedExpenseModel,
    participant: UserModel,
    description: string
) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: "Mise à jour de la dépense partagée",
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<p>Bonjour ${user.firstname},</p>
            <p>Le participant ${participant.firstname} ${participant.lastname} a ${decline ? 'refusé' : 'effectué'} son paiement 
            de ${participantSharedExpense.part} FCFA pour la dépense partagée <b>${description}</b>.</p>
            <p>Merci !</p>`
        )
    })
}

export const sendSharedExpenseClose = async (
    user: UserModel,
) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: "Suppression de la dépense partagée",
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<p>Bonjour ${user.firstname} ${user.lastname},</p>
            <p>Votre dépense partagée vient d'être supprimé</p>`
        )
    })
}

export const sendSharedExpenseCloseToParticipants = async (
    sharedExpense: SharedExpenseModel,
    user: UserModel
) => {
    await transporter.sendMail({
        from: sender,
        to: user.email,
        subject: "Suppression de la dépense partagée",
        category: 'Dépense partagée',
        html: basicEmailTemplate(
            `<p>Bonjour <b>${user.firstname} ${user.lastname}</b>, cette demande vient d'être supprimée</p>
            <ul>
                <li>Méthode de calcul : ${sharedExpense.methodCalculatingShare}</li>
                <li>Votre part : ${sharedExpense.initiatorPart}</li>
                <li>Date limite de paiement : ${sharedExpense.limitDate}</li>
                <li>Montant total de la dépense : ${sharedExpense.totalAmount}</li>
            </ul>
            `
        )
    })
}

export const notifyRegularisationDebtUser = async (
    debt: CardTransactionDebtsModel, 
    isPartial = false,
    amount?: number
) => {
    await transporter.sendMail({
        from: senderRegularisation,
        to: debt.user!.email,
        subject: 'Prélèvement pour régularisation de dette',
        category: typesNotification['27'],
        html: basicEmailTemplate(
            `<p>Bonjour ${debt.user!.firstname} ${debt.user!.lastname},</p>
            <p>Un prélèvement ${isPartial ? 'partiel' : 'total'} pour régularisation de la dette #${debt.intitule} sur votre carte VISA Sendo a été effectué.</p>
            <ul>
                <li>Montant régularisé : ${amount ? `${amount} XAF` : debt.amount} XAF</li>
                <li>Date de régularisation : ${new Date().toLocaleDateString('fr-FR')}</li>
            </ul>`
        )
    });
}

export const notifyDeletingDebtUser = async (
    debt: CardTransactionDebtsModel
) => {
    await transporter.sendMail({
        from: senderRegularisation,
        to: debt.user!.email,
        subject: 'Suppression de dette',
        category: typesNotification['27'],
        html: basicEmailTemplate(
            `<p>Bonjour ${debt.user!.firstname} ${debt.user!.lastname},</p>
            <p>Votre dette #${debt.intitule} de ${debt.amount} XAF a été supprimée par Sendo.</p>
            <p>Si vous avez des questions, n'hésitez pas à contacter notre support.</p>`
        )
    });
}

// Template HTML de base pour les emails
export const basicEmailTemplate = (content: string): string => `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email Notification</title>
<style>
    /* Reset et styles généraux */
    body {
        margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7f7f7;
        color: #333333;
    }
    .email-wrapper {
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 0 15px rgba(0,0,0,0.1);
        overflow: hidden;
        border: 1px solid #e5e5e5;
    }
    .email-header {
        background-color: #7ddd7d;
        color: white;
        padding: 20px;
        text-align: center;
        font-size: 1.6em;
        font-weight: bold;
    }
    .email-content {
        padding: 20px;
        font-size: 1em;
        line-height: 1.5em;
        color: #333;
    }
    a {
        color: #7ddd7d;
        text-decoration: none;
        font-weight: bold;
    }
    a:hover {
        text-decoration: underline;
    }
    ul {
        padding-left: 20px;
        margin-top: 0;
        margin-bottom: 1em;
    }
    li {
        margin-bottom: 0.5em;
    }
    .footer {
        background-color: #f0f0f0;
        color: #888888;
        font-size: 0.9em;
        text-align: center;
        padding: 15px;
    }
</style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-header">Sendo Team</div>
        <div class="email-content">
            ${content}
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Sendo. Tous droits réservés.
        </div>
    </div>
</body>
</html>
`;