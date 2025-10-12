const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const senderPhone = process.env.TWILIO_PHONE_NUMBER;

const client = require('twilio')(
  accountSid, 
  authToken
);

if (!accountSid || !authToken || !verifyServiceSid) {
  throw new Error('Twilio credentials missing in environment variables');
}

export const sendMessage = async (receiverPhone: string, message: string): Promise<void> => {
  try {
    await client.messages.create({
      to: receiverPhone,
      from: senderPhone,
      body: message
    }).then((message: { sid: any; }) => console.log('Sending message : ', message.sid))
  } catch (error) {
    console.error('Sending message Error:', error);
    throw new Error('Failed to send message');
  }
}

export const sendOTP = async (phone: string): Promise<string> => {
    try {
      const verification = await client.verify.v2.services(verifyServiceSid)
        .verifications
        .create({ to: phone, channel: 'sms' });
      
      return verification.status;
    } catch (error) {
      console.error('Verify Error:', error);
      throw new Error('Failed to send verification code');
    }
};

export const verifyOTP = async (phone: string, code: string): Promise<boolean> => {
    try {
      const verificationCheck = await client.verify.v2.services(verifyServiceSid)
        .verificationChecks
        .create({ to: phone, code });
  
      return verificationCheck.status === 'approved';
    } catch (error) {
      console.error('Verification Error:', error);
      return false;
    }
};  
