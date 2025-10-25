import KycDocumentModel from "@models/kyc-document.model";
import MerchantModel from "@models/merchant.model";
import RoleModel from "@models/role.model";
import UserRoleModel from "@models/user-role.model";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";
import { generateCodeMerchant } from "@utils/functions";
import { UpdateOptions } from "sequelize";

class AdminService {
    private static instance: AdminService;
    
    private constructor() {}
    
    public static getInstance(): AdminService {
        if (!AdminService.instance) {
            AdminService.instance = new AdminService();
        }
        return AdminService.instance;
    }

    async getAllDocuments(typeAccount: 'MERCHANT' | 'CUSTOMER', status: string, limit: number, startIndex: number) {
        const where: Record<string, any> = {};
        if (status) where.status = status;
        if (typeAccount) where.typeAccount = typeAccount;
        
        return await KycDocumentModel.findAndCountAll({
            where,
            include: [
                { 
                    association: 'user', 
                    attributes: ['id', 'email', 'firstname', 'lastname'] 
                }
            ],
            limit: limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']]
        });
    }
    
    async getDocumentsPending(typeAccount: 'MERCHANT' | 'CUSTOMER', limit: number, startIndex:number) {
        const where: Record<string, any> = {};
        if (typeAccount) where.typeAccount = typeAccount;

        return await KycDocumentModel.findAndCountAll({
            where: { 
                status: 'PENDING',
                ...where
            },
            include: [
                { 
                    association: 'user', 
                    attributes: ['id', 'email', 'firstname', 'lastname'] 
                }
            ],
            limit: limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']]
        });
    }

    async getUser(userId: number) {
        const user = await UserModel.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: KycDocumentModel,
                    as: 'kycDocuments',
                    attributes: ['id', 'type', 'status', 'url']
                }
            ]
        });
        return user;
    } 

    async getSingleUser(userId: number) {
        const user = await UserModel.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });
        return user;
    } 
    
    async createRole(name: string) {
        return await RoleModel.create({ name })
    }

    async getRole(name: string) {
        return RoleModel.findOne({
            where: {
                name: name
            }
        })
    }

    async getRoleById(id: number) {
        return RoleModel.findByPk(id)
    }

    async updateRole(roleId: number, updates: {name: string}) {
        const options: UpdateOptions = {
            where: { id: roleId },
            returning: true
        };
        return RoleModel.update(updates, options)
    }

    async getRoles() {
        return RoleModel.findAll();
    }

    async findWallet(matricule: string) {
        return WalletModel.findOne({
            where: {matricule: matricule}
        })
    }

    async findRoleById(id: number) {
        const role = await RoleModel.findByPk(id)
        if (!role) {
            throw new Error("Role introuvable")
        }
        return role
    }

    async attributeRoleUser(userId: number, roleId: number) {
        return UserRoleModel.create({
            userId: userId,
            roleId: roleId
        })
    }

    async removeRoleUser(userId: number, roleId: number) {
        return UserRoleModel.destroy({
            where: {
                userId: userId,
                roleId: roleId
            }
        })
    }

    async findUserByEmail(email: string) {
        return UserModel.findOne({
            where: {email: email}
        })
    }

    async createMerchant(userId: number, typeAccount: 'Particulier' | 'Entreprise') {
        const merchant = await MerchantModel.create({
            userId,
            typeAccount,
            status: 'PENDING',
            code: generateCodeMerchant()
        });
        return merchant;
    }
}

export default AdminService.getInstance();