import { Socket } from 'socket.io';
import { verifyToken } from '@config/jwt';
import { TokenModel, UserModel } from '@models/index.model';
import { typesToken } from '@utils/constants';

interface AuthenticatedSocket extends Socket {
  data: {
    user?: UserModel;
    deviceId?: string;
  }
}

const socketMiddleware = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    // Récupérer le token envoyé via handshake.auth.token
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentification requise'));
    }

    // Décoder et valider le token (attention si verifyToken est asynchrone, il faut await)
    // Ici supposé synchrone, sinon : const decoded = await verifyToken(token);
    const decoded = verifyToken(token) as { id: number; deviceId: string };

    // Vérifier en base que le token est valide et appartient bien à l'utilisateur + appareil
    const tokenEntry = await TokenModel.findOne({
      where: {
        userId: decoded.id,
        deviceId: decoded.deviceId,
        tokenType: typesToken['0'],  // adapter si besoin
        token: token
      },
      include: [{
        model: UserModel,
        as: 'user',
        required: true
      }]
    });

    if (!tokenEntry?.user) {
      return next(new Error('Session invalide'));
    }

    // Attacher les données utilisateur et deviceId dans le socket
    socket.data.user = tokenEntry.user;
    socket.data.deviceId = decoded.deviceId;

    next();
  } catch (error: any) {
    // En cas d'erreur de décodage ou autres
    next(new Error('Token invalide ou expiré'));
    console.log('connexion socket échouée')
  }
};

export default socketMiddleware;