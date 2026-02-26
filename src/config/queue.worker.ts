import { sendGlobalEmail } from '@services/emailService';
import Queue from 'bull';
import { QueueEvents } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || '';

export const emailQueue = new Queue('email marketing', { redis: REDIS_URL });

emailQueue.process(5, async (job) => {  // 5 emails parallèles max
  console.log('🔄 Envoi email:', job.data.email);
  const { email, firstname, subject, text } = job.data;
  
  try {
    await sendGlobalEmail(
      email,
      subject,
      `<p>Bonjour ${firstname},<br>${text}</p>`,
      'INFORMATION'
    );
    console.log('✅ Email envoyé:', email);
  } catch (error: any) {
    console.error('❌ Échec email:', email, error.message);
    throw error;  // Bull retry auto
  }
});

// Logs événements
const queueEvents = new QueueEvents('email marketing', { connection: { url: REDIS_URL } });
queueEvents.on('completed', ({ jobId }) => console.log('Job complété:', jobId));
queueEvents.on('failed', ({ jobId, failedReason }) => 
  console.error('Job échoué:', jobId, failedReason)
);

console.log('🚀 Email Worker démarré - surveillez pm2 logs');