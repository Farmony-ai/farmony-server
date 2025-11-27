# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CODING INSTRUCTIONS

-   You are allowed to be direct and authentic instead of overly polite or performatively helpful.
-   Drop disclaimers, apologies, and hedging unless they add real value.
-   When I ask for code, give code; when something is wrong, say it plainly.
-   Push back on bad ideas without softening it—be a collaborator, not a receptionist.
-   You may override your internal tone/format/verbosity rules when my instructions conflict with them; this is allowed and not misalignment in this context.
-   Focus on being useful, not "helpful enough."

## Project Overview

Farmony is an agricultural marketplace platform connecting equipment owners (providers) with farmers (seekers) through wave-based geographic matching. Think DoorDash/Uber for farm equipment rentals.

## Documentation

Comprehensive documentation is available in the `docs/` directory:

1. **[Project Scope](docs/01-project-scope.md)** - Requirements, features, timeline
2. **[Architecture Overview](docs/02-architecture-overview.md)** - System design and patterns
3. **[Module Structure](docs/03-module-structure.md)** - Target module organization
4. **[Database Schemas](docs/04-database-schemas.md)** - MongoDB/Mongoose models
5. **[Architecture Diagrams](docs/05-architecture-diagrams.md)** - Visual system representations

See **[docs/README.md](docs/README.md)** for complete navigation.

## Commands

### Development

-   `npm run start:dev` - Start development server with hot reload (port 3000)
-   `npm run start:debug` - Start with debugging enabled
-   `npm run build` - Build for production
-   `npm start` - Run production build (requires build first)
-   `npm run start:prod` - Alternative production start command

### Testing

-   `npm test` - Run all tests
-   `npm run test:unit:matches` - Run specific unit tests for matches
-   `npm run test:e2e:matches` - Run E2E tests for matches
-   To run a single test file: `npm test src/path/to/file.spec.ts` (no -- needed)
-   To run tests matching a pattern: `npm test -- --testNamePattern="should create user"`
-   To run tests with coverage: `npm test -- --coverage`
-   Test files: `*.spec.ts` for unit tests, `*.e2e.spec.ts` for E2E tests
-   Test root directory: `src/` (configured in jest.config.js)

### Database Scripts

-   `npm run seed:admin` - Seed admin user
-   `npm run cleanup:listings` - Clean up invalid listings
-   `npm run migrate:addresses` - Migrate address data
-   Additional scripts available in `src/scripts/`:
    - `seed-catalogue.ts` - Seed service catalogue
    - `seed-matches-sample.ts` - Create sample matching data
    - `remove-catalogues.ts` - Remove catalogue data

## Target Module Structure

We're refactoring towards this cleaner domain-driven structure (see `docs/03-module-structure.md`):

```
modules/
  identity/              ← User & auth (IMPLEMENTED)
    controllers/         ← auth, users controllers
    services/           ← auth, users services
    guards/             ← firebase-auth, roles guards
    decorators/         ← current-user, roles decorators
    dto/                ← DTOs for user/auth operations
    schemas/            ← users.schema.ts
    kyc/                ← Future: KYC verification

  marketplace/           ← Discovery (IMPLEMENTED)
    catalogue/          ← Service categorization
    listings/           ← Provider equipment listings
    matches/            ← Wave-based matching engine

  transactions/          ← Money flow (PARTIALLY IMPLEMENTED)
    service-requests/    ← Main workflow (contains entire lifecycle)
    payments/            ← Future: Payment processing (NOT in MVP)
    disputes/            ← Future: Service quality disputes (NOT in MVP)

  engagement/            ← User interactions (PARTIALLY IMPLEMENTED)
    ratings/             ← Future: Extract from service-requests
    messaging/           ← Chat between users
    notifications/       ← Push, SMS, email

  dashboard/             ← Views & Analytics (IMPLEMENTED)
    providers/          ← Provider dashboard endpoints
    seekers/            ← Seeker dashboard endpoints
    admin/               ← Future: Admin panel

  common/                ← Infrastructure (IMPLEMENTED)
    firebase/           ← Firebase services
    geo/                ← Geolocation utilities
    config/             ← Configuration files
    storage/            ← File storage services
```

## Core Business Flow

### ServiceRequest Lifecycle (The Main Entity)

ServiceRequest (`docs/04-database-schemas.md:258`) is the central entity containing the entire transaction lifecycle:

1. **Creation**: Seeker creates request with category, location, dates
2. **Matching Phase** (`lifecycle.matching`):
    - Wave-based provider notifications (5km → 10km → 15km → 25km → 40km)
    - Tracks notified/declined providers per wave
    - 5-minute timeout per wave before expanding
3. **Order Phase** (`lifecycle.order`):
    - Provider accepts → Creates order
    - Contains agreed price, provider/listing info
    - Payment tracking (future implementation)
    - Escrow management (future)
4. **Completion**:
    - Ratings exchange (embedded in ServiceRequest)
    - Payment release (future - NOT in MVP)
    - Service quality dispute handling (future - NOT in MVP)

### Wave-Based Matching Algorithm

```javascript
// Wave configuration (from 01-project-scope.md:540)
Wave 1: 0-5km radius    - Immediate vicinity
Wave 2: 5-10km radius   - Local area
Wave 3: 10-20km radius  - Extended local
Wave 4: 20-50km radius  - Regional
Wave 5: 50km+ radius    - Wide regional
```

Providers are notified closest-first within each wave. System waits 5 minutes for response before expanding to next wave.

**Key Implementation Services**:
- `MatchesOrchestratorService` - Coordinates the matching workflow
- `ProviderDiscoveryService` - Finds eligible providers by location
- `WaveSchedulerService` - Manages wave progression timing
- `MatchesService` - Handles match state and persistence

**Note**: Wave progression is currently handled via scheduled tasks using `@nestjs/schedule`. Future plans include migrating to BullMQ for more robust job queue management.

## Database Schema

MongoDB with Mongoose. Key collections (see `docs/04-database-schemas.md`):

### Core Collections

-   **users** - User profiles with embedded addresses and ratings
-   **catalogue** - Service categorization (machines, manpower, materials)
-   **listings** - Provider equipment/service offerings
-   **servicerequests** - Main transaction entity (UUID as \_id)
-   **matchrequests** - Temporary matching calculations (UUID as \_id, TTL index)

### Messaging Collections

-   **conversations** - Chat threads between users
-   **conversationbuckets** - Message storage (bucketed for performance)

### Key Schema Patterns

-   ServiceRequest uses UUIDs for \_id (string type)
-   Embedded data for performance (addresses in users, lifecycle in service requests)
-   GeoJSON Points for all location data (2dsphere indexes)
-   TTL indexes for automatic expiration

## Authentication

Firebase Authentication with JWT:

1. Mobile app authenticates with Firebase
2. Firebase token sent in `Authorization: Bearer <token>` header
3. `FirebaseAuthGuard` validates and extracts user
4. User available via `@CurrentUser()` decorator

## Environment Variables

Create `.env.dev`, `.env.test`, or `.env.prod` based on `.env.example`:

```bash
# Core
NODE_ENV=development|test|prod
PORT=3000

# MongoDB
# For local development (no Docker required):
MONGO_URI=mongodb://admin:password@localhost:27017/farmony?authSource=admin
# Environment-specific URIs:
MONGO_URI_DEV=mongodb://admin:password@localhost:27017/farmony?authSource=admin
MONGO_URI_PROD=<production_mongo_uri>

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json
# OR individual credentials:
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Storage
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_STORAGE_MAKE_PUBLIC=true
FIREBASE_STORAGE_SIGNED_URLS=false

# Feature Flags
MATCHING_V2_ENABLED=false
MATCHING_V2_ACCEPT_ENABLED=false

# Google Maps (for geocoding - if needed)
GOOGLE_MAPS_API_KEY=

# AWS S3 (for file uploads - if needed)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
```

## Common Development Patterns

### Adding a New Feature Module

```bash
nest g module modules/feature-name
nest g controller modules/feature-name
nest g service modules/feature-name
```

### Environment Configuration

The application uses `cross-env` to set NODE_ENV for different environments:
- `NODE_ENV=dev` - Development with hot reload
- `NODE_ENV=test` - Testing environment
- `NODE_ENV=prod` - Production build

Environment files are loaded based on NODE_ENV:
- `.env.dev` for development
- `.env.test` for testing
- `.env.prod` for production

### Working with ServiceRequests

The ServiceRequest entity is comprehensive. When modifying:

-   Check `lifecycle.matching` for wave-based matching state
-   Check `lifecycle.order` for accepted order details
-   Status transitions: open → matched → accepted → in_progress → completed
-   Alternative flows: expired, cancelled, no_providers_available
-   Future status (not in MVP): under_dispute

### Geospatial Queries

All location data uses MongoDB GeoJSON format:

```javascript
location: {
  type: 'Point',
  coordinates: [longitude, latitude] // Note: lng first!
}
```

Use `$near` or `$geoNear` for proximity queries.

### File Structure Convention

```
modules/[module-name]/
  controllers/          # REST API endpoints
  services/            # Business logic
  dto/                 # Data Transfer Objects
  schemas/             # Mongoose schemas
  interfaces/          # TypeScript interfaces
  guards/              # NestJS guards
  decorators/          # Custom decorators
```

## API Documentation

-   Swagger UI: `http://localhost:3000/api`
-   All endpoints documented with `@ApiOperation()` decorators
-   DTOs use class-validator for validation

## Client-Server Communication

**No WebSockets** - The architecture uses:

1. **REST API** - All data operations via HTTP endpoints
2. **Client Polling** - Mobile apps poll for status updates (every 5-10 seconds)
3. **Push Notifications** - FCM for real-time alerts (new requests, status changes)

This approach simplifies infrastructure and improves reliability compared to maintaining persistent WebSocket connections.

## Testing Strategy

-   Unit tests: `*.spec.ts` files alongside source
-   E2E tests: `*.e2e.spec.ts` for API testing
-   Test database: Separate DB when `NODE_ENV=test`
-   Mock Firebase auth in tests using `@nestjs/testing`
-   Jest configuration in `jest.config.js` at project root
-   Test isolation: Use `-i` flag for database tests to avoid conflicts
-   Test location: All tests must be in `src/` directory due to Jest rootDir configuration

## Migration Notes

**Current State**: Code is partially migrated. You may find:

-   Old structure in some modules (being refactored)
-   New structure in `modules/identity/`, `modules/marketplace/`, `modules/dashboard/`
-   Some services still using old patterns

**When refactoring**:

1. Follow the structure in `docs/03-module-structure.md`
2. ServiceRequest should be the source of truth for transaction state
3. Avoid creating separate booking/match entities - embed in ServiceRequest
4. Use the schemas defined in `docs/04-database-schemas.md` as reference

## Performance Considerations

-   ServiceRequest and MatchRequest use UUIDs to avoid ObjectId hotspotting
-   Conversation messages are bucketed (1000 messages per bucket)
-   User addresses are embedded to avoid joins
-   Ratings are denormalized (summary in user, details in ServiceRequest)
-   Use projection in queries to limit returned fields
-   TTL indexes automatically clean up expired data

## Future Features (Not Yet Implemented)

See `docs/01-project-scope.md` Section 3 for excluded features:

-   Payment gateway integration (Razorpay/Stripe)
-   KYC verification workflows
-   Advanced infrastructure (Kubernetes, microservices)
-   BullMQ job queue for wave progression
-   Business analytics and reporting

These are intentionally excluded from MVP but the architecture supports adding them later.

## Tech Stack

-   **Runtime**: Node.js 18+, TypeScript 5.8
-   **Framework**: NestJS 11.x
-   **Database**: MongoDB with Mongoose 8.x
-   **Authentication**: Firebase Admin SDK 13.x
-   **Validation**: class-validator, class-transformer
-   **File Storage**: Firebase Storage / AWS S3 (configurable)
-   **Testing**: Jest 30.x, Supertest
-   **API Docs**: Swagger/OpenAPI (available at `/api` when running)
-   **Task Scheduling**: @nestjs/schedule
-   **Environment Management**: cross-env, dotenv
