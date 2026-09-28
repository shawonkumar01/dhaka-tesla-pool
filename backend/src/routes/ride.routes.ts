import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createRideRequest,
  getMyRides,
  getRideById,
  cancelRide,
  estimateFare,
} from "../controllers/ride.controller";

const router = Router();

router.use(requireAuth, requireRole("PASSENGER"));

router.post("/", createRideRequest);
router.get("/", getMyRides);
router.get('/estimate', estimateFare);
router.get("/:id", getRideById);
router.post("/:id/cancel", cancelRide);


export default router;
