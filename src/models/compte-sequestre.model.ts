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

class CompteSequestreModel extends Model<
  InferAttributes<CompteSequestreModel>,
  InferCreationAttributes<CompteSequestreModel, { omit: 'id' | 'createdAt' | 'updatedAt' }>
> {
  declare id: CreationOptional<number>;
  declare soldeActuel: number;
  declare dateOuverture: CreationOptional<Date>;
  declare etatCompte: 'ACTIVE' | 'BLOCKED';
  declare dateDernierMouvement: Date | null;
  declare montantBloque: number;
  declare tontineId: ForeignKey<TontineModel['id']>;
  declare responsableGestionId: ForeignKey<MembreTontineModel['id']>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Relations
  declare tontine?: NonAttribute<TontineModel>;
  declare responsableGestion?: NonAttribute<MembreTontineModel>;

  declare static associations: {
    tontine: Association<CompteSequestreModel, TontineModel>;
    responsableGestion: Association<CompteSequestreModel, MembreTontineModel>;
  };

}

CompteSequestreModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    soldeActuel: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    dateOuverture: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    etatCompte: {
      type: DataTypes.ENUM('ACTIVE', 'BLOCKED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    dateDernierMouvement: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    montantBloque: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tontineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    responsableGestionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'comptes_sequestre',
    timestamps: true,
  }
);

export default CompteSequestreModel;