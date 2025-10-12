import ContactModel from "@models/contact.model";
import UserContactModel from "@models/user-contact.model";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";


class ContactService {
    async synchronizeContacts(
        contacts: Array<{ userId: number; name: string; phone: string }>,
        userId: number
    ) {
        try {
            // Récupérer le user en question
            const user = await UserModel.findByPk(userId)

            // Extraire les numéros de téléphone des contacts
            const phones = contacts.map(c => c.phone);
            const filteredPhones = phones.filter(p => !p.includes(user?.phone ?? ''))

            // Récupérer les utilisateurs existants avec ces numéros
            const existingUsers = await UserModel.findAll({
                where: {
                    phone: filteredPhones
                },
                attributes: ['id', 'phone']
            });

            // Créer un mapping phone -> userId pour retrouver facilement l'id utilisateur
            const phoneToUserIdMap = new Map<string, number>();
            existingUsers.forEach(user => {
                phoneToUserIdMap.set(user.phone, user.id);
            });

            // Filtrer les contacts dont le numéro existe dans users et ajouter contactUserId
            const filteredContacts = contacts
                .filter(c => phoneToUserIdMap.has(c.phone))
                .map(c => ({
                    ...c,
                    userId,
                    contactUserId: phoneToUserIdMap.get(c.phone)!  // ajout du contactUserId
                }));

            // Insertion ou mise à jour des contacts avec contactUserId
            return await ContactModel.bulkCreate(filteredContacts, {
                updateOnDuplicate: ['phone', 'name', 'contactUserId']
            });
        } catch (error: any) {
            throw new Error(`Échec synchronisation des contacts: ${error.message}`);
        }
    }   

    async getContacts(userId: number) {
        try {
            return await ContactModel.findAll({
                where: { userId },
                order: [['name', 'ASC']],
                attributes: ['id', 'name', 'phone'],
                include: [
                    {
                        model: UserModel,
                        as: 'ownerUser',
                        attributes: ['id', 'firstname', 'lastname', 'phone', 'email'],
                        include: [{ 
                            model: WalletModel, 
                            as: 'wallet', 
                            attributes: ['id', 'matricule'] 
                        }]
                    }
                ]
            });
        } catch (error: any) {
            throw new Error(`Échec récupération des contacts: ${error.message}`);
        }
    }

    async addContactToFavorites(contactNumber: number, userId: number, contactId: number) {
        try {
            const contact = await ContactModel.findOne({
                where: { 
                    phone: contactNumber, 
                    userId 
                },
            });

            if (!contact) {
                throw new Error('Contact non trouvé');
            }

            // Vérifier si le contact est déjà dans les favoris
            const isFavorite = await UserContactModel.findOne({
                where: {  
                    userId,
                    contactId
                }
            }); 
            if (isFavorite) {
                throw new Error('Contact déjà dans les favoris');
            }

            // Ajouter le contact aux favoris
            await UserContactModel.create({
                userId,
                contactId
            });
            return true; 
        } catch (error: any) {
            throw new Error(`Échec ajout contact aux favoris: ${error.message}`);
        }
    }

    async removeContactFromFavorites(contactId: number, userId: number) {
        try {
            const contact = await UserContactModel.findOne({
                where: { 
                    contactId,
                    userId
                }
            });

            if (!contact) {
                throw new Error('Contact non trouvé dans les favoris');
            }

            // Supprimer le contact des favoris
            await UserContactModel.destroy({
                where: { 
                    contactId,
                    userId
                }
            });
            return true; 
        } catch (error: any) {
            throw new Error(`Échec suppression contact des favoris: ${error.message}`);
        }
    }

    async getContactByPhone(phone: string) {
        try {
            const contact = await ContactModel.findOne({
                where: { 
                    phone 
                },
                attributes: ['id', 'name', 'phone'],
                include: [
                    {
                        model: UserModel,
                        as: 'ownerUser',
                        attributes: ['id', 'firstname', 'lastname', 'phone', 'email', 'address'],
                        include: [{ 
                            model: WalletModel, 
                            as: 'wallet', 
                            attributes: ['id', 'matricule', 'balance']
                        }]
                    }
                ]
            });

            if (!contact) {
                throw new Error('Contact non trouvé');
            }

            return contact;
        } catch (error: any) {
            throw new Error(`Échec récupération du contact: ${error.message}`);
        }
    }

    async getFavorites(userId: number) {
        try {
            const userWithFavorites = await UserModel.findByPk(userId, {
                include: [{
                    model: ContactModel,
                    as: 'favoriteContacts',
                    attributes: ['id', 'name', 'phone'],
                    include: [{
                        model: UserModel,
                        as: 'ownerUser',
                        attributes: ['id', 'firstname', 'lastname', 'phone', 'email', 'address']
                    }],
                    through: { attributes: [] }
                }],
                attributes: ['id', 'firstname', 'lastname', 'phone', 'email', 'address'],
                order: [['firstname', 'ASC']]
            });

            if (!userWithFavorites) {
                throw new Error('Utilisateur non trouvé');
            }

            // Optionnel : ne renvoyer que les contacts favoris
            return userWithFavorites.favoriteContacts;
        } catch (error: any) {
            throw new Error(`Échec récupération des favoris: ${error.message}`);
        }
    }

}

export default new ContactService();