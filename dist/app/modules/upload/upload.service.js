"use strict";
// import { BUCKET_NAME, minioClient } from "../../../config/minio.client";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
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
const minio_client_1 = require("../../../config/minio.client");
class UploadService {
    static uploadFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw new Error("No file provided");
            const objectName = `uploads/${Date.now()}_${file.originalname}`;
            // Ensure bucket exists
            const exists = yield minio_client_1.minioClient.bucketExists(minio_client_1.BUCKET_NAME);
            if (!exists) {
                yield minio_client_1.minioClient.makeBucket(minio_client_1.BUCKET_NAME, 'us-east-1');
            }
            // Make bucket public (lifetime access)
            const publicPolicy = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: { AWS: '*' },
                        Action: ['s3:GetObject'],
                        Resource: [`arn:aws:s3:::${minio_client_1.BUCKET_NAME}/*`],
                    },
                ],
            };
            yield minio_client_1.minioClient.setBucketPolicy(minio_client_1.BUCKET_NAME, JSON.stringify(publicPolicy));
            // Upload file
            yield minio_client_1.minioClient.putObject(minio_client_1.BUCKET_NAME, objectName, file.buffer, file.size, {
                'Content-Type': file.mimetype,
            });
            // Return lifetime URL
            const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
            const port = process.env.MINIO_PORT || 9000;
            const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
            const url = `${protocol}://${endpoint}:${port}/${minio_client_1.BUCKET_NAME}/${objectName}`;
            return url; // This URL never expires
        });
    }
}
exports.UploadService = UploadService;
