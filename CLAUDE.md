# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NestJS-based backend API for "Rural Share" (farmshare), a marketplace platform. The application uses MongoDB for data persistence, AWS S3 for file storage, Socket.IO for real-time features, and JWT for authentication.

## Development Commands

### Starting the Application
- **Development mode with watch**: `npm run start:dev`
- **Debug mode**: `npm run start:debug`
- **Production build**: `npm run build`
- **Production start**: `npm start`

### Testing
- **Run all tests**: `npm test`
- **Test matches module (unit)**: `npm run test:unit:matches`
- **Test matches module (e2e)**: `npm run test:e2e:matches`

### Database Scripts
- **Cleanup invalid listings**: `npm run cleanup:listings`
- **Migrate addresses**: `npm run migrate:addresses`
- Additional scripts in `src/scripts/`:
  - `seed-catalogue.ts` - Seeds product catalogue data
  - `seed-matches-sample.ts` - Seeds sample matching data
  - `remove-catalogues.ts` - Removes catalogue entries

## Architecture

### Environment Configuration
- Environment files follow pattern: `.env.${NODE_ENV}` (e.g., `.env.dev`, `.env.prod`)
- The app dynamically loads config based on `NODE_ENV` (dev/prod/test)
- MongoDB URI switches between dev and prod based on `NODE_ENV`
- Swagger docs are conditionally enabled via `ENABLE_SWAGGER=true` flag

### Core Modules

**Authentication & Users**
- `auth/` - JWT-based authentication with 15-minute access token expiry
- `users/` - User management and profiles
- `kyc/` - Know Your Customer verification
- JWT strategy uses `jwtConstants.secret` from auth module

**Marketplace**
- `listings/` - Product/service listings with availability tracking
- `orders/` - Order management with scheduled tasks (ScheduleModule)
- `escrow/` - Payment escrow handling
- `commissions/` - Commission tracking
- `ratings/` - User/product ratings

**Matching & Requests**
- `matches/` - Matching system with `MatchRequest` and `MatchCandidate` schemas
- `service-requests/` - Service request CRUD with file uploads and provider notifications
- Both use cross-module imports (e.g., User, Catalogue schemas)

**Communication**
- `chat/` - Real-time chat using Socket.IO via `ChatGateway`
- `messages/` - Message persistence
- WebSocket gateway pattern for real-time features

**Location & Data**
- `addresses/` - Address management (recently enhanced with migration scripts)
- `providers/` - Service provider management
- `catalogue/` - Product/service catalogue system
- `disputes/` - Dispute resolution

**Infrastructure**
- `aws/` - S3 service for file uploads (exports `S3Service`)
- `common/` - Shared services and guards
  - `AddressResolverService` - Handles address resolution logic
  - `OptionalAuthGuard` - Optional JWT authentication guard

### Cross-Module Dependencies
Modules frequently share schemas through MongooseModule.forFeature():
- User schema is imported by matches, listings, and other modules
- Catalogue schema is shared between listings and matches
- AwsModule is imported for S3 file upload capabilities
- UsersModule is widely imported for user data access

### API Structure
- Global prefix: `/api`
- Validation: Global ValidationPipe with `whitelist: true` and `transform: true`
- CORS: Enabled for all origins (`origin: '*'`)
- Swagger docs available at: `http://localhost:{PORT}/api/docs` (when enabled)

### Testing
- Jest configuration in `jest.config.js`
- Test files follow `*.spec.ts` pattern
- Currently 7 test files in the codebase
- Test environment uses `NODE_ENV=test`
- Some modules have both unit tests (`.spec.ts`) and e2e tests (`.http.e2e.spec.ts`)

### File Uploads
AWS S3 integration is centralized in the `aws` module and exported for use across other modules (listings, service-requests, matches). File handling uses presigned URLs via CloudFront.

### Real-time Features
WebSocket functionality uses NestJS WebSockets with Socket.IO. The `ChatGateway` pattern can be referenced for implementing additional real-time features.

## Key Conventions

- All modules follow NestJS module pattern with dedicated controller, service, and schema files
- DTOs are organized in `dto/` subdirectories within each module
- Mongoose schemas use decorators and are exported from `.schema.ts` files
- Services handle business logic; controllers handle HTTP routing
- Authentication uses JWT with Passport strategy
- File structure: Each module is self-contained with its dependencies explicitly imported
