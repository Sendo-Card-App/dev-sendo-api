import express from 'express';
import swaggerSetup from '@config/swagger';
import apiRoutes from './routes';
import responseFormatter from '@middlewares/responseFormatter';
import errorHandler from '@middlewares/errorHandler';
import { requestLogger } from '@middlewares/requestLogger';
import cors from 'cors';
import http from 'http';
import socket from '@config/socket';

export function createApp() {
  const app = express();
  const server = http.createServer(app);

  swaggerSetup(app);

  app.use(express.json());
  app.use(responseFormatter);
  app.use(requestLogger);
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods'
    ]
  }));

  app.use('/api', apiRoutes);

  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
      return next();
    }
    next();
  });

  app.use(errorHandler);

  const io = socket(server);

  return { app, server, io };
}