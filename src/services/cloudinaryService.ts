import cloudinary from '@config/cloudinary';

class CloudinaryService {
    static async deleteFile(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId, {
                resource_type: 'raw',
            });
        } catch (error) {
            throw new Error(`Erreur suppression fichier: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async getFileInfo(publicId: string): Promise<any> {
        return cloudinary.api.resource(publicId, {
            resource_type: 'raw',
        });
    }
}

export default new CloudinaryService();