# Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o| Vehicle : "owns (if DRIVER)"
    User ||--o{ RideRequest : "makes (if PASSENGER)"
    Vehicle ||--o{ Pool : "runs"
    Vehicle ||--o{ PoolDecline : "declined by"
    Pool ||--o{ RideRequest : "contains"
    RideRequest ||--o{ RideStatusHistory : "logs"
    RideRequest ||--o{ PoolDecline : "declined for"

    User {
        string id PK
        string name
        string email UK
        string passwordHash
        enum role "PASSENGER | DRIVER"
        datetime createdAt
    }

    Vehicle {
        string id PK
        string driverId FK
        string name
        int capacity
        boolean isOnline
        string currentZone "nullable; set when going online, updated on drop-off"
        datetime createdAt
    }

    Pool {
        string id PK
        string vehicleId FK
        enum status "OPEN | FULL | IN_PROGRESS | COMPLETED | CANCELLED"
        int seatsUsed
        datetime createdAt
        datetime startedAt
        datetime completedAt
    }

    RideRequest {
        string id PK
        string passengerId FK
        string pickupZone
        string destinationZone
        float pickupLat
        float pickupLng
        float destLat
        float destLng
        int seats
        string poolId FK
        enum status "REQUESTED | MATCHED | ACCEPTED | DRIVER_ARRIVED | STARTED | AWAITING_PAYMENT | COMPLETED | CANCELLED"
        int baseFare
        int distanceCharge
        int poolDiscount
        int finalFare
        enum paymentMethod "CASH | TESLAPAY"
        boolean paid
        datetime createdAt
        datetime updatedAt
    }

    RideStatusHistory {
        string id PK
        string rideRequestId FK
        enum fromStatus
        enum toStatus
        datetime changedAt
        string note "optional, e.g. 'Driver declined pool'"
    }

    PoolDecline {
        string id PK
        string rideRequestId FK
        string vehicleId FK
        datetime createdAt
    }
```

## Notes

- `Pool.seatsUsed` is a denormalized counter, updated inside a database transaction with a row lock (`SELECT ... FOR UPDATE`) to prevent overbooking under concurrent requests. This is what the concurrency test (`tests/concurrency.test.ts`) verifies directly.
- `RideStatusHistory` is append-only — every status transition creates a new row rather than mutating existing ones, giving a full audit trail per ride, including driver declines.
- `PoolDecline` records which vehicle declined which ride request, so `dispatchWaitingRequests` never re-offers a rider to a driver who already turned them down. `@@unique([rideRequestId, vehicleId])` prevents duplicate decline records.
- A `Vehicle` has at most one `driverId` (1:1) — each driver owns exactly one Tesla in this MVP.
- Money fields (`baseFare`, `distanceCharge`, `poolDiscount`, `finalFare`) are integers in poysha (1 Taka = 100 poysha), avoiding floating-point rounding errors.
