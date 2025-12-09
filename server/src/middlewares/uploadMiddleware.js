// src/middlewares/uploadMiddleware.js
import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB (adjust as needed)
  },
  fileFilter: (req, file, cb) => {
    // optional: restrict types e.g. images & pdfs
    const allowed = /jpeg|jpg|png|gif|pdf/;
    const mimetype = allowed.test(file.mimetype);
    if (mimetype) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

export const uploadSingle = (fieldName) => upload.single(fieldName);
export const uploadMultiple = (fieldName, maxCount) =>
  upload.array(fieldName, maxCount);

// ✅ For Event Module (banner + gallery)
export const uploadEventMedia = upload.fields([
  { name: "banner", maxCount: 1 },
  { name: "gallery", maxCount: 10 },
]);
