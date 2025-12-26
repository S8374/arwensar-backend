import { Request, Response } from "express";
import { UploadService } from "./upload.service";

export class UploadController {
  static async upload(req: Request, res: Response) {
    console.log("Hits req file" , req.file);
    console.log("Hits body " , req.body);
    
    try {
      if (!req.file) throw new Error("No file uploaded");

      const url = await UploadService.uploadFile(req.file);

      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
