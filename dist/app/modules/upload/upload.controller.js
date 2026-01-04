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
exports.UploadController = void 0;
const upload_service_1 = require("./upload.service");
class UploadController {
    static upload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Hits req file", req.file);
            console.log("Hits body ", req.body);
            try {
                if (!req.file)
                    throw new Error("No file uploaded");
                const url = yield upload_service_1.UploadService.uploadFile(req.file);
                res.json({ url });
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }
}
exports.UploadController = UploadController;
