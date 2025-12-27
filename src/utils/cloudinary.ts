// src/utils/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.CLOUDINARY.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY.CLOUDINARY_API_SECRET,
  secure: true
});

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string = 'cybernark'
): Promise<{ url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },(error: any, result: { secure_url: any; public_id: any; }) => {
        if (error) reject(error);
        else resolve({
          url: result?.secure_url || '',
          public_id: result?.public_id || ''
        });
      }
    );
    
    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error: any, result: unknown) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

export const extractCloudinaryPublicId = (url: string): string | null => {
  try {
    // Cloudinary URL pattern analysis
    const urlParts = url.split('/');
    const filenameWithExtension = urlParts[urlParts.length - 1];
    const publicIdWithVersion = urlParts[urlParts.length - 2] + '/' + filenameWithExtension.split('.')[0];
    
    // Remove version prefix if exists (v1234567890/)
    const publicId = publicIdWithVersion.replace(/^v\d+\//, '');
    
    return publicId;
  } catch (error) {
    console.error("Failed to extract Cloudinary public_id:", error);
    return null;
  }
};

export const uploadFileFromUrl = async (
  fileUrl: string,
  folder: string = 'cybernark'
): Promise<{ url: string; public_id: string }> => {
  return cloudinary.uploader.upload(fileUrl, {
    folder,
    resource_type: 'auto'
  });
};

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractCloudinaryPublicId,
  uploadFileFromUrl
};