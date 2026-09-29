import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export async function resetDb() {
  // Order matters: children before parents
  await prisma.rideStatusHistory.deleteMany();
  await prisma.poolDecline.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
}

export async function createPassenger(name: string, email: string) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash("password123", 10),
      role: "PASSENGER",
    },
  });
}

export async function createDriver(
  name: string,
  email: string,
  vehicleName: string,
  capacity: number,
  currentZone: string,
) {
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash("password123", 10),
      role: "DRIVER",
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      driverId: user.id,
      name: vehicleName,
      capacity,
      isOnline: true,
      currentZone,
    },
  });
  return { user, vehicle };
}

export function tokenFor(userId: string, role: "PASSENGER" | "DRIVER") {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, {
    expiresIn: "1h",
  });
}
