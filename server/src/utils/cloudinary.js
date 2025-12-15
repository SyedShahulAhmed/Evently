// src/utils/cloudinary.js
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

// ======================================================================
// 1. UPLOAD BUFFER → CLOUDINARY (STREAM)
// ======================================================================
export const uploadBufferToCloudinary = async (buffer, folder = "evently") => {
  if (!buffer) throw new Error("Cloudinary Upload Error: Empty buffer received");

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",      // 🟢 auto-detect image/pdf/video
        timeout: 60000,             // 🟢 60 sec safety timeout
        invalidate: true,           // 🟢 clear CDN cache
      },
      (err, result) => {
        if (err) {
          console.error("Cloudinary Upload Error:", err);
          return reject(err);
        }

        // 🟢 clean uniform return object
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          resourceType: result.resource_type, 
        });
      }
    );

    // Stream the buffer → Cloudinary
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ======================================================================
// 2. DELETE SINGLE FILE FROM CLOUDINARY
// ======================================================================
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "auto",
    });
  } catch (err) {
    console.error("Cloudinary Delete Error:", err);
  }
};

// ======================================================================
// 3. DELETE MULTIPLE FILES (ARRAY)
// ======================================================================
export const deleteMediaArray = async (arr = []) => {
  if (!Array.isArray(arr)) return;

  for (const media of arr) {
    if (media?.publicId) {
      try {
        await deleteFromCloudinary(media.publicId);
      } catch (err) {
        console.warn("Cloudinary Multi-Delete Error:", err?.message);
      }
    }
  }
};

export default cloudinary;
