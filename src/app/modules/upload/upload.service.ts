import { BUCKET_NAME, minioClient } from "../../../config/minio.client";

export class UploadService {
  static async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file) throw new Error("No file provided");

    const objectName = `uploads/${Date.now()}_${file.originalname}`;

    // Upload file (private by default)
    await minioClient.putObject(BUCKET_NAME, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    // Generate temporary signed URL (valid for 7 days)
    const url = await minioClient.presignedGetObject(
      BUCKET_NAME,
      objectName,
      60 * 60 * 24 * 7 // 7 days in seconds
    );

    return url; // This is now a secure temporary link
  }
}