import logger from "@config/logger";
import CodePhoneModel from "@models/code-phone.model";
import { PhoneNumberUserModel, TokenModel } from "@models/index.model";
import UserModel from "@models/user.model";
import { sendEmailVerificationSuccess, sendGlobalEmail } from "@services/emailService";
import { generateVerificationToken } from "@services/tokenService";
import { sendError, sendResponse } from "@utils/apiResponse";
import { typesToken } from "@utils/constants";
import { generateNumericCode } from "@utils/functions";
import { Request, Response } from "express";

interface OTPRequest {
    phone: string;
}
  
interface VerifyRequest {
    phone: string;
    code: string;
}

class OTPController {
    async sendOTP(req: Request, res: Response) {
        const { phone } = req.body as OTPRequest;
        if (!phone) {
            throw new Error('Phone number is required');
        }
        try {
            const user = await UserModel.findOne({
                where: {
                    phone: phone as string,
                }
            });
            if (!user) {
                return sendError(res, 404, 'Utilisateur non trouvé');
            }
            
            const verificationToken = generateVerificationToken();
            await TokenModel.create({
                token: verificationToken,
                userId: user.id,
                tokenType: typesToken['1']
            });

            const code = generateNumericCode(6)
            await CodePhoneModel.create({
                userId: user.id,
                phone: user.phone,
                code
            })
            
            await sendGlobalEmail(
                user.email,
                'Code de vérification',
                `Votre code de vérification est : ${code}`
            )
            //const status = await sendOTP(phone);
            logger.info('OTP envoyé', {
                phone: user.phone
            })

            sendResponse(res, 200, 'OTP envoyé avec succès', { success: true, status: true });
        } catch (error: any) {
            sendError(res, 500, 'Failed to send OTP', [error.message]);
        }
    }

    async sendOTPSecondPhone(req: Request, res: Response) {
        const { phone } = req.body as OTPRequest;
        if (!phone) {
            throw new Error('Phone number is required');
        }
        try {
            const phoneNumber = await PhoneNumberUserModel.findOne({
                where: {
                    phone: phone as string,
                },
                include: [{model: UserModel, as: 'user'}]
            });
            if (!phoneNumber) {
                return sendError(res, 404, 'Numéro non trouvé');
            }

            const verificationToken = generateVerificationToken();
            await TokenModel.create({
                token: verificationToken,
                userId: phoneNumber.user?.id,
                tokenType: typesToken['1']
            });

            const code = generateNumericCode(6)
            await CodePhoneModel.create({
                userId: phoneNumber?.user?.id,
                phone: phoneNumber?.phone,
                code
            })

            //const status = await sendOTP(phone);
            if (phoneNumber.user && phoneNumber.user.email) {
                await sendGlobalEmail(
                    phoneNumber.user.email,
                    'Code de vérification',
                    `Votre code de vérification est : ${code}`
                );
            } else {
                return sendError(res, 404, 'Utilisateur associé au numéro non trouvé');
            }

            logger.info('OTP envoyé', {
                phone: phoneNumber.phone,
                user: phoneNumber.user.firstname
            })

            sendResponse(res, 200, 'OTP envoyé avec succès', { success: true, status: true });
        } catch (error: any) {
            sendError(res, 500, 'Failed to send OTP', [error.message]);
        }
    }

    async verifyOTP(req: Request, res: Response) {
        const { phone, code } = req.body as VerifyRequest;
        if (!phone || !code) {
            throw new Error('Phone or code are required');
        }
        try {

            const user = await UserModel.findOne({
                where: { 
                  phone: phone as string,
                }
            });
            if (!user) {
                return sendError(res, 404, 'Utilisateur non trouvé');
            }

            const verificationToken = await TokenModel.findOne({
                where: { 
                    userId: user.id,
                    tokenType: typesToken['1']
                },
                order: [['createdAt', 'DESC']]
            });
        
            if (!verificationToken) {
                return sendError(res, 400, 'Token invalide');
            }

            const codePhone = await CodePhoneModel.findOne({
                where: { 
                    userId: user.id,
                    phone: user.phone
                },
                order: [['createdAt', 'DESC']]
            })

            if (phone !== user.phone) {
                return sendError(res, 400, 'Numéro de téléphone incorrect');
            }
            if (code !== codePhone?.code) {
                return sendError(res, 400, 'Code incorrect');
            }
            
            //const isValid = await verifyOTP(phone, code);
         
            user.isVerifiedPhone = true;
            user.isVerifiedEmail = true;
            await user.save();
            await verificationToken.destroy();
            await codePhone.destroy()
    
            logger.info('Numéro de téléphone du compte vérifié', {
                phone: user.phone
            })
        
            await sendGlobalEmail(
                user.email,
                'Vérification téléphone',
                `${user.firstname} votre numéro de téléphone sur Sendo a bien été vérifié`
            )
            sendResponse(res, 201, 'Compte vérifié avec succès', { success: true });
        } catch (error: any) {
            sendError(res, 500, 'Failed to verify OTP', [error.message]);
        }
    }

    async verifyOTPSecondPhone(req: Request, res: Response) {
        const { phone, code } = req.body as VerifyRequest;
        if (!phone || !code) {
            throw new Error('Phone or code are required');
        }
        try {

            const phoneNumber = await PhoneNumberUserModel.findOne({
                where: { 
                  phone: phone as string,
                },
                include: [{model: UserModel, as: 'user'}]
            });
            if (!phoneNumber || !phoneNumber.user) {
                return sendError(res, 404, 'Téléphone non trouvé');
            }

            const verificationToken = await TokenModel.findOne({
                where: { 
                  userId: phoneNumber.user.id,
                  tokenType: typesToken['1']
                },
                order: [['createdAt', 'DESC']]
            });
        
            if (!verificationToken) {
                return sendError(res, 400, 'Token invalide');
            }

            const codePhone = await CodePhoneModel.findOne({
                where: { 
                    userId: phoneNumber.user.id,
                    phone: phoneNumber.phone
                },
                order: [['createdAt', 'DESC']]
            })

            if (phone !== phoneNumber.phone) {
                return sendError(res, 400, 'Numéro de téléphone incorrect');
            }
            if (code !== codePhone?.code) {
                return sendError(res, 400, 'Code incorrect');
            }
            
            //const isValid = await verifyOTP(phone, code);
         
            phoneNumber.isVerified = true;
            await phoneNumber.save();
            await verificationToken.destroy();
            await codePhone.destroy();
    
            logger.info('Second numéro de téléphone vérifié', {
                phone: phoneNumber.phone,
                user: phoneNumber.user.firstname
            })
        
            await sendEmailVerificationSuccess(phoneNumber.user);
            sendResponse(res, 200, 'Numéro vérifié avec succès', { success: true });
        } catch (error: any) {
            sendError(res, 500, 'Failed to verify OTP', [error.message]);
        }
    }
}

export default new OTPController();