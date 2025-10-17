import UserModel from "@models/user.model";
import { UserCreate } from "../types/User";
import { RoleModel, TokenModel, WalletModel } from "@models/index.model";
import { Op } from "sequelize";

class AuthService {
   
    async register(user: UserCreate) {
        const existingUser = await UserModel.findOne({
            where: {
                [Op.or]: [
                    { email: user.email },
                    { phone: user.phone }
                ]
            }
        });
    
        if (existingUser) {
            throw new Error(existingUser.email === user.email ? 
                'Email déjà utilisé' : 'Numéro de téléphone déjà enregistré');
        }
    
        const userCreated = await UserModel.create(user);

        const userFounded = await UserModel.findByPk(userCreated.id, {
            include: [
                { 
                    model: WalletModel, 
                    as: 'wallet', 
                    attributes: ['id', 'balance', 'status', 'matricule']
                }
            ]
        })
        return userFounded
    }
  

    async login(email: string | undefined, phone: string | undefined) {
        const where: Record<string, any> = {};
        if (email) {
            where.email = email;
        }
        if (phone) {
            where.phone = phone;
        }
        return UserModel.findOne({ 
            where,
            attributes: ['id', 'email', 'phone', 'password', 'isVerifiedEmail', 'isVerifiedPhone']
        });
    } 

    async refreshToken(refreshToken: string, deviceId: string) {
        return TokenModel.findOne({ 
            where: { 
                deviceId 
            },
            include: [UserModel]
        });
    }

    async logout(userId: number, deviceId: string) {
        return TokenModel.destroy({ 
            where: { 
                userId,
                deviceId 
            } 
        });
    }

    async logoutAllDevices(userId: number) {
        return TokenModel.destroy({ 
            where: { 
                userId: userId 
            } 
        });
    }
}

export default new AuthService();