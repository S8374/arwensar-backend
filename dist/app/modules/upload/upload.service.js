"use strict";
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
const minio_client_1 = require("../../../config/minio.client");
class UploadService {
    static uploadFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!file)
                throw new Error("No file provided");
            const objectName = `uploads/${Date.now()}_${file.originalname}`;
            // Upload file (private by default)
            yield minio_client_1.minioClient.putObject(minio_client_1.BUCKET_NAME, objectName, file.buffer, file.size, {
                'Content-Type': file.mimetype,
            });
            // Generate temporary signed URL (valid for 7 days)
            const url = yield minio_client_1.minioClient.presignedGetObject(minio_client_1.BUCKET_NAME, objectName, 60 * 60 * 24 * 7 // 7 days in seconds
            );
            return url; // This is now a secure temporary link
        });
    }
}
exports.UploadService = UploadService;
