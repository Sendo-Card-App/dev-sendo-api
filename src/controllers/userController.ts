import { Request, Response } from 'express';
import { sendResponse, sendError } from '@utils/apiResponse';
import userService from '@services/userService';
import logger from '@config/logger';
import { generatePassword } from '@utils/functions';
import { sendEmailVerification, sendGlobalEmail, sendPasswordModifiedMail, sendUserMail, sendUserMerchantMail, sendUserModifiedMail, successAddingSecondPhone } from '@services/emailService';
import { PaginatedData } from '../types/BaseEntity';
import adminService from '@services/adminService';
import authService from '@services/authService';
import { generateVerificationToken } from '@services/tokenService';
import TokenModel from '@models/token.model';
import { typesToken } from '@utils/constants';
import Expo from 'expo-server-sdk';
import CodePhoneModel from '@models/code-phone.model';
import UserModel from '@models/user.model';
import MerchantModel from '@models/merchant.model';


class UserController {
  async getUsers(req: Request, res: Response) {
    const { country, page, limit, startIndex, search } = res.locals.pagination;
    try {
      const users = await userService.getAllUsers(country, search, limit, startIndex);
      const totalItems = Number(users.count);
      const limitNum = Number(limit);
      const totalPages = Math.ceil(totalItems / limitNum);
      
      const responseData: PaginatedData = {
        page,
        totalPages,
        totalItems: users.count,
        items: users.rows,
      };

      sendResponse(res, 200, 'Utilisateurs récupérés', responseData);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async createUser(req: Request, res: Response) {
    const { 
      firstname, 
      lastname, 
      email, 
      phone, 
      country,
      address, 
      roleId, 
      dateOfBirth, 
      placeOfBirth,
      typeMerchantAccount 
    } = req.body;
    const password = generatePassword()
    
    if (
      !firstname || 
      !lastname || 
      !email || 
      !phone || 
      !country ||
      !address || 
      !roleId || 
      !dateOfBirth || 
      !placeOfBirth
    ) {
      sendError(res, 500, 'Veuillez fournir tous les champs');
    }
    const newUser = {
      firstname,
      lastname,
      email,
      password,
      phone,
      country,
      address,
      dateOfBirth,
      placeOfBirth
    };
    
    try {
      const user = await authService.register(newUser);
      if (user) {
        const roleParsed = parseInt(roleId)
        if (roleParsed < 8) {
          await adminService.attributeRoleUser(user.id, roleParsed)
        } else if (roleParsed === 9 && typeMerchantAccount) {
          await adminService.createMerchant(
            user.id, 
            typeMerchantAccount as 'Particulier' | 'Entreprise'
          )
          await sendUserMerchantMail(user, password, typeMerchantAccount)
        } else if (roleParsed !== 9) {
          await sendUserMail(user, password);
        }
        

        // Génération du token de vérification
        const verificationToken = generateVerificationToken();
        await TokenModel.create({
          token: verificationToken,
          userId: user.id,
          tokenType: typesToken['1']
        });

        // Envoi email de vérification
        await sendEmailVerification(user.email, verificationToken)
      } else {
        throw new Error('Erreur lors de la création du user')
      }

      logger.info("Nouvel user créé avec le nom : ", {
        user: `${user.firstname} ${user.lastname}`
      });

      sendResponse(res, 201, 'Utilisateur créé', user);
    } catch (error: any) {
      sendError(res, 400, 'Erreur de création', [error.message]);
    }
  }

  async getUserById(req: Request, res: Response) {
    const { id } = req.params
    if (!id) {
      sendError(res, 500, 'Veuillez fournir le user ID');
    }
    try {
      const user = await userService.getMe(parseInt(id))
      sendResponse(res, 200, 'Utilisateur récupéré', user)
    } catch (error: any) {
      sendError(res, 400, 'Erreur de la récupération du user', [error.message]);
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      if (!req.user || typeof req.user.id !== 'number') {
        return sendError(res, 400, 'Utilisateur non authentifié ou ID invalide');
      }
      
      let user: UserModel | MerchantModel | null;
      if (req.user.roles?.some(role => role.name === 'MERCHANT')) {
        user = await userService.getMerchant(req.user.id);
      } else {
        user = await userService.getMe(req.user.id);
      }
      
      if (!user) {
        return sendError(res, 404, 'Utilisateur non trouvé');
      }
  
      sendResponse(res, 200, 'Utilisateur récupéré', user);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const user = await userService.getUserById(parseInt(req.params.id));
      
      if (!user) {
        return sendError(res, 404, 'Utilisateur non trouvé');
      }

      const deletedUser = await userService.deleteUserById(parseInt(req.params.id));

      logger.info("Utilisateur supprimé du système : ", {
        user: `User ID : ${user.id} - ${user.firstname} ${user.lastname}`
      });
      
      sendResponse(res, 200, 'Utilisateur supprimé', deletedUser);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const userUpdated = await userService.updateUser(parseInt(req.params.id), req.body);
      await sendUserModifiedMail(userUpdated);

      logger.info("Utilisateur modifié du système : ", {
        user: `User ID : ${userUpdated.id} - ${userUpdated.firstname} ${userUpdated.lastname}`
      });
      
      sendResponse(res, 200, 'Utilisateur modifié avec succès', userUpdated);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async updatePassword(req: Request, res: Response) {
    try {
      const updatedUserPassword = await userService.updatePassword(parseInt(req.params.id), req.body);
      await sendPasswordModifiedMail(updatedUserPassword.email);

      logger.info("L'utilisateur a modifié son password : ", {
        user: `${updatedUserPassword.firstname} ${updatedUserPassword.lastname}`
      });
      
      sendResponse(res, 200, 'Mot de passe modifié avec succès', updatedUserPassword);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async addSecondPhoneNumberUser(req: Request, res: Response) {
    const { phone } = req.body
    try {
      if (!req.user || typeof req.user.id !== 'number') {
        return sendError(res, 400, 'Utilisateur non authentifié ou ID invalide');
      }
      if (!phone) {
        return sendError(res, 400, 'Veuillez fournir le phone');
      }
      const phoneNumber = await userService.addSecondPhoneNumberUser(phone, req.user?.id)
      await successAddingSecondPhone(req.user, phoneNumber.phone)

      logger.info("Numéro de téléphone ajouté au compte : ", {
        user: `${req.user.firstname} ${req.user.lastname}`,
        phone: phoneNumber.phone
      });

      sendResponse(res, 201, 'Second numéro de téléphone ajouté au profil', phoneNumber)
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async uploadPicture(req: Request, res: Response) {
    try {
      const file = req.file as Express.Multer.File;
      
      if (!req.user) throw new Error('Utilisateur non authentifié');
      
      if (!file) {
        throw new Error('Aucun document fourni');
      }
      const user = await userService.updateUser(req.user.id, {picture: file.path})

      logger.info("Photo de profil modifiée", {
        user: `${req.user.firstname} ${req.user.lastname}`,
        picture: user.picture
      });
      
      sendResponse(res, 201, 'Picture envoyé avec succès', {
        url: user.picture
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur envoie picture', [error.message]);
    }
  } 

  async getKYCUser(req: Request, res: Response) {
    const { id } = req.params
    try {
      if (!id) {
        throw new Error('ID de l\'utilisateur obligatoire');
      }
      const user = await userService.getUserById(parseInt(id))
      if (!user) {
        throw new Error('Utilisateur introuvable')
      }
      const kycDocumentsUser = await userService.getKYCDocumentsUser(parseInt(id));
      sendResponse(res, 200, 'Documents KYC de l\'user récupérés avec succès', {
        kyc: kycDocumentsUser,
        user
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur de récupération KYC documents de l\'user', [error.message]);
    }
  }

  async addPasscodeUser(req: Request, res: Response) {
    const { passcode } = req.body
    if (!passcode || passcode.length < 4) {
      throw new Error('Veuillez fournir le passcode de 4 chiffres')
    }
    try {
      if (!req.user?.id) {
        throw new Error('Utilisateur non authentifié ou ID invalide');
      }
      await userService.addPasscodeUser(req.user.id, passcode);
      sendResponse(res, 200, 'Passcode ajouté au compte avec succès')
    } catch (error: any) {
      sendError(res, 500, 'Erreur d\'ajout du passcode', [error.message]);
    }
  }

  async updatePasscodeUser(req: Request, res: Response) {
    const { passcode, code } = req.body
    if (!passcode || passcode.length < 4) {
      throw new Error('Veuillez fournir le passcode de 4 chiffres')
    }
    if (!code) {
      throw new Error('Veuillez fournir le code OTP')
    }

    try {
      if (!req.user?.id) {
        throw new Error('Utilisateur non authentifié ou ID invalide');
      }

      const codePhone = await CodePhoneModel.findOne({
        where: { 
          userId: req.user.id,
          phone: req.user.phone
        },
        order: [['createdAt', 'DESC']]
      })

      if (req.user.phone !== codePhone?.phone) {
        return sendError(res, 400, 'Numéro de téléphone incorrect');
      }
      if (code !== codePhone?.code) {
        return sendError(res, 400, 'Code incorrect');
      }

      await userService.addPasscodeUser(req.user.id, passcode);
      codePhone.destroy()
      
      sendResponse(res, 200, 'Passcode modifié avec succès', {})
    } catch (error: any) {
      sendError(res, 500, 'Erreur de modification du passcode', [error.message]);
    }
  }

  async simulatePayment(req: Request, res: Response) {
    const { amount, currency } = req.body
    if (!amount || !currency) {
      throw new Error('Veuillez fournir le montant et la monnaie')
    }
    try {
      const simulation = await userService.simulatePayment(currency);

      if (
        simulation.currencyValue === undefined ||
        simulation.sendoFees === undefined ||
        simulation.partnerVisaFees === undefined
      ) {
        throw new Error('Simulation data is incomplete');
      }

      const amountConverted = amount * simulation.currencyValue;
      const sendoFees = (amountConverted * simulation.sendoFees) / 100;
      const partnerVisaFees = (amountConverted * simulation.partnerVisaFees) / 100;
      const totalAmount = amountConverted + partnerVisaFees + sendoFees;

      sendResponse(res, 200, 'Resultat simulation', {
        fees: {
          percentagePartnerFees: simulation.partnerVisaFees,
          percentageSendoFees: simulation.sendoFees,
          currencyValue: simulation.currencyValue
        },
        result: {
          amountConverted,
          partnerVisaFees,
          sendoFees,
          totalAmount
        }
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur lors de la simulation', [error.message]);
    }
  }

  async getTokenExpoUser(req: Request, res: Response) {
    const { userId } = req.params
    try {
      if (!userId) {
        throw new Error('Veuillez fournir l\'id du user')
      }
      const token = await userService.getTokenExpoUser(parseInt(userId))
      sendResponse(res, 200, 'Token Expo récupéré', token)
    } catch (error: any) {
      sendError(res, 500, 'Erreur lors de la recuperation du token expo', [error.message]);
    }
  }

  async saveOrUpdateTokenExpoUser(req: Request, res: Response) {
    const { token, userId } = req.body
    try {
      if (!userId || !token) {
        throw new Error('Veuillez fournir l\'id du user et le token')
      }
      // Vérifier que le token est un token Expo valide
      if (!Expo.isExpoPushToken(token)) {
        return sendError(res, 400, 'Le token fourni n\'est pas un token Expo valide');
      }
      
      const data = {
        token,
        tokenType: typesToken['4'],
        userId: parseInt(userId)
      }
      const tokenCreated = await userService.saveOrUpdateTokenExpoUser(data)
      sendResponse(res, 200, 'Token Expo récupéré ou créé avec succès', tokenCreated)
    } catch (error: any) {
      sendError(res, 500, 'Erreur lors de l\'enregistrement ou la mise à jour du token', [error.message]);
    }
  }

  async checkPincode(req: Request, res: Response) {
    const { pincode } = req.params
    try {
      if (!pincode) {
        return sendError(res, 403, 'Veuillez fournir le pincode')
      }

      if (!req.user || typeof req.user.id !== 'number') {
        return sendError(res, 400, 'Utilisateur non authentifié ou ID invalide');
      }

      if (!req.user.passcode || req.user.passcode === '' || req.user.passcode === null) {
        return sendError(res, 403, 'Aucun pincode défini pour cet utilisateur');
      }

      const checkPincode = await userService.checkPinCode(req.user.id, pincode)
      if (!checkPincode) {
        return sendError(res, 403, 'Pincode incorrect', { pincode: false });
      }
      sendResponse(res, 200, 'Pincode vérifié avec succès', { pincode: true });
    } catch (error: any) {
      sendError(res, 500, 'Erreur lors de la vérification du pincode', [error.message]);
    }
  }

  async getPictureUser(req: Request, res: Response) {
    const { id } = req.params
    
    try {
      if (!id) {
        sendError(res, 500, 'Veuillez fournir le user ID');
      }
      const picture = await userService.getPictureUser(Number(id))
      sendResponse(res, 200, 'Photo de profil retournée', { link: picture })
    } catch (error: any) {
      sendError(res, 500, 'Erreur lors de la récupération de la picture du user', [error.message]);
    }
  }

  async getMerchants(req: Request, res: Response) {
    const { status, page, limit, startIndex } = res.locals.pagination;
    try {
      const merchants = await userService.getAllMerchants(limit, startIndex, status);
      const totalItems = Number(merchants.count);
      const limitNum = Number(limit);
      const totalPages = Math.ceil(totalItems / limitNum);

      const responseData: PaginatedData = {
        page,
        totalPages,
        totalItems: merchants.count,
        items: merchants.rows
      };
      sendResponse(res, 200, 'Marchands récupérés', responseData);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async getMerchantById(req: Request, res: Response) {
    const { id } = req.params
    if (!id) {
      sendError(res, 500, 'Veuillez fournir le merchant ID');
    }
    try {
      const merchant = await userService.getMerchantByUserId(Number(id))
      sendResponse(res, 200, 'Marchand récupéré', merchant)
    } catch (error: any) {
      sendError(res, 400, 'Erreur de la récupération du marchand', [error.message]);
    }
  }

  async updateStatusMerchant(req: Request, res: Response) {
    const { id, status } = req.query
    if (!id || !status) {
      sendError(res, 500, 'Veuillez fournir le merchant ID et le nouveau status');
    }
    try {
      const merchantUpdated = await userService.updateStatusMerchant(Number(id), status as 'ACTIVE' | 'REFUSED')
      
      await sendGlobalEmail(
        merchantUpdated.user!.email,
        'Status de votre compte',
        `<h4>Voici le nouveau status de votre compte :</h4>
        <p>Status : <b>${merchantUpdated.status}</b></p>`
      )

      logger.info("Status du marchant mis à jour", {
        merchant: `Merchant ID : ${merchantUpdated.id} - ${merchantUpdated.user!.firstname} ${merchantUpdated.user!.lastname}`,
        status: `${merchantUpdated.status}`,
        admin: req.user ? `Admin ID : ${req.user.id} - ${req.user.firstname} ${req.user.lastname}` : 'Utilisateur non trouvé'
      });

      sendResponse(res, 200, 'Statut du marchand modifié avec succès', merchantUpdated)
    } catch (error: any) {
      sendError(res, 400, 'Erreur de la modification du statut du marchand', [error.message]);
    }
  }
}

export default new UserController();