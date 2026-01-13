// import { BUCKET_NAME, minioClient } from "../../../config/minio.client";

// export class UploadService {
//   static async uploadFile(file: Express.Multer.File): Promise<string> {
//     if (!file) throw new Error("No file provided");

//     const objectName = `uploads/${Date.now()}_${file.originalname}`;

//     // Upload file (private by default)
//     await minioClient.putObject(BUCKET_NAME, objectName, file.buffer, file.size, {
//       'Content-Type': file.mimetype,
//     });

//     // Generate temporary signed URL (valid for 7 days)
//     const url = await minioClient.presignedGetObject(
//       BUCKET_NAME,
//       objectName,
//       60 * 60 * 24 * 7 // 7 days in seconds
//     );

//     return url; // This is now a secure temporary link
//   }
// }


import { BUCKET_NAME, minioClient } from "../../../config/minio.client";

export class UploadService {
  static async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file) throw new Error("No file provided");

    const objectName = `uploads/${Date.now()}_${file.originalname}`;

    // Ensure bucket exists
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
    }

    // Make bucket public (lifetime access)
    const publicPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: '*' },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(publicPolicy));

    // Upload file
    await minioClient.putObject(BUCKET_NAME, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });

    // Return lifetime URL
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || 9000;
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const url = `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${objectName}`;

    return url; // This URL never expires
  }
}
