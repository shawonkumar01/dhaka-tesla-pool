import { PrismaClient, Role, PaymentMethod } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const nusrat = await prisma.user.create({
    data: {
      name: "Nusrat",
      email: "nusrat@example.com",
      passwordHash,
      role: Role.PASSENGER,
    },
  });

  const rafiq = await prisma.user.create({
    data: {
      name: "Rafiq",
      email: "rafiq@example.com",
      passwordHash,
      role: Role.PASSENGER,
    },
  });

  const shirin = await prisma.user.create({
    data: {
      name: "Shirin",
      email: "shirin@example.com",
      passwordHash,
      role: Role.PASSENGER,
    },
  });

  const jashim = await prisma.user.create({
    data: {
      name: "Jashim",
      email: "jashim@example.com",
      passwordHash,
      role: Role.DRIVER,
    },
  });

  const bullet = await prisma.vehicle.create({
    data: { driverId: jashim.id, name: "Bullet", capacity: 3, isOnline: true },
  });

  const pool = await prisma.pool.create({
    data: { vehicleId: bullet.id, status: "OPEN", seatsUsed: 2 },
  });

  await prisma.rideRequest.create({
    data: {
      passengerId: nusrat.id,
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 1,
      poolId: pool.id,
      status: "MATCHED",
      baseFare: 5000,
      distanceCharge: 3000,
      poolDiscount: 1500,
      finalFare: 6500,
      paymentMethod: PaymentMethod.CASH,
      statusHistory: {
        create: [
          { toStatus: "REQUESTED" },
          { fromStatus: "REQUESTED", toStatus: "MATCHED" },
        ],
      },
    },
  });

  await prisma.rideRequest.create({
    data: {
      passengerId: rafiq.id,
      pickupZone: "Banani",
      destinationZone: "Gulshan 1",
      seats: 1,
      poolId: pool.id,
      status: "MATCHED",
      baseFare: 5000,
      distanceCharge: 3500,
      poolDiscount: 1500,
      finalFare: 7000,
      paymentMethod: PaymentMethod.CASH,
      statusHistory: {
        create: [
          { toStatus: "REQUESTED" },
          { fromStatus: "REQUESTED", toStatus: "MATCHED" },
        ],
      },
    },
  });

  await prisma.rideRequest.create({
    data: {
      passengerId: shirin.id,
      pickupZone: "Banani",
      destinationZone: "Mohakhali",
      seats: 1,
      status: "REQUESTED",
      baseFare: 5000,
      distanceCharge: 3000,
      poolDiscount: 0,
      finalFare: 8000,
      paymentMethod: PaymentMethod.TESLAPAY,
      statusHistory: { create: [{ toStatus: "REQUESTED" }] },
    },
  });

  console.log("Seed complete: Jashim/Bullet, Nusrat, Rafiq, Shirin created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
