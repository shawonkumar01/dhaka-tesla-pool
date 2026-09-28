-- CreateTable
CREATE TABLE "PoolDecline" (
    "id" TEXT NOT NULL,
    "rideRequestId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolDecline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PoolDecline_rideRequestId_vehicleId_key" ON "PoolDecline"("rideRequestId", "vehicleId");

-- AddForeignKey
ALTER TABLE "PoolDecline" ADD CONSTRAINT "PoolDecline_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolDecline" ADD CONSTRAINT "PoolDecline_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
