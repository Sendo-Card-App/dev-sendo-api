import UserModel from './user.model';
import TokenModel from './token.model';
import WalletModel from './wallet.model';
import VirtualCardModel from './virtualCard.model';
import TransactionModel from './transaction.model';
import RoleModel from './role.model';
import KycDocumentModel from './kyc-document.model';
import ConfigModel from './config.model';
import UserRoleModel from './user-role.model';
import PhoneNumberUserModel from './phone-number-user.model';
import NotificationModel from './notification.model';
import RequestModel from './request.model';
import ContactModel from './contact.model';
import UserContactModel from './user-contact.model';
import ConversationModel from './conversation.model';
import MessageModel from './message.model';
import SharedExpenseModel from './shared-expense.model';
import ParticipantSharedExpenseModel from './participant-shared-expense.model';
import DestinataireModel from './destinataire.model';
import CodePhoneModel from './code-phone.model';
import FundRequestModel from './fund-request.model';
import RequestRecipientModel from './request-recipient.model';
import TontineModel from './tontine.model';
import MembreTontineModel from './membre-tontine.model';
import TourDistributionModel from './tour-distribution.model';
import CotisationModel from './cotisation.model';
import PenaliteModel from './penalite.model';
import CompteSequestreModel from './compte-sequestre.model';
import PaymentMethodModel from './payment-method.model';
import PartyCard from './party-card.model';
import CardTransactionDebtsModel from './card-transaction-debts.model';
import { PalierModel } from './palier.model';
import { CommissionModel } from './commission.model';
import TransactionPartnerFeesModel from './transaction-partner-fees.model';
import MerchantModel from './merchant.model';
import PartnerWithdrawalsModel from './partner-withdrawals.model';
import ReferralCodeModel from './referral-code.model';
import WalletHistoryModel from './wallet-history.model';
import FundModel from './fund.model';
import FundSubscriptionModel from './fund-subscription.model';
import WithdrawalFundRequestModel from './withdrawal-fund-request.model';


  /** -------------------------------
   * User ↔ Role (Many-to-Many)
   * ------------------------------- */
  UserModel.belongsToMany(RoleModel, {
    through: UserRoleModel,
    foreignKey: 'userId',
    otherKey: 'roleId',
    as: 'roles',
  });
  RoleModel.belongsToMany(UserModel, {
    through: UserRoleModel,
    foreignKey: 'roleId',
    otherKey: 'userId',
    as: 'users',
  });

  UserModel.hasOne(PhoneNumberUserModel, {
    foreignKey: 'userId',
    as: 'secondPhoneNumber'
  })
  PhoneNumberUserModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user'
  })

  /** -------------------------------
   * User ↔ Token (1 - N)
   * ------------------------------- */
  TokenModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  UserModel.hasMany(TokenModel, { foreignKey: 'userId', as: 'tokens' });

  /** -------------------------------
   * User ↔ Wallet (1 - 1)
   * ------------------------------- */
  WalletModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  UserModel.hasOne(WalletModel, { foreignKey: 'userId', as: 'wallet' });

  /** -------------------------------
   * User ↔ VirtualCard (1 - N)
   * ------------------------------- */
  VirtualCardModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  UserModel.hasMany(VirtualCardModel, { foreignKey: 'userId', as: 'cards' });
  UserModel.hasOne(VirtualCardModel, { foreignKey: 'userId', as: 'virtualCard' });

  /** -------------------------------
   * User ↔ Transaction (1 - N)
   * ------------------------------- */
  TransactionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  TransactionModel.belongsTo(VirtualCardModel, { foreignKey: 'virtualCardId', as: 'card' });
  UserModel.hasMany(TransactionModel, { foreignKey: 'userId', as: 'transactions' });
  VirtualCardModel.hasMany(TransactionModel, { foreignKey: 'virtualCardId', as: 'transactions' });

  /** -------------------------------
   * User ↔ KycDocument (1 - N)
   * ------------------------------- */
  KycDocumentModel.belongsTo(UserModel, { as: 'reviewedBy', foreignKey: 'reviewedById' });
  KycDocumentModel.belongsTo(UserModel, { as: 'user', foreignKey: 'userId' });
  UserModel.hasMany(KycDocumentModel, { foreignKey: 'userId', as: 'kycDocuments' });

  /** -------------------------------
   * User ↔ Notification (1 - N)
   * ------------------------------- */
  NotificationModel.belongsTo(UserModel, { as: 'user', foreignKey: 'userId' });
  UserModel.hasMany(NotificationModel, { foreignKey: 'userId', as: 'notifications' });

  /** -------------------------------
   * User ↔ Request (1 - N)
   * ------------------------------- */
  RequestModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  RequestModel.belongsTo(UserModel, { as: 'reviewedBy', foreignKey: 'reviewedById' });
  UserModel.hasMany(RequestModel, { foreignKey: 'userId', as: 'requests' });

  /** -------------------------------
   * User ↔ Contact (Many relations)
   * ------------------------------- */
  ContactModel.belongsTo(UserModel, { foreignKey: 'contactUserId', as: 'ownerUser' });
  ContactModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'listOwner' });
  UserModel.belongsToMany(ContactModel, {
    through: UserContactModel,
    as: 'favoriteContacts',
    foreignKey: 'userId',
    otherKey: 'contactId',
  });

  /** -------------------------------
   * User ↔ Conversation (1 - N)
   * ------------------------------- */
  ConversationModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  ConversationModel.belongsTo(UserModel, { foreignKey: 'adminId', as: 'admin' });
  UserModel.hasMany(ConversationModel, { foreignKey: 'userId', as: 'conversations' });

  /** -------------------------------
   * User ↔ Message (1 - N)
   * ------------------------------- */
  MessageModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  MessageModel.belongsTo(ConversationModel, { foreignKey: 'conversationId', as: 'conversation' });
  UserModel.hasMany(MessageModel, { foreignKey: 'userId', as: 'messages' });

  /** -------------------------------
   * SharedExpense ↔ ParticipantSharedExpense ↔ User
   * ------------------------------- */
  ParticipantSharedExpenseModel.belongsTo(SharedExpenseModel, { foreignKey: 'sharedExpenseId', as: 'sharedExpense' });
  ParticipantSharedExpenseModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  SharedExpenseModel.hasMany(ParticipantSharedExpenseModel, { foreignKey: 'sharedExpenseId', as: 'participants' });
  SharedExpenseModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'initiator' });
  UserModel.belongsToMany(SharedExpenseModel, {
    through: ParticipantSharedExpenseModel,
    foreignKey: 'userId',
    otherKey: 'sharedExpenseId',
    as: 'sharedExpenses',
  });

  /** -------------------------------
   * User ↔ CodePhone (1 - 1)
   * ------------------------------- */
  CodePhoneModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  UserModel.hasOne(CodePhoneModel, { foreignKey: 'userId', as: 'codePhone' });

  /** -------------------------------
   * FundRequest ↔ RequestRecipient ↔ User
   * ------------------------------- */
  FundRequestModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'requesterFund' });
  FundRequestModel.hasMany(RequestRecipientModel, { foreignKey: 'fundRequestId', as: 'recipients' });
  RequestRecipientModel.belongsTo(FundRequestModel, { foreignKey: 'fundRequestId', as: 'requestFund' });
  RequestRecipientModel.belongsTo(UserModel, { foreignKey: 'recipientId', as: 'recipient' });

  /** -------------------------------
   * Tontine, MembreTontine, Cotisation, Penalite, etc.
   * ------------------------------- */
  MembreTontineModel.belongsTo(TontineModel, { foreignKey: 'tontineId', as: 'tontine' });
  MembreTontineModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  TontineModel.belongsToMany(UserModel, {
    through: MembreTontineModel,
    foreignKey: 'tontineId',
    otherKey: 'userId',
    as: 'tontineUser',
  });
  UserModel.belongsToMany(TontineModel, {
    through: MembreTontineModel,
    foreignKey: 'userId',
    otherKey: 'tontineId',
    as: 'tontines',
  });
  TontineModel.hasOne(MembreTontineModel, { as: 'admin', foreignKey: 'tontineId', scope: { role: 'ADMIN' } });
  TontineModel.hasMany(MembreTontineModel, { foreignKey: 'tontineId', as: 'membres' });
  UserModel.hasMany(MembreTontineModel, { foreignKey: 'userId', as: 'membreDetails' });

  CotisationModel.belongsTo(MembreTontineModel, { foreignKey: 'membreId', as: 'membre' });
  CotisationModel.belongsTo(TontineModel, { foreignKey: 'tontineId', as: 'tontine' });
  MembreTontineModel.hasMany(CotisationModel, { foreignKey: 'membreId', as: 'cotisations' });
  TontineModel.hasMany(CotisationModel, { foreignKey: 'tontineId', as: 'cotisations' });

  PenaliteModel.belongsTo(MembreTontineModel, { foreignKey: 'membreId', as: 'membre' });
  PenaliteModel.belongsTo(TontineModel, { foreignKey: 'tontineId', as: 'tontine' });
  PenaliteModel.belongsTo(CotisationModel, { foreignKey: 'cotisationId', as: 'cotisation' });
  MembreTontineModel.hasMany(PenaliteModel, { foreignKey: 'membreId', as: 'penalites' });
  TontineModel.hasMany(PenaliteModel, { foreignKey: 'tontineId', as: 'penalites' });
  CotisationModel.hasOne(PenaliteModel, { foreignKey: 'cotisationId', as: 'penalite' });

  TourDistributionModel.belongsTo(TontineModel, { foreignKey: 'tontineId', as: 'tontine' });
  TourDistributionModel.belongsTo(MembreTontineModel, { foreignKey: 'beneficiaireId', as: 'beneficiaire' });
  TontineModel.hasMany(TourDistributionModel, { foreignKey: 'tontineId', as: 'toursDeDistribution' });
  MembreTontineModel.hasMany(TourDistributionModel, { foreignKey: 'beneficiaireId', as: 'toursDeDistribution' });

  CompteSequestreModel.belongsTo(TontineModel, { foreignKey: 'tontineId', as: 'tontine' });
  CompteSequestreModel.belongsTo(MembreTontineModel, { foreignKey: 'responsableGestionId', as: 'responsableGestion' });
  TontineModel.hasOne(CompteSequestreModel, { foreignKey: 'tontineId', as: 'compteSequestre' });
  MembreTontineModel.hasMany(CompteSequestreModel, { foreignKey: 'responsableGestionId', as: 'comptesGestion' });

  /** -------------------------------
   * PaymentMethod ↔ User / VirtualCard
   * ------------------------------- */
  PaymentMethodModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  PaymentMethodModel.belongsTo(VirtualCardModel, { foreignKey: 'cardId', as: 'card' });
  UserModel.hasMany(PaymentMethodModel, { foreignKey: 'userId', as: 'paymentMethods' });
  UserModel.hasOne(PaymentMethodModel, { foreignKey: 'userId', as: 'paymentMethod' });
  VirtualCardModel.hasOne(PaymentMethodModel, { foreignKey: 'cardId', as: 'paymentMethod' });

  /** -------------------------------
   * PartyCard ↔ User
   * ------------------------------- */
  PartyCard.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  UserModel.hasOne(PartyCard, { foreignKey: 'userId', as: 'partyCard' });

  /** -------------------------------
   * CardTransactionDebts ↔ User / VirtualCard
   * ------------------------------- */
  CardTransactionDebtsModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
  CardTransactionDebtsModel.belongsTo(VirtualCardModel, { foreignKey: 'cardId', as: 'card' });
  UserModel.hasMany(CardTransactionDebtsModel, { foreignKey: 'userId', as: 'debts' });
  VirtualCardModel.hasMany(CardTransactionDebtsModel, { foreignKey: 'cardId', as: 'debts' });

  /** -------------------------------
   * User ↔ Merchant
   * ------------------------------- */
  UserModel.hasOne(MerchantModel, { foreignKey: 'userId', as: 'merchant' });
  MerchantModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' })

  /** -------------------------------
   * Palier ↔ Commission
   * ------------------------------- */
  CommissionModel.hasMany(PalierModel, { foreignKey: 'commissionId', as: 'palier' });
  PalierModel.belongsTo(CommissionModel, { foreignKey: 'commissionId', as: 'commission' });

  /** -------------------------------
   * TransactionPartnerFees ↔ Transaction / Partner
   * ------------------------------- */
  TransactionPartnerFeesModel.belongsTo(MerchantModel, { foreignKey: 'partnerId', as: 'partner' })
  TransactionPartnerFeesModel.belongsTo(TransactionModel, { foreignKey: 'transactionId', as: 'transaction' })
  MerchantModel.hasMany(TransactionPartnerFeesModel, { foreignKey: 'partnerId', as: 'transactions' })

  /** -------------------------------
   * PartnerWithdrawals ↔ Partner
   * ------------------------------- */
  PartnerWithdrawalsModel.belongsTo(MerchantModel, { foreignKey: 'partnerId', as: 'partner' })
  MerchantModel.hasMany(PartnerWithdrawalsModel, { foreignKey: 'partnerId', as: 'withdrawals' })

  // Un code appartient à un user
  ReferralCodeModel.belongsTo(UserModel, { 
    foreignKey: 'userId', 
    as: 'owner' 
  });
  ReferralCodeModel.belongsTo(WalletModel, { 
    foreignKey: 'userId', 
    as: 'wallet' 
  });

  // Liaison inverse: codes utilisés par un user
  /*UserModel.hasMany(ReferralCodeModel, { 
    foreignKey: 'usedBy',  // Via JSON parsing
    as: 'usedCodes' 
  });*/

  WalletHistoryModel.belongsTo(WalletModel, {
    foreignKey: 'walletId',
    as: 'wallet'
  })
  WalletModel.hasMany(WalletHistoryModel, {
    foreignKey: 'walletId',
    as: 'wallet_histories'
  })
  TransactionModel.hasOne(WalletHistoryModel, {
    foreignKey: 'transactionId',
    as: 'walletHistory'
  })
  WalletHistoryModel.belongsTo(TransactionModel, {
    foreignKey: 'transactionId',
    as: 'walletHistory'
  })

  FundSubscriptionModel.belongsTo(FundModel, { foreignKey: "fundId", as: 'fund' });
  FundModel.hasMany(FundSubscriptionModel, {
    foreignKey: 'fundId',
    as: 'fundSubscriptions'
  })
  FundSubscriptionModel.belongsTo(UserModel, {
    foreignKey: 'userId',
    as: 'user'
  })
  UserModel.hasMany(FundSubscriptionModel, {
    foreignKey: 'userId',
    as: 'fundSubscriptions'
  })

  WithdrawalFundRequestModel.belongsTo(FundSubscriptionModel, {
    foreignKey: "subscriptionId",
    as: 'fundSubscription'
  });
  WithdrawalFundRequestModel.belongsTo(UserModel, {
    foreignKey: "userId",
    as: 'user'
  });
  UserModel.hasMany(WithdrawalFundRequestModel, {
    foreignKey: 'userId',
    as: 'withdrawalFundRequest'
  })

export {
  RoleModel,
  UserModel,
  TokenModel,
  WalletModel,
  VirtualCardModel,
  TransactionModel,
  KycDocumentModel,
  ConfigModel,
  UserRoleModel,
  PhoneNumberUserModel,
  NotificationModel,
  ContactModel,
  RequestModel,
  ConversationModel,
  MessageModel,
  SharedExpenseModel,
  ParticipantSharedExpenseModel,
  RequestRecipientModel,
  FundRequestModel,
  TontineModel,
  MembreTontineModel,
  CotisationModel,
  PenaliteModel,
  TourDistributionModel,
  CompteSequestreModel,
  PaymentMethodModel,
  PartyCard,
  UserContactModel,
  DestinataireModel,
  CodePhoneModel,
  CardTransactionDebtsModel,
  ReferralCodeModel,
  WalletHistoryModel
};