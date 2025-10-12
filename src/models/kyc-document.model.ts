import { Model, DataTypes, CreationOptional } from 'sequelize';
import UserModel from '@models/user.model';
import { TypesKYCFile, typesKYCFile, TypesKYCStatus, typesKYCStatus } from '@utils/constants';
import sequelize from '@config/db';

class KycDocumentModel extends Model {
  declare id: number;
  declare type: TypesKYCFile;
  declare status: TypesKYCStatus;
  declare url: string;
  declare publicId: string;
  declare idDocumentNumber: string;
  declare taxIdNumber: string;
  declare rejectionReason?: string;
  declare reviewedById?: number;
  declare reviewedAt?: Date;
  declare userId: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare reviewedBy?: UserModel;
  declare user?: UserModel;
}

KycDocumentModel.init(
  {
    type: {
      type: DataTypes.ENUM(...typesKYCFile),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...typesKYCStatus),
      defaultValue: typesKYCStatus['0'],
    },
    url: {
      type: DataTypes.STRING(512),
      allowNull: false,
      validate: { isUrl: true },
    },
    publicId: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    idDocumentNumber: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    taxIdNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: true,
    },
    rejectionReason: {
      type: DataTypes.STRING(255),
    },
    reviewedById: {
      type: DataTypes.INTEGER,
      references: { model: 'users', key: 'id' },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: 'kyc_documents',
    timestamps: true,
  }
);

export default KycDocumentModel;