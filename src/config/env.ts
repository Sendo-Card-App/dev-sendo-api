import * as dotenv from 'dotenv';

export function loadEnv(): void {
  dotenv.config();
  // Validation des variables d'environnement ici si nécessaire
}