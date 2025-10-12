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
import MembreTontineModel from './membre-tontine.model';
import TontineModel from './tontine.model';
import TourDistributionModel from './tour-distribution.model';
import sequelize from '@config/db';

class CotisationModel extends Model<
  InferAttributes<CotisationModel>,
  InferCreationAttributes<CotisationModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare dateCotisation: CreationOptional<Date>;
  declare montant: number;
  declare methodePaiement: string | null;
  declare statutPaiement: 'VALIDATED' | 'PENDING' | 'REJECTED';
  declare justificatif: string | null;
  declare tourDistributionId: ForeignKey<TourDistributionModel['id']>;
  declare membreId: ForeignKey<MembreTontineModel['id']>;
  declare tontineId: ForeignKey<TontineModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare membre?: NonAttribute<MembreTontineModel>;
  declare tontine?: NonAttribute<TontineModel>;

  declare static associations: {
    membre: Association<CotisationModel, MembreTontineModel>;
    tontine: Association<CotisationModel, TontineModel>;
  };
}

CotisationModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dateCotisation: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    montant: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    methodePaiement: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'WALLET',
    },
    statutPaiement: {
      type: DataTypes.ENUM('VALIDATED', 'PENDING', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    justificatif: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tourDistributionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    membreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: 'cotisations',
    timestamps: true,
  }
);

export default CotisationModel;