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
exports.uploadFileFromUrl = exports.extractCloudinaryPublicId = exports.deleteFromCloudinary = exports.uploadToCloudinary = void 0;
// src/utils/cloudinary.ts
const cloudinary_1 = require("cloudinary");
const config_1 = require("../config");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: config_1.config.CLOUDINARY.CLOUDINARY_CLOUD_NAME,
    api_key: config_1.config.CLOUDINARY.CLOUDINARY_API_KEY,
    api_secret: config_1.config.CLOUDINARY.CLOUDINARY_API_SECRET,
    secure: true
});
const uploadToCloudinary = (fileBuffer_1, ...args_1) => __awaiter(void 0, [fileBuffer_1, ...args_1], void 0, function* (fileBuffer, folder = 'cybernark') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ folder, resource_type: 'auto' }, (error, result) => {
            if (error)
                reject(error);
            else
                resolve({
                    url: (result === null || result === void 0 ? void 0 : result.secure_url) || '',
                    public_id: (result === null || result === void 0 ? void 0 : result.public_id) || ''
                });
        });
        uploadStream.end(fileBuffer);
    });
});
exports.uploadToCloudinary = uploadToCloudinary;
const deleteFromCloudinary = (publicId) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        cloudinary_1.v2.uploader.destroy(publicId, (error, result) => {
            if (error)
                reject(error);
            else
                resolve(result);
        });
    });
});
exports.deleteFromCloudinary = deleteFromCloudinary;
const extractCloudinaryPublicId = (url) => {
    try {
        // Cloudinary URL pattern analysis
        const urlParts = url.split('/');
        const filenameWithExtension = urlParts[urlParts.length - 1];
        const publicIdWithVersion = urlParts[urlParts.length - 2] + '/' + filenameWithExtension.split('.')[0];
        // Remove version prefix if exists (v1234567890/)
        const publicId = publicIdWithVersion.replace(/^v\d+\//, '');
        return publicId;
    }
    catch (error) {
        console.error("Failed to extract Cloudinary public_id:", error);
        return null;
    }
};
exports.extractCloudinaryPublicId = extractCloudinaryPublicId;
const uploadFileFromUrl = (fileUrl_1, ...args_1) => __awaiter(void 0, [fileUrl_1, ...args_1], void 0, function* (fileUrl, folder = 'cybernark') {
    return cloudinary_1.v2.uploader.upload(fileUrl, {
        folder,
        resource_type: 'auto'
    });
});
exports.uploadFileFromUrl = uploadFileFromUrl;
exports.default = {
    uploadToCloudinary: exports.uploadToCloudinary,
    deleteFromCloudinary: exports.deleteFromCloudinary,
    extractCloudinaryPublicId: exports.extractCloudinaryPublicId,
    uploadFileFromUrl: exports.uploadFileFromUrl
};
