import KycDocumentModel from '../models/kyc-document.model';
import neeroService from './neeroService';
import { TypesKYCFile } from '@utils/constants';
import cloudinary from '@config/cloudinary';

class KYCService {
    async deleteKYC(publicId: string) {
        await cloudinary.uploader.destroy(publicId)
        await KycDocumentModel.destroy({
            where: {publicId: publicId}
        })
    }

    async checkKYCIsUploaded(userId: number) {
        const allKYCUsers = await KycDocumentModel.findAll({
            where: { 
                userId
            }
        })
        if (allKYCUsers.length === 5) return true
        else return false
    }

    async getRequiredKycDocuments(nationality: string = 'CM', partyType: string = 'PERSON') {
        return await neeroService.getRequiredDocuments(nationality, partyType);
    }

    async getKYCByType(userId: number, type: TypesKYCFile) {
        return KycDocumentModel.findAll({
            where: { 
                userId,
                type
            },
            attributes: ['url', 'userId']
        })
    }

    async getKycDocuments(userId: number) {
        return KycDocumentModel.findAll({
            where: { userId }
        })
    }

    async getKycDocumentByPublicId(publicId: string) {
        return KycDocumentModel.findOne({
            where: { publicId }
        })
    }

    async checkIsAllKycIsApprouved(userId: number, documentType: TypesKYCFile) {
        const allKYCUsers = await KycDocumentModel.findAll({
            where: { 
                userId,
                status: 'APPROVED',
                type: documentType
            }
        })
        if (allKYCUsers.length === 1) {
            return allKYCUsers[0].status === 'APPROVED'
        } else if (allKYCUsers.length === 2) {
            let x = 0
            allKYCUsers.map(k => {
                if (k.status === 'APPROVED') x++
            })
            return x === 2
        } else return false
    }
}

export default new KYCService();