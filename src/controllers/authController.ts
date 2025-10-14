import { sendError, sendResponse } from "@utils/apiResponse";
import { Request, Response } from 'express';
import authService from "@services/authService";
import logger from "@config/logger";
import { generateTokens, verifyToken } from "@config/jwt";
import { TokenModel, UserModel, WalletModel } from "@models/index.model";
import { v4 as uuidv4 } from 'uuid';
import { generateVerificationToken } from '@services/tokenService';
import { typesStatusUser, typesToken } from "@utils/constants";
import { sendEmailVerification, sendEmailVerificationSuccess, sendGlobalEmail, sendPasswordResetEmail, successCreatingAccount, successCreatingAccountWithYourRefferalCode } from "@services/emailService";
import userService from "@services/userService";
import configService from "@services/configService";
import walletService from "@services/walletService";
import { generateNumericCode } from "@utils/functions";
import CodePhoneModel from "@models/code-phone.model";

class AuthController {
  async createUser(req: Request, res: Response) {
    const { 
      firstname, 
      lastname, 
      email, 
      password, 
      phone, 
      address, 
      referralCode, 
      country,
      dateOfBirth, 
      placeOfBirth 
    } = req.body;
    
    try {
      if (
        !firstname || 
        !lastname || 
        !email || 
        !password || 
        !phone || 
        !country ||
        !address || 
        !dateOfBirth || 
        !placeOfBirth
      ) {
        return sendError(res, 400, 'Tous les champs obligatoires doivent être remplis');
      }

      let referredByUserId = null;
      let referrer = null;
      if (referralCode) {
        referrer = await userService.getUserReferralCode(referralCode)
        if (referrer) {
          referredByUserId = referrer.id;
        } else {
          return sendError(res, 400, 'Code de parrainage invalide');
        }
      }

      const user = await authService.register({
        firstname,
        lastname,
        email,
        phone,
        address,
        password,
        referredBy: referredByUserId,
        country,
        dateOfBirth,
        placeOfBirth
      });

      if (user) {
        if (referrer) {
          const config = await configService.getConfigByName("SPONSORSHIP_FEES")
          if (referrer.wallet?.matricule && config && user.wallet?.matricule) {
            await walletService.creditWallet(referrer.wallet.matricule, config?.value, "SPONSORSHIP_FEES");
            await walletService.creditWallet(user.wallet.matricule, config?.value, "SPONSORSHIP_FEES");
            await successCreatingAccountWithYourRefferalCode(referrer, user, config.value);
          } else {
            throw new Error("Portefeuille du refferer introuvable");
          }
        }
        
        const code = generateNumericCode(6)
        await CodePhoneModel.create({
          userId: user.id,
          phone: user.phone,
          code
        })
        await successCreatingAccount(user, code)

        logger.info("Nouvel utilisateur créé", { user: user.firstname+' '+user.lastname });
      }

      // Génération du token de vérification
      const verificationToken = generateVerificationToken();
      await TokenModel.create({
        token: verificationToken,
        userId: user?.id,
        tokenType: typesToken['1']
      });
      
      sendResponse(res, 201, 'Utilisateur créé - Vérifiez votre email', user);
    } catch (error: any) {
      if (error.name === 'SequelizeValidationError') {
        const messages = error.errors.map((err: any) => err.message);
        return sendError(res, 400, 'Erreur de validation', messages);
      }
      
      if (error.message.includes('déjà')) {
        return sendError(res, 409, error.message);
      }
  
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    try {
      const user = await authService.login(email, undefined);
      if (!user) {
        return sendError(res, 404, 'Utilisateur non trouvé');
      }

      if (!await user.comparePassword(password)) {
        return sendResponse(res, 401, 'Identifiants invalides');
      }

      if (!user.isVerifiedEmail) {
        return sendError(res, 403, 'Compte non vérifié');
      }

      if (user.status === typesStatusUser['1']) {
        return sendError(res, 403, 'Compte suspendu');
      }

      const deviceId = uuidv4();
      const tokens = generateTokens({ 
        id: user.id,
        deviceId
      });

      await TokenModel.create({
        userId: user.id,
        token: tokens.refreshToken,
        deviceId,
        tokenType: typesToken['0']
      });

      sendResponse(res, 200, 'Connexion réussie', {
        accessToken: tokens.refreshToken,
        deviceId
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async loginWithPhone(req: Request, res: Response): Promise<void> {
    const { phone, password } = req.body;
    try {
      const user = await authService.login(undefined, phone);
      if (!user) {
        return sendError(res, 404, 'Utilisateur non trouvé');
      }

      if (!await user.comparePassword(password)) {
        return sendResponse(res, 401, 'Identifiants invalides');
      }

      if (!user.isVerifiedPhone) {
        return sendError(res, 403, 'Compte non vérifié');
      }

      if (user.status === typesStatusUser['1']) {
        return sendError(res, 403, 'Compte suspendu');
      }

      const deviceId = uuidv4();
      const tokens = generateTokens({ 
        id: user.id,
        deviceId
      });

      await TokenModel.create({
        userId: user.id,
        token: tokens.refreshToken,
        deviceId,
        tokenType: typesToken['0']
      });

      sendResponse(res, 200, 'Connexion réussie', {
        accessToken: tokens.refreshToken,
        deviceId
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async loginWithPasscode(req: Request, res: Response): Promise<void> {
    const { passcode } = req.body;
    try {
      if (!req.user) {
        return sendError(res, 401, 'Utilisateur non authentifié');
      }
      const user = await userService.getUserById(req.user.id);
      if (!user) {
        return sendError(res, 404, 'Utilisateur non trouvé');
      }
      
      if (!user.passcode) {
        return sendError(res, 403, 'Passcode manquant sur le user');
      }

      if (user.passcode != passcode) {
        return sendError(res, 401, 'Passcode incorrect');
      }

      if (!user.isVerifiedEmail || !user.isVerifiedPhone) {
        return sendError(res, 403, 'Compte non vérifié');
      }

      if (user.status === typesStatusUser['1']) {
        return sendError(res, 403, 'Compte suspendu');
      }

      sendResponse(res, 200, 'Connexion réussie', true);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken, deviceId } = req.body;
  
    try {
      verifyToken(refreshToken) as { id: number, deviceId: string };
      
      const token = await TokenModel.findOne({
        where: { 
          token: refreshToken,
          deviceId,
          tokenType: typesToken['0']
        },
        include: [{
          model: UserModel,
          as: 'user'
        }]
      });
  
      if (!token?.user) {
        await TokenModel.destroy({ where: { token: refreshToken } });
        return sendError(res, 401, 'Session invalide');
      }
  
      const newTokens = generateTokens({ 
        id: token.user.id,
        deviceId 
      });
  
      token.token = newTokens.refreshToken;
      await token.save();
  
      sendResponse(res, 200, 'Tokens actualisés', {
        accessToken: newTokens.refreshToken,
      });
    } catch (error: any) {
      sendError(res, 401, 'Session expirée', [error.message]);
    }
  }

  async logout(req: Request, res: Response) {
    const { deviceId } = req.body;
    if (!req.user) {
      return sendError(res, 401, 'Utilisateur non authentifié');
    }
    const userId = req.user.id;
  
    try {
      const response = await TokenModel.destroy({ 
        where: { 
          userId, 
          deviceId,
          tokenType: typesToken['0']
        } 
      });
      
      sendResponse(res, 204, 'Déconnexion réussie', response);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }
  
  async logoutAllDevices(req: Request, res: Response) {
    if (!req.user) {
      return sendError(res, 401, 'Utilisateur non authentifié');
    }
    
    try {
      const response = await TokenModel.destroy({ 
        where: { 
          userId: req.user.id,
          tokenType: typesToken['0']
        } 
      });
      
      sendResponse(res, 204, 'Déconnexion globale réussie', response);
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async sendEmailAccount(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) sendError(res, 400, 'Email manquant');
    try {
      const user = await userService.getUserByEmail(email)
      if (!user) {
        sendError(res, 404, 'Utilisateur introuvable');
      } else {
        // Génération du token de vérification
        const verificationToken = generateVerificationToken();
        await TokenModel.create({
          token: verificationToken,
          userId: user.id,
          tokenType: typesToken['1']
        });

        // Envoi email de vérification
        await sendEmailVerification(user.email, verificationToken)
        sendResponse(res, 200, 'Email envoyé');
      }
    } catch (error: any) {
      sendError(res, 500, 'Erreur d\'envoi de mail', [error.message]);
    }
  }

  async verifyAccount(req: Request, res: Response) {
    const { token } = req.query;
    
    try {
      if (!token) {
        //sendError(res, 400, 'Token manquant');
        return res.status(400).render('verification-result', {
          message: 'Token manquant',
          status: 400
        })
      }
      const verificationToken = await TokenModel.findOne({
        where: { 
          token: token as string,
          tokenType: typesToken['1']
        }
      });

      if (!verificationToken) {
        //return sendError(res, 400, 'Token invalide');
        return res.status(400).render('verification-result', {
          message: 'Token invalide',
          status: 404
        })
      }

      const user = await UserModel.findByPk(verificationToken.userId);
      if (!user) {
        //return sendError(res, 404, 'Utilisateur non trouvé');
        return res.status(404).render('verification-result', {
          message: 'Utilisateur non trouvé',
          status: 404
        })
      }

      user.isVerifiedEmail = true;
      await user.save();
      await verificationToken.destroy();

      logger.info('Adresse email du compte vérifié', {
        email: user.email
      })

      await sendEmailVerificationSuccess(user);
      //sendResponse(res, 200, 'Adresse email du compte vérifié avec succès');
      return res.status(200).render('verification-result', { 
        message: `<h4>Bonjour ${user.firstname} ${user.lastname}</h4>
        <p>Votre compte a été vérifié avec succès</p>`,
        status: 200
      });
    } catch (error: any) {
      sendError(res, 500, 'Erreur de vérification', [error.message]);
    }
  }

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    try {
      const user = await UserModel.findOne({ where: { email } });
      if (!user) return sendResponse(res, 200, 'Si l\'email existe, un lien sera envoyé');

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
      
      sendResponse(res, 200, 'Code de vérification envoyé');
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async forgotPasswordAdmin(req: Request, res: Response) {
    const { email } = req.body;

    try {
      const user = await UserModel.findOne({ where: { email } });
      if (!user) return sendResponse(res, 200, 'Si l\'email existe, un lien sera envoyé');

      const resetToken = generateVerificationToken();
      await TokenModel.create({
        token: resetToken,
        userId: user.id,
        tokenType: typesToken['2']
      });

      await sendPasswordResetEmail(user.email, resetToken);
      
      sendResponse(res, 200, 'Lien de réinitialisation envoyé');
    } catch (error: any) {
      sendError(res, 500, 'Erreur serveur', [error.message]);
    }
  }

  async resetPassword(req: Request, res: Response) {
    const { code, newPassword } = req.body;
    
    try {
      const codePhone = await CodePhoneModel.findOne({
        where: { code },
        include: [{
          model: UserModel,
          as: 'user'
        }],
        order: [['createdAt', 'DESC']]
      })

      if (!codePhone) {
        return sendError(res, 400, 'Code incorrect');
      }

      let user = null;
      if (codePhone.user) {
        user = await userService.getUser(codePhone.user.id);
        if (user) {
          user.password = newPassword;
          await user.save();
        }

        await sendGlobalEmail(
          codePhone.user.email,
          'Modification mot de passe Sendo',
          `Votre mot de passe Sendo vient d'être modifié`
        )
      }
      
      await codePhone.destroy();

      sendResponse(res, 200, 'Mot de passe mis à jour');
    } catch (error: any) {
      sendError(res, 500, 'Erreur de mise à jour', [error.message]);
    }
  }

  async resetPasswordAdmin(req: Request, res: Response) {
    const { token, newPassword } = req.body;
    
    try {
      const tokenEntry = await TokenModel.findOne({
        where: { 
          token,
          tokenType: typesToken['2']
        },
        include: [{
          model: UserModel,
          as: 'user'
        }]
      });

      if (!tokenEntry?.user) {
        return sendError(res, 400, 'Token invalide');
      }

      const user = await userService.getUser(tokenEntry.user.id)
      if (user) {
        user.password = newPassword;
        await user?.save();
      }

      if (tokenEntry.user) {
        await sendGlobalEmail(
          tokenEntry.user.email,
          'Modification mot de passe Sendo',
          `Votre mot de passe Sendo vient d'être modifié`
        )
      }
      
      await tokenEntry.destroy();

      sendResponse(res, 200, 'Mot de passe mis à jour');
    } catch (error: any) {
      sendError(res, 500, 'Erreur de mise à jour', [error.message]);
    }
  }

  async verifyToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return sendError(res, 401, 'Token manquant');

      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token) as { id: number; deviceId: string };

      const tokenEntry = await TokenModel.findOne({
        where: {
          userId: decoded.id,
          deviceId: decoded.deviceId,
          tokenType: typesToken['0'],
        },
        include: [{
          model: UserModel,
          as: 'user',
          include: [{ model: WalletModel, as: 'wallet' }],
        }],
      });

      if (!tokenEntry?.user) return sendError(res, 401, 'Session invalide');

      if (!tokenEntry.user.isVerifiedEmail)
        return sendError(res, 403, 'Email non vérifié');

      if (tokenEntry.user.status !== 'ACTIVE')
        return sendError(res, 403, 'Compte suspendu ou bloqué');

      return sendResponse(res, 200, 'Utilisateur authentifié', {
        user: tokenEntry.user,
        deviceId: decoded.deviceId,
      });
    } catch (err: any) {
      return sendError(res, 401, 'Token invalide', [err.message]);
    }
  }
}

export default new AuthController();