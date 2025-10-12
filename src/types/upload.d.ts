import { UploadApiResponse } from 'cloudinary';

declare global {
  namespace Express {
    interface Multer {
      file: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        stream: NodeJS.ReadableStream;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      };
    }

    interface Request {
      file?: UploadApiResponse;
      files?: {
        [fieldname: string]: UploadApiResponse[];
      };
    }
  }
}

export interface UploadedFile {
  url: string;
  public_id: string;
  format: string;
  bytes: number;
}