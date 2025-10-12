import { Server } from 'socket.io';
import http from 'http';
import socketMiddleware from '../middlewares/socket';
import messageService from '@services/messageService';

export default (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', 
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
    path: '/socket.io' 
  });

  // Ordre important : appliquer les middlewares avant l'écoute de connection
  io.use(socketMiddleware);

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    console.log(`Utilisateur connecté : ${socket.data.user?.id}`);
    console.log(`User email: ${socket.data.user?.email}`);

    // Les gestionnaires d’événements
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(conversationId);
      console.log(`Utilisateur ${socket.data.user?.id} a rejoint la conversation ${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`Utilisateur ${socket.data.user?.id} a quitté la conversation ${conversationId}`);
    });

    socket.on('send_message', async (data: { 
      conversationId: string; 
      content: string; 
      senderType: 'CUSTOMER' | 'ADMIN';
      attachments?: string[] 
    }) => {
      try {
        console.log('Données reçues pour send_message:', data);
        //const senderType = socket.data.user?.role !== 'CUSTOMER' ? 'ADMIN' : 'CUSTOMER';
        const userId = socket.data.user.id;
        
        const message = await messageService.sendMessage({
          conversationId: data.conversationId,
          content: data.content,
          userId,
          senderType: data.senderType,
          attachments: JSON.stringify(data.attachments || [])
        });

        console.log('Message envoyé:', message);

        // Emettre le message globablement
        io.emit('new_message_global', message);
        // Émettre le message à tous les clients dans la room
        io.to(data.conversationId).emit('new_message', message);
      } catch (error) {
        console.error('Erreur en envoyant le message:', error);
        socket.emit('error', 'Impossible d\'envoyer le message');
      }
    });

    socket.on('typing', (conversationId: string) => {
      socket.to(conversationId).emit('typing', { userId: socket.data.user?.id });
    });

    socket.on('stop_typing', (conversationId: string) => {
      socket.to(conversationId).emit('stop_typing', { userId: socket.data.user?.id });
    });

    socket.on('disconnect', () => {
      console.log(`Client déconnecté: ${socket.id}`);
    });
  });

  return io;
};