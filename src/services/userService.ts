import UserModel from '@models/user.model';
import { UserCreate, UserUpdate } from '../types/User';
import { DestroyOptions, Op, UpdateOptions } from 'sequelize';
import WalletModel from '@models/wallet.model';
import VirtualCardModel from '@models/virtualCard.model';
import TransactionModel from '@models/transaction.model';
import RoleModel from '@models/role.model';
import KycDocumentModel from '@models/kyc-document.model';
import PhoneNumberUserModel from '@models/phone-number-user.model';
import configService from './configService';
import { TypesCurrency, typesToken } from '@utils/constants';
import ConfigModel from '@models/config.model';
import { TokenModel } from '@models/index.model';
import notificationService from './notificationService';

interface UpdatePassword {
    oldPassword: string;
    newPassword: string;
}

class UserService {
    async getAllUsers(
        country: string,
        search: string, 
        limit: number, 
        startIndex:number
    ) {
        const where: Record<string, any> = {};
        if (country) {
            where.country = country;
        }
        if (search) {
            (where as any)[Op.or] = [
                { firstname: { [Op.like]: `%${search}%` } },
                { lastname: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        const limitNum = Number(limit);
        const offsetNum = Number(startIndex);

        return UserModel.findAndCountAll({
            limit: limitNum,
            offset: offsetNum,
            where,
            include: [{
                model: RoleModel,
                as: 'roles',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            }]
        });
    }

    async getUser(id: number) {
        return await UserModel.findByPk(id);
    }

    async createUser(user: UserCreate) {
        return UserModel.create(user);
    }

    async getUserById(id: number) {
        return UserModel.findByPk(id, {
            include: [{ model: WalletModel, as: 'wallet' }]
        });
    }

    async getUserByEmail(email: string) {
        return UserModel.findOne({
            where: {email: email}
        });
    }

    async deleteUserById(userId: number) {
        const options: DestroyOptions = {
            where: { id: userId },
            limit: 1
        };
        const deletedUser = UserModel.destroy(options)
        return deletedUser;
    }

    async updateUser(userId: number, updates: Partial<UserUpdate>): Promise<UserModel> {
        const options: UpdateOptions = {
            where: { id: userId },
            returning: true
        };
    
        const userExits = await UserModel.findByPk(userId);
        if (!userExits) {
            throw new Error('L\'utilisateur n\'exite pas');
        }

        await UserModel.update(updates, options);

        const updatedUser = await UserModel.findByPk(userId);
        if (!updatedUser) {
            throw new Error('Utilisateur non trouvé après mise à jour');
        }
        
        const token = await notificationService.getTokenExpo(userId)
        await notificationService.save({
            title: 'Sendo',
            type: 'SUCCESS_KYC_VERIFIED',
            content: `${userExits.firstname} votre profil vient d'être mis à jour`,
            userId,
            token: token?.token ?? '',
            status: 'SENDED'
        })
        
        return updatedUser;
    }

    async updatePassword(userId: number, updates: UpdatePassword): Promise<UserModel> {
        const user = await UserModel.findByPk(userId);
        if (!user) throw new Error('Utilisateur introuvable');
    
        if (!updates.oldPassword || !updates.newPassword) {
            throw new Error("Les deux champs de mot de passe sont requis");
        }
    
        if (!await user.comparePassword(updates.oldPassword)) {
            throw new Error("Ancien mot de passe incorrect");
        }
    
        if (await user.comparePassword(updates.newPassword)) {
            throw new Error("Le nouveau mot de passe doit être différent");
        }

        if (updates.newPassword.length < 8) {
            throw new Error("8 caractères minimum requis");
        }

        if (!/(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}/.test(updates.newPassword)) {
            throw new Error("Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial");
        }        
    
        user.password = updates.newPassword;
        await user.save();

        const token = await notificationService.getTokenExpo(user.id)
        await notificationService.save({
            title: 'Sendo',
            type: 'SUCCESS_MODIFY_PASSWORD',
            content: `${user.firstname} votre mot de passe vient d'être changé`,
            userId,
            token: token?.token ?? '',
            status: 'SENDED'
        })
    
        return user;
    }    

    async getMe(id: number): Promise<UserModel> {
        const user = await UserModel.findByPk(id, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: RoleModel,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                },
                {
                    model: KycDocumentModel,
                    as: 'kycDocuments'
                },
                {
                    model: WalletModel,
                    as: 'wallet',
                    attributes: ['id', 'balance', 'currency', 'status', 'matricule']
                },
                {
                    model: PhoneNumberUserModel,
                    as: 'secondPhoneNumber',
                    attributes: ['id', 'phone', 'isVerified']
                },
                {
                    model: VirtualCardModel,
                    as: 'virtualCard'
                },
                {
                    model: TransactionModel,
                    as: 'transactions',
                    attributes: ['id', 'amount', 'type', 'status', 'receiverId', 'createdAt'],
                    order: [['createdAt', 'DESC']]
                }
            ]
        });

        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }

        return user;
    }

    async addSecondPhoneNumberUser(phone: string, userId: number) {
        return await PhoneNumberUserModel.create({phone, userId})
    }

    async getKYCDocumentsUser(userId: number) {
        return await KycDocumentModel.findAll({
            where: {userId: userId}
        })
    }

    async addPasscodeUser(userId: number, passcode: string) {
        const options: UpdateOptions = {
            where: { id: userId },
            returning: true
        };
        await UserModel.update({passcode}, options);
    }

    async getUserReferralCode(referralCode: string) {
        return UserModel.findOne({ 
            where: { referralCode: referralCode.toUpperCase() },
            include: [{ 
                model: WalletModel, 
                as: 'wallet', 
                attributes: ['id', 'balance', 'matricule', 'status'] 
            }]
        });
    }

    async simulatePayment(currency: TypesCurrency) {
        const partnerVisaFees = await configService.getConfigByName('PARTNER_VISA_FEES')
        const sendoFees = await configService.getConfigByName('SENDO_SERVICE_FEES')
        let currencyValue: ConfigModel | null = null;
        if (currency === 'USD') {
            currencyValue = await configService.getConfigByName('USD_SENDO_VALUE')
        } else if (currency === 'EUR') {
            currencyValue = await configService.getConfigByName('EUR_SENDO_VALUE')
        } else if (currency === 'CAD') {
            currencyValue = await configService.getConfigByName('CAD_SENDO_VALUE')
        } else if (currency === 'JPY') {
            currencyValue = await configService.getConfigByName('YEN_SENDO_VALUE')
        }
        
        return {
            partnerVisaFees: partnerVisaFees?.value,
            sendoFees: sendoFees?.value,
            currencyValue: currencyValue?.value
        }
    }

    async getTokenExpoUser(userId: number) {
        const token = await TokenModel.findOne({
            where: {
                userId,
                tokenType: typesToken['4']
            },
            attributes: ['token', 'tokenType', 'deviceId', 'userId']
        })
        if (!token) {
            throw new Error("Token Expo introuvable")
        }
        return token
    }

    async saveOrUpdateTokenExpoUser(tokenCreate: any) {
        const token = await TokenModel.findOne({
            where: {
                userId: tokenCreate.userId,
                tokenType: tokenCreate.tokenType
            }
        })

        if (!token) {
            return TokenModel.create(tokenCreate)
        }
        
        if (token.token !== tokenCreate.token) {
            token.token = tokenCreate.token
            token.save()
        }
        return token.reload()
    }

    async getMeWithKyc(id: number): Promise<UserModel> {
        const user = await UserModel.findByPk(id, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: KycDocumentModel,
                    as: 'kycDocuments'
                }
            ]
        });

        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }

        return user;
    }

    async checkPinCode(userId: number, pincode: string | number) {
        const user = await UserModel.findByPk(userId)
        if (!user) {
            throw new Error('Utilisateur introuvable')
        }

        if (user.passcode != pincode) {
            user.numberFailureConnection = user.numberFailureConnection + 1
            if (user.numberFailureConnection === 3) {
                user.status = 'BLOCKED'
            }
            await user.save()
            return false
        } else {
            if (user.numberFailureConnection > 0) {
                user.numberFailureConnection = 0
                await user.save()
            }
            return true
        }
    }

    async getPictureUser(userId: number) {
        const user = await UserModel.findByPk(userId)
        return user?.picture
    }
}

export default new UserService();