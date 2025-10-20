declare module 'cloudinary' {
    export interface UploadApiResponse {
        secure_url: string;
        public_id: string;
        format: string;
        bytes: number;
        resource_type: string;
    }

    export interface UploadApiOptions {
        resource_type?: 'image' | 'raw' | 'auto';
        folder?: string;
        public_id?: string;
        allowed_formats?: string[];
        quality?: string;
    }

    export interface UploadApiError extends Error {
        http_code: number;
    }

    export interface Uploader {
        upload(file: string, options?: UploadApiOptions): Promise<UploadApiResponse>;
        destroy(public_id: string, options?: { resource_type?: string }): Promise<any>;
    }

    export interface CloudinaryConfig {
        config(options: { 
            cloud_name: string; 
            api_key: string; 
            api_secret: string 
        }): void;
        uploader: Uploader;
    }

    const cloudinary: CloudinaryConfig;
    export default cloudinary;
}