import jwt, { Secret, SignOptions } from 'jsonwebtoken';

const JWT_SECRET: Secret = process.env.JWT_SECRET || '';
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const generateTokens = (payload: object): Tokens => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  return { accessToken, refreshToken };
};

type VerifyCallback = (error: Error | null, payload?: jwt.JwtPayload) => void;

export const verifyToken = (
  token: string,
  callback?: VerifyCallback
): jwt.JwtPayload | void => {
  if (callback && typeof callback === 'function') {
    // Mode asynchrone avec callback
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        callback(new Error('Token invalide ou expiré'));
      } else {
        callback(null, decoded as jwt.JwtPayload);
      }
    });
    return;
  }

  // Mode synchrone (sans callback)
  try {
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
};