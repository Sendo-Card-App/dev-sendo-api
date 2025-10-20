import express from 'express';
import userRoutes from './userRoutes';
import authRoutes from './authRoutes'
import kycRoutes from './kycRoutes';
import walletRoutes from './walletRoutes';
import transactionRoutes from './transactionRoutes';
import cardRoutes from './cardRoutes';
import adminRoutes from './adminRoutes';
import configRoutes from './configRoutes';
import notificationRoutes from './notificationRoutes';
import requestRoutes from './requestRoutes';
import contactRoutes from './contactRoutes';
import chatRoutes from './chatRoutes';
import mobileMoneyRoutes from './mobileMoneyRoutes'
import transfertArgentRoutes from './transfertArgentRoutes';
import sharedExpenseRoutes from './sharedExpenseRoutes';
import fundingRequestRoutes from './fundingRequestRoutes';
import tontineRoutes from './tontineRoutes';
import pubRoutes from './pubRoutes';
import webhookRoutes from './webhookRoutes';
import emailRoutes from './emailRoutes';
import merchantRoutes from './merchantRoutes';
import debtRoutes from './debtRoutes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes)
router.use('/kyc', kycRoutes);
router.use('/transactions', transactionRoutes);
router.use('/cards', cardRoutes);
router.use('/debts', debtRoutes);
router.use('/admin', adminRoutes);
router.use('/requests', requestRoutes);
router.use('/configs', configRoutes);
router.use('/notification', notificationRoutes);
router.use('/contacts', contactRoutes);
router.use('/chat', chatRoutes)
router.use('/mobile-money', mobileMoneyRoutes)
router.use('/transfer-money', transfertArgentRoutes)
router.use('/shared-expense', sharedExpenseRoutes);
router.use('/fund-requests', fundingRequestRoutes)
router.use('/tontines', tontineRoutes);
router.use('/admin/pubs', pubRoutes);
router.use('/webhook', webhookRoutes);
router.use("/email", emailRoutes);
router.use("/merchant", merchantRoutes);

export default router;