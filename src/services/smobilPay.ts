import crypto from 'crypto';

interface S3PAuthConfig {
  publicToken: string;
  accessSecret: string;
  baseUrl: string;
}

export class S3PAuth {
  private config: S3PAuthConfig;

  constructor(config: S3PAuthConfig) {
    this.config = config;
  }

  /**
   * Génère un nonce unique (24 caractères alphanumériques)
   */
  private generateNonce(): string {
    // Génère un nonce base64 modifié pour ne garder que alphanumériques, longueur 24
    return crypto.randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  }

  /**
   * Retourne un timestamp UNIX en secondes
   */
  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Encodage conforme RFC 3986
   */
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  }

  /**
   * Génère la signature HMAC-SHA1 base64
   */
  private generateSignature(
    method: string,
    endpoint: string,
    params: Record<string, string | number | any>,
    nonce: string,
    timestamp: number
  ): { signature: string; parameterString: string; baseString: string } {
    const s3pParams = {
      s3pAuth_nonce: nonce,
      s3pAuth_signature_method: 'HMAC-SHA1',
      s3pAuth_timestamp: timestamp.toString(),
      s3pAuth_token: this.config.publicToken,
    };

    // Fusionner paramètres métier + params d’authentification
    const allParams: Record<string, string | number | any> = { ...params, ...s3pParams };

    // Nettoyer les valeurs string (trim)
    Object.keys(allParams).forEach((k) => {
      if (typeof allParams[k] === 'string') {
        allParams[k] = allParams[k].trim();
      }
    });

    // Trier les clés par ordre alphabétique
    const sortedKeys = Object.keys(allParams).sort();

    // Construire la chaîne de paramètres key=value&key2=value2
    const parameterString = sortedKeys
      .map((key) => `${key}=${allParams[key]}`)
      .join('&');

    // Construire la base string : METHOD & URL_ENCODED & PARAMS_ENCODED
    const baseString = [
      method.toUpperCase(),
      this.percentEncode(this.config.baseUrl + endpoint),
      this.percentEncode(parameterString),
    ].join('&');

    // Calculer la signature HMAC-SHA1 et encoder en base64
    const hmac = crypto.createHmac('sha1', this.config.accessSecret);
    hmac.update(baseString);
    const signature = hmac.digest('base64');

    return { signature, parameterString, baseString };
  }

  /**
   * Génère l'en-tête Authorization conforme au protocole S3P
   */
  public getAuthorizationHeader(
    method: string,
    endpoint: string,
    params: Record<string, string | number | any> = {},
    forceNonce?: string,
    forceTimestamp?: number
  ): string {
    const nonce = forceNonce || this.generateNonce();
    const timestamp = forceTimestamp || this.getTimestamp();
    const { signature } = this.generateSignature(method, endpoint, params, nonce, timestamp);

    // Format strict : pas d’espace après les virgules
    return [
      's3pAuth',
      `s3pAuth_nonce="${nonce}"`,
      `s3pAuth_signature="${signature}"`,
      `s3pAuth_signature_method="HMAC-SHA1"`,
      `s3pAuth_timestamp="${timestamp}"`,
      `s3pAuth_token="${this.config.publicToken}"`,
    ].join(',');
  }

  /**
   * Méthode de debug pour afficher base string et signature
   */
  public debugSignature(
    method: string,
    endpoint: string,
    params: Record<string, string | number | any> = {},
    forceNonce?: string,
    forceTimestamp?: number
  ) {
    const nonce = forceNonce || this.generateNonce();
    const timestamp = forceTimestamp || this.getTimestamp();
    const { signature, parameterString, baseString } = this.generateSignature(method, endpoint, params, nonce, timestamp);

    console.log('Nonce:', nonce);
    console.log('Timestamp:', timestamp);
    console.log('Parameter string:', parameterString);
    console.log('Base string:', baseString);
    console.log('Signature:', signature);

    return { signature, parameterString, baseString, nonce, timestamp };
  }
}