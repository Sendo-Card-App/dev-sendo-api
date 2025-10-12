declare namespace Express {
    interface Request {
      requestId?: string;
    }
  }
  
declare module 'twilio' {
    interface VerificationInstance {
      status: string;
    }
  
    interface VerificationCheckInstance {
      status: 'approved' | 'pending' | 'canceled';
    }
}
  