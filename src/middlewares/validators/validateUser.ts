import { body, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { codePays } from '../../constants/index';
import { MobilePhoneLocale } from 'express-validator/lib/options';

// Étape 1 : Définir les validateurs
const userValidators: ValidationChain[] = [
  body('firstname').notEmpty().withMessage('Le prénom est requis'),
  body('lastname').notEmpty().withMessage('Le nom est requis'),
  body('email').isEmail().withMessage('Un email valide est requis'),
  body('phone').notEmpty()
  .isMobilePhone(['fr-CM', 'en-CA'])
  .withMessage('Numéro de téléphone invalide'),
  body('address').optional(),
  body('password').notEmpty()
  .isLength({ min: 8 })
  .withMessage('Le mot de passe doit contenir au moins 8 caractères'),
];

// Étape 2 : Middleware de gestion des erreurs
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): any => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 400,
      message: 'Erreur de validation',
      data: errors.array().map(err => ({
        field: err.type,
        message: err.msg
      }))
    });
  }
  next();
};

// Étape 3 : Exporter les middlewares combinés
export const validateUser = [...userValidators, handleValidationErrors];