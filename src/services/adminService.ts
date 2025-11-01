import KycDocumentModel from "@models/kyc-document.model";
import MerchantModel from "@models/merchant.model";
import RoleModel from "@models/role.model";
import UserRoleModel from "@models/user-role.model";
import UserModel from "@models/user.model";
import WalletModel from "@models/wallet.model";
import { generateCodeMerchant } from "@utils/functions";
import { UpdateOptions } from "sequelize";
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

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

        const result = await KycDocumentModel.findAndCountAll({
            where,
            include: [{ 
                model: UserModel, 
                as: 'user', 
                attributes: ['id', 'email', 'firstname', 'lastname'] 
            }],
            limit: limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']]
        });

        return result;
    }

    async getDocumentsPending(typeAccount: 'MERCHANT' | 'CUSTOMER', limit: number, startIndex:number) {
        const where: Record<string, any> = {};
        if (typeAccount) where.typeAccount = typeAccount;

        const result = await KycDocumentModel.findAndCountAll({
            where: { 
                status: 'PENDING', 
                ...where 
            },
            include: [{ 
                model: UserModel, 
                as: 'user', 
                attributes: ['id', 'email', 'firstname', 'lastname'] 
            }],
            limit,
            offset: startIndex,
            order: [['createdAt', 'DESC']]
        });

        return result;
    }

    async getUser(userId: number) {
        const user = await UserModel.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [{
                model: KycDocumentModel,
                as: 'kycDocuments',
                attributes: ['id', 'type', 'status', 'url']
            }]
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
        const cacheKey = `role:name:${name}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const role = await RoleModel.findOne({ where: { name } });

        if (role) {
            await redisClient.set(cacheKey, JSON.stringify(role), { EX: REDIS_TTL });
        }

        return role;
    }

    async getRoleById(id: number) {
        const cacheKey = `role:id:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const role = await RoleModel.findByPk(id);

        if (role) {
            await redisClient.set(cacheKey, JSON.stringify(role), { EX: REDIS_TTL });
        }
        return role;
    }

    async updateRole(roleId: number, updates: {name: string}) {
        const options: UpdateOptions = {
            where: { id: roleId },
            returning: true
        };
        return RoleModel.update(updates, options)
    }

    async getRoles() {
        const cacheKey = 'roles:all';
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const roles = await RoleModel.findAll();

        await redisClient.set(cacheKey, JSON.stringify(roles), { EX: REDIS_TTL });
        return roles;
    }

    async findWallet(matricule: string) {
        const wallet = await WalletModel.findOne({ where: { matricule } });
        return wallet;
    }

    async findRoleById(id: number) {
        const cacheKey = `roleById:${id}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const role = await RoleModel.findByPk(id);
        if (!role) throw new Error("Role introuvable");

        await redisClient.set(cacheKey, JSON.stringify(role), { EX: REDIS_TTL });
        return role;
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
        const cacheKey = `userByEmail:${email}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const user = await UserModel.findOne({ where: { email } });

        if (user) {
            await redisClient.set(cacheKey, JSON.stringify(user), { EX: REDIS_TTL });
        }
        return user;
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