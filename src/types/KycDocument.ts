export interface KycDocumentModel {
    id: number;
    type: 'ID_PROOF' | 'ADDRESS_PROOF' | 'INCOME_PROOF';
    status: 'PENDING'|'APPROVED'|'REJECTED';
    url: string;
    reviewedById?: number; 
    reviewedAt?: Date;
    userId: number; 
}
