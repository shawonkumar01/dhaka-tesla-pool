import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  setOnlineStatus,
  getMyVehicleStatus,
  getRideHistory,
  advancePoolStatus,
  registerVehicle,
} from "../controllers/driver.controller";

const router = Router();

router.use(requireAuth, requireRole("DRIVER"));

router.patch("/status", setOnlineStatus);
router.get("/me", getMyVehicleStatus);
router.get("/history", getRideHistory);
router.post("/pools/:poolId/advance", advancePoolStatus);
router.post('/vehicle', registerVehicle);

export default router;
