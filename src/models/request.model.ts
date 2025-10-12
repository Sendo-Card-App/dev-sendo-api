import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute
} from 'sequelize';
import { typesDemande, TypesDemande, typesStatusDemande, TypesStatusDemande } from '@utils/constants';
import UserModel from './user.model';
import sequelize from '@config/db';

class RequestModel extends Model<
  InferAttributes<RequestModel>,
  InferCreationAttributes<RequestModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: number;
  declare type: TypesDemande;
  declare status: TypesStatusDemande;
  declare description: string | null;
  declare userId: ForeignKey<UserModel['id']>;
  declare reviewedById?: ForeignKey<UserModel['id']>;
  declare url: string | null;
  declare reason: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
}

RequestModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM(...typesDemande),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...typesStatusDemande),
      defaultValue: typesStatusDemande['1'],
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
    url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reason: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'requests',
    timestamps: true,
  }
);

export default RequestModel;