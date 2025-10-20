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
import MembreTontineModel from './membre-tontine.model';
import sequelize from '@config/db';

class TourDistributionModel extends Model<
  InferAttributes<TourDistributionModel>,
  InferCreationAttributes<TourDistributionModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare numeroDistribution: CreationOptional<number>;
  declare dateDistribution: Date | null;
  declare montantDistribue: number | null;
  declare etat: 'SUCCESS' | 'PENDING' | 'BLOCKED';
  declare justificatif: string | null;
  declare tontineId: ForeignKey<TontineModel['id']>;
  declare beneficiaireId: ForeignKey<MembreTontineModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare tontine?: NonAttribute<TontineModel>;
  declare beneficiaire?: NonAttribute<MembreTontineModel>;

  declare static associations: {
    tontine: Association<TourDistributionModel, TontineModel>;
    beneficiaire: Association<TourDistributionModel, MembreTontineModel>;
  };
}

TourDistributionModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    numeroDistribution: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dateDistribution: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    montantDistribue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    etat: {
      type: DataTypes.ENUM('SUCCESS', 'PENDING', 'BLOCKED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    justificatif: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tontineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    beneficiaireId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'tours_distribution',
    timestamps: true,
  }
);

export default TourDistributionModel;