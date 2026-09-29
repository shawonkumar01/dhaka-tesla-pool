import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  createRideRequest,
  getMyRides,
  getRideById,
  cancelRide,
  estimateFare,
  payForRide,
} from "../controllers/ride.controller";

const router = Router();

router.use(requireAuth, requireRole("PASSENGER"));

router.post("/", createRideRequest);
router.get("/", getMyRides);
router.get('/estimate', estimateFare);
router.get("/:id", getRideById);
router.post("/:id/cancel", cancelRide);
router.post("/:id/pay", payForRide);


export default router;
