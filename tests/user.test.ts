import request from 'supertest';
import { UserModel, WalletModel, VirtualCardModel } from '../src/models/index.model';
import { describe, it } from 'node:test';
import { beforeAll, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import express from 'express';
const app = express();

describe('GET /me', () => {
  let authToken: string;

  beforeAll(async () => {
    // Créer un utilisateur de test
    const user = await UserModel.create({
      firstname: 'Test',
      lastname: 'User',
      email: 'test@example.com',
      password: 'password',
      phone: '+33612345678',
      address: 'Paris'
    });

    // Générer un JWT valide
    authToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);

    // Créer des données associées
    await WalletModel.create({ 
      userId: user.id, 
      currency: 'XAF', 
      balance: 0,
      matricule: 'SDO455175'
    });
    await VirtualCardModel.create({
      userId: user.id,
      cardNumber: '4111111111111111',
      expiredDate: '12/25',
      cvv: '123',
      status: 'ACTIVE',
      expenditureCeiling: 1000
    });
  });

  it('doit retourner le profil utilisateur avec les données associées', async () => {
    const response = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('wallet');
    expect(response.body.data.virtualCard.cardNumber).toMatch(/\*\*\*\*\*\*\*\*/);
    expect(response.body.data).not.toHaveProperty('password');
  });
});
