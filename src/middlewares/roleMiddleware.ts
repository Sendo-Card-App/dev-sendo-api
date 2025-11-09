import { Request, Response, NextFunction } from 'express';
import { sendError } from '@utils/apiResponse';
import UserModel from '@models/user.model';
import { RoleType } from '../types/express';
import axios from 'axios';
import redisClient from '@config/cache';

const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;

export const hasRole = (requiredRoles: RoleType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Utilisateur non authentifié');
      }

      const cacheKey = `userRoles:${req.user.id}`;
      let userRoles: RoleType[] = [];

      const cachedRoles = await redisClient.get(cacheKey);
      if (cachedRoles) {
        userRoles = JSON.parse(cachedRoles);
      } else {
        const user = await UserModel.findByPk(req.user.id, {
          include: [{
            association: 'roles',
            attributes: ['name'],
            through: { attributes: [] }
          }]
        });

        if (!user?.roles?.length) {
          return sendError(res, 403, 'Aucun rôle attribué');
        }

        userRoles = user.roles.map(role => role.name.toUpperCase() as RoleType);
        await redisClient.set(cacheKey, JSON.stringify(userRoles), { EX: REDIS_TTL });
      }

      const hasPermission = requiredRoles.some(role => userRoles.includes(role));

      if (!hasPermission) {
        return sendError(res, 403, 'Permissions insuffisantes', {
          requiredRoles,
          currentRoles: userRoles
        });
      }

      next();
    } catch (error) {
      console.error('Error in role middleware:', error);
      sendError(res, 500, 'Erreur vérification des rôles');
    }
  };
};


interface Country {
  name: {
    common: string;
    official: string;
  }
}
export const checkCountry = (countries: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return sendError(res, 401, 'Utilisateur non authentifié');
      }

      // Récupération des pays valide via API externe
      const countriesFetched = await axios.get<Country[]>("https://restcountries.com/v3.1/all?fields=name");
      const validCountryNames = countriesFetched.data.map(country => country.name.common);

      // Récupérer l'utilisateur en base
      const user = await UserModel.findByPk(req.user.id);

      // Vérifier que user.country existe
      if (!user?.country) {
        return sendError(res, 403, "Pays de l'utilisateur non défini");
      }

      // Vérifier si le pays de l'utilisateur est dans la liste passée au middleware
      if (!countries.includes(user.country)) {
        return sendError(res, 403, "Pays utilisateur non autorisé", { userCountry: user.country, allowedCountries: countries });
      }

      // Vérifier si le pays de l'utilisateur est dans la liste des pays valides de l'API
      if (!validCountryNames.includes(user.country)) {
        return sendError(res, 403, "Pays utilisateur invalide selon l'API", { userCountry: user.country, validCountries: validCountryNames });
      }

      next();

    } catch (error) {
      console.error('Erreur dans checkCountry middleware:', error);
      sendError(res, 500, "Erreur lors de la vérification du pays");
    }
  }
}