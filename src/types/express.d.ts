import { Result, ValidationError } from 'express-validator';
import UserModel from '@models/user.model';
import { File } from 'multer';
import RoleModel from '@models/role.model';

declare global {
  namespace Express {
    interface User extends UserModel {
      role?: RoleModel;
      kycStatus?: {
        verified: boolean;
        lastDocumentDate?: Date;
      };
    }

    interface Request {
      user?: User;
      deviceId?: string;
      validationErrors?: Result<ValidationError>;
      files?: File[];
      documents?: Array<{
        idDocumentNumber?: string;
        type: string;
        taxIdNumber?: string;
      }>;
    }
  }
}

type RoleType = 'SUPER_ADMIN' | 'SYSTEM_ADMIN' | 'COMPLIANCE_OFFICER' | 'TECHNICAL_DIRECTOR' | 'MANAGEMENT_CONTROLLER' | 'CUSTOMER_ADVISER' | 'CARD_MANAGER' | 'CUSTOMER';