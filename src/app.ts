import express from 'express';
import swaggerSetup from '@config/swagger';
import apiRoutes from './routes';
import responseFormatter from '@middlewares/responseFormatter';
import errorHandler from '@middlewares/errorHandler';
import { requestLogger } from '@middlewares/requestLogger';
import cors from 'cors';
import http from 'http';
import socket from '@config/socket';
import path from 'path';
import bodyParser from 'body-parser';

export function createApp() {
  const app = express();
  const server = http.createServer(app);

  swaggerSetup(app);

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Passcode',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods'
    ],
    credentials: true,
    optionsSuccessStatus: 200 
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use(requestLogger);
  app.use(responseFormatter);

  app.use('/api', apiRoutes);

  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
      return next();
    }
    next();
  });

  app.use(errorHandler);

  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, 'views'));

  const io = socket(server);

  return { app, server, io };
}