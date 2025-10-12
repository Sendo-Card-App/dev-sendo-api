import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';

interface CloudinaryStorageOptions {
    cloudinary: typeof cloudinary;
    params: {
        folder: string;
        allowed_formats: string[];
        resource_type: 'auto' | 'image' | 'raw';
        public_id?: (req: Express.Request, file: Express.Multer.File) => Promise<string>;
    };
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const storageOptions: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'kyc_documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            const userId = req.user?.id;
            const timestamp = Date.now();
            return `kyc_${userId}_${timestamp}`;
        },
    },
};

const storageOptionsMessageFiles: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'messages',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            const userId = req.user?.id;
            const timestamp = Date.now();
            return `message_${userId}_${timestamp}`;
        },
    },
};

const storageOptionsPicture: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'pictures_users',
        allowed_formats: ['jpg', 'jpeg', 'png', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            const userId = req.user?.id;
            const timestamp = Date.now();
            return `picture_${userId}_${timestamp}`;
        },
    },
};

const storageOptionsRequest: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'requests_documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            const userId = req.user?.id;
            const timestamp = Date.now();
            return `request_${userId}_${timestamp}`;
        },
    },
};

const storageOptionsFileRequest: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'bank_files',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            const userId = req.user?.id;
            const timestamp = Date.now();
            return `bank_file_${userId}_${timestamp}`;
        },
    },
};

const storageOptionsPub: CloudinaryStorageOptions = {
    cloudinary: cloudinary,
    params: {
        folder: 'publicities',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'img'],
        resource_type: 'auto',
        public_id: async (req, file) => {
            console.log("File received for upload:", file);
            const timestamp = Date.now();
            return `pub_${timestamp}`;
        },
    },
};

const storage = new CloudinaryStorage(storageOptions);
const storagePub = new CloudinaryStorage(storageOptionsPub);
const storagePicture = new CloudinaryStorage(storageOptionsPicture);
const storageRequest = new CloudinaryStorage(storageOptionsRequest);
const storageFileBank = new CloudinaryStorage(storageOptionsFileRequest);
const storageMessageFile = new CloudinaryStorage(storageOptionsMessageFiles);

export const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).array('documents', 5);

export const upload_multi = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).array('files');

export const upload_files_message = multer({
    storage: storageMessageFile,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).array('attachments');
  
export const upload_single = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).single('document');

export const upload_picture = multer({
    storage: storagePicture,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).single('picture');

export const upload_request = multer({
    storage: storageRequest,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).single('request');

export const upload_bankReleve = multer({
    storage: storageFileBank,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).single('bankFile');

export const upload_pub = multer({
    storage: storagePub,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit de 2 MB
    fileFilter: (req, file, cb) => {
        req.file = file; // Assurez-vous que le fichier est accessible dans req.file
        if (!file.mimetype.match(/(jpg|jpeg|png|pdf|img)$/)) {
            return cb(new Error('Format de fichier non supporté'));
        }
        cb(null, true);
    }
}).single('file');

/**
 * Télécharge un fichier depuis une URL et le sauvegarde localement
 * @param url URL du fichier à télécharger
 * @param outputPath Chemin local où sauvegarder le fichier
 */
export async function downloadFileFromUrl(url: string, outputPath: string): Promise<void> {
    const writer = fs.createWriteStream(outputPath);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

export default cloudinary;