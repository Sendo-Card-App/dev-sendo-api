export interface Destination {
    destination: string;
    status: string;
    name: string;
}

export interface CashinCashout {
    serviceid: string;
    merchant: string;
    payItemId: string;
    amountType: string;
    localCur: string;
    name: string;
    amountLocalCur: string | null | number;
    description: string;
    payItemDescr: null | string | any;
    optStrg: null | string | any;
    optNmb: null | number | string | any;
}

export interface Cashin extends CashinCashout {}

export interface QuoteResult {
    quoteId: string;
    expiresAt: Date | string;
    payItemId: string;
    amountLocalCur: string | number;
    priceLocalCur: string | number;
    priceSystemCur: string | number;
    localCur: string;
    systemCur: string;
    promotion: null | any;
}

export interface CollectPayload {
    quoteId?: string | null | undefined;
    customerPhonenumber: string;
    customerEmailaddress: string;
    customerName: string;
    customerAddress: string;
    serviceNumber: string;
    trid: string;
    amount?: number;
}

export interface CollectResult {
    ptn: string;
    timestamp: Date | string;
    agentBalance: string | number;
    receiptNumber: string;
    veriCode: string;
    priceLocalCur: string | number;
    priceSystemCur: string | number;
    localCur: string;
    systemCur: string;
    trid: string;
    pin: null | any,
    status: string;
    payItemDescr: null | string;
    payItemId: string;
    tag: null | any;
}

export interface ResultTransaction {
    ptn: string;
    serviceid: string | number;
    merchant: string;
    timestamp: string | Date;
    receiptNumber: string;
    veriCode: string;
    clearingDate: string;
    trid: string;
    priceLocalCur: string | number;
    priceSystemCur: string | number;
    localCur: string;
    systemCur: string;
    pin: null | any,
    tag: null | any,
    status: string;
    payItemDescr: null | any;
    payItemId: string;
    errorCode: null | any;
}