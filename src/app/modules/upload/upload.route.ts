import { Router } from "express";
import multer from "multer";
import { UploadController } from "./upload.controller";

const Minorouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

Minorouter.post("/", upload.single("file"), UploadController.upload);

export default Minorouter;
