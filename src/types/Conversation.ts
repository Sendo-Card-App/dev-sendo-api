import { TypesStatusConversation } from "@utils/constants";
import { BaseEntity } from "./BaseEntity";

export interface IConversation extends IConversationCreate, BaseEntity {
  id: string;
}

export interface IConversationCreate {
  userId: number;
  adminId?: number | null;
  status: TypesStatusConversation;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderType: 'CUSTOMER' | 'ADMIN';
  content: string;
  read: boolean;
  attachments?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface IMessageCreate {
  conversationId: string;
  senderType: 'CUSTOMER' | 'ADMIN';
  content: string;
  attachments?: string;
  userId: number;
}