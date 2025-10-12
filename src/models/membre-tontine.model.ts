import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
  Association
} from 'sequelize';
import TontineModel from './tontine.model';
import CotisationModel from './cotisation.model';
import PenaliteModel from './penalite.model';
import TourDistributionModel from './tour-distribution.model';
import UserModel from './user.model';
import sequelize from '@config/db';

class MembreTontineModel extends Model<
  InferAttributes<MembreTontineModel>,
  InferCreationAttributes<MembreTontineModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare dateInscription: CreationOptional<Date>;
  declare role: 'ADMIN' | 'MEMBER';
  declare etat: 'ACTIVE' | 'SUSPENDED' | 'EXCLUDED' | 'PENDING' | 'REJECTED';
  declare tontineId: ForeignKey<TontineModel['id']>;
  declare userId: ForeignKey<UserModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare user?: NonAttribute<UserModel>;
  declare tontine?: NonAttribute<TontineModel>;
  declare cotisations?: NonAttribute<CotisationModel[]>;
  declare penalites?: NonAttribute<PenaliteModel[]>;
  declare toursDeDistribution?: NonAttribute<TourDistributionModel[]>;

  declare static associations: {
    cotisations: Association<MembreTontineModel, CotisationModel>;
    penalites: Association<MembreTontineModel, PenaliteModel>;
    toursDeDistribution: Association<MembreTontineModel, TourDistributionModel>;
    user: Association<MembreTontineModel, UserModel>;
    tontine: Association<MembreTontineModel, TontineModel>;
  };
}

MembreTontineModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dateInscription: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'MEMBER'),
      allowNull: false,
      defaultValue: 'MEMBER',
    },
    etat: {
      type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'EXCLUDED', 'PENDING', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    tontineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'membres_tontine',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'tontineId'], // Un utilisateur ne peut être membre qu'une fois par tontine
      },
    ],
  }
);

export default MembreTontineModel;