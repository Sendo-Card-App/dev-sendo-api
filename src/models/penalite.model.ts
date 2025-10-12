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
import CotisationModel from './cotisation.model';
import sequelize from '@config/db';

class PenaliteModel extends Model<
  InferAttributes<PenaliteModel>,
  InferCreationAttributes<PenaliteModel, { omit: 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'lastChecked' }>
> {
  declare id: CreationOptional<number>;
  declare type: 'RETARD' | 'ABSENCE' | 'AUTRE';
  declare montant: number;
  declare description: string | null;
  declare statut: 'PAID' | 'UNPAID';
  declare membreId: ForeignKey<MembreTontineModel['id']>;
  declare cotisationId?: ForeignKey<CotisationModel['id']>;
  declare tontineId: ForeignKey<TontineModel['id']>;
  declare retryCount: number;
  declare lastChecked: Date;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare membre?: NonAttribute<MembreTontineModel>;
  declare tontine?: NonAttribute<TontineModel>;

  declare static associations: {
    membre: Association<PenaliteModel, MembreTontineModel>;
    tontine: Association<PenaliteModel, TontineModel>;
  };
}

PenaliteModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.ENUM('RETARD', 'ABSENCE', 'AUTRE'),
      allowNull: false,
    },
    montant: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    statut: {
      type: DataTypes.ENUM('PAID', 'UNPAID'),
      allowNull: false,
      defaultValue: 'UNPAID',
    },
    membreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tontineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cotisationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastChecked: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'penalites',
    timestamps: true,
  }
);

export default PenaliteModel;