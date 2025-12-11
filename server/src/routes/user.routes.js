import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  updateMyAvatar,
  deleteMyAccount
} from "../controllers/user.controller.js";
import { uploadSingle } from "../middlewares/uploadMiddleware.js";
import {userPasswordUpdateSchema, userUpdateSchema} from "../validators/user.schema.js"
import validateSchema from "../utils/validateSchema.js";
import { getMyRegistrations } from "../controllers/registration.controller.js";


const router = Router();

router.get("/me", authMiddleware, getMyProfile);

/* UPDATE PROFILE */
router.put(
  "/me",
  authMiddleware,
  validateSchema(userUpdateSchema),
  updateMyProfile
);

/* CHANGE PASSWORD */
router.put(
  "/me/password",
  authMiddleware,
  validateSchema(userPasswordUpdateSchema),
  updateMyPassword
);


/* UPDATE AVATAR */
router.post(
  "/me/avatar",
  authMiddleware,
  uploadSingle("avatar"),
  updateMyAvatar
);

/* DELETE ACCOUNT */
router.delete("/me", authMiddleware, deleteMyAccount);


export default router;
