# Farmony Platform Constitution

## Core Principles

### I. ServiceRequest as Single Source of Truth
The `ServiceRequest` entity is the authoritative record for all transaction lifecycle data. All matching, order, payment (future), and dispute (future) information must be embedded within ServiceRequest, not scattered across separate collections. This principle ensures data consistency and simplifies queries.

**Rationale**: Prevents data fragmentation, reduces join operations, ensures atomic updates, and provides a complete transaction history in one document.

### II. Embedded Data Strategy
Favor embedding related data within parent documents over normalization when the embedded data:
- Is accessed together with the parent
- Has a clear ownership relationship
- Won't grow unbounded (or use bucketing if it might)

**Examples**:
- User addresses embedded in User document
- Transaction lifecycle embedded in ServiceRequest
- Rating summaries embedded in User, details embedded in ServiceRequest
- Messages bucketed in ConversationBucket (1000 messages per bucket)

**Rationale**: MongoDB performance optimization - fewer queries, better locality, atomic operations.

### III. REST + Polling + Push Communication
**NO WebSockets**. All client-server communication follows this pattern:
1. REST API for all operations (stateless, reliable)
2. Client polling for status updates (every 5-10 seconds)
3. Push notifications (FCM) for critical real-time alerts

**Rationale**: Simpler infrastructure, better mobile battery life, more reliable in poor network conditions, easier to debug and scale.

### IV. Domain-Driven Module Structure
All features must be organized into domain-based modules following the target structure:
- **Identity**: User management and authentication
- **Marketplace**: Discovery and matching (catalogue, listings, matches)
- **Transactions**: Service request lifecycle and payments
- **Engagement**: Messaging, notifications, ratings
- **Dashboard**: Analytics and reporting
- **Common**: Shared infrastructure services

Each module must have clear boundaries and single responsibility. No circular dependencies.

**Rationale**: Clean separation of concerns, easier navigation, supports future microservices migration.

### V. Geospatial-First Design
All location data must use MongoDB GeoJSON format with 2dsphere indexes. Coordinates MUST be in [longitude, latitude] order (NOT lat/lng).

```javascript
location: {
  type: 'Point',
  coordinates: [longitude, latitude] // lng first!
}
```

Use `$near` or `$geoNear` for all proximity queries to leverage indexes.

**Rationale**: Core to wave-based matching algorithm, enables efficient geographic searches, MongoDB optimized.

### VI. Firebase Authentication (NON-NEGOTIABLE)
All API endpoints (except public documentation) must use Firebase Authentication with JWT validation via `FirebaseAuthGuard`. User context accessed via `@CurrentUser()` decorator.

**Rationale**: Centralized auth, mobile-friendly, production-ready security, offloads auth complexity to Firebase.

### VII. Performance Through Indexes
Every collection must have appropriate indexes for common query patterns:
- Geospatial indexes for location-based queries
- Compound indexes for filtered lists
- TTL indexes for auto-expiring data (MatchRequest, expired ServiceRequests)
- Status/date indexes for dashboard queries

**Rationale**: MongoDB performance degrades rapidly without proper indexes. Indexes are critical for production scale.

### VIII. UUID for High-Write Entities
ServiceRequest and MatchRequest must use string UUIDs as `_id` instead of ObjectIds to prevent hotspotting in distributed systems.

**Rationale**: ObjectId generation includes timestamp in first bytes, causing sequential writes to same shard. UUIDs distribute writes evenly.

## Additional Constraints

### Data Management
1. **Bucketing for Unbounded Arrays**: Messages, notifications, or any array that could exceed 16MB must use bucketing pattern
2. **Denormalization Discipline**: When denormalizing (e.g., rating summaries), maintain update consistency - both copies must update atomically
3. **TTL Hygiene**: All temporary data must have TTL indexes for automatic cleanup

### API Design
1. **Swagger Documentation**: Every endpoint must have `@ApiOperation()` decorators
2. **DTO Validation**: All inputs validated with class-validator decorators
3. **Error Handling**: Use NestJS exception filters, return proper HTTP status codes
4. **Pagination**: All list endpoints must support pagination (offset or cursor-based)

### Testing Requirements
1. **Unit Tests**: Service layer logic must have unit tests (`*.spec.ts`)
2. **E2E Tests**: Critical user journeys must have E2E tests (`*.e2e.spec.ts`)
3. **Test Database**: Use separate database when `NODE_ENV=test`
4. **Mock External Services**: Firebase, S3, Google Maps should be mocked in tests

### Migration Hygiene
1. **Data Scripts**: All migrations must be idempotent and reversible
2. **Script Location**: Place in project root with clear naming (`migrate-*.js`)
3. **Script Documentation**: Include header comment explaining what, why, and rollback procedure
4. **Cleanup Scripts**: Provide cleanup/maintenance scripts for data hygiene

## Development Workflow

### Adding New Features
1. **Module Placement**: Identify correct domain module (Identity, Marketplace, Transactions, Engagement, Dashboard)
2. **Pattern Consistency**: Find similar existing patterns in codebase and follow them
3. **Schema First**: Design Mongoose schema with proper indexes before implementation
4. **Service Layer**: Business logic in services, controllers only handle HTTP concerns
5. **Documentation**: Update CLAUDE.md if introducing new patterns

### Code Review Checklist
All PRs must verify:
- [ ] Correct module placement per domain structure
- [ ] Firebase auth guard on protected endpoints
- [ ] Proper indexes defined in schema
- [ ] Embedded data strategy followed (no unnecessary separate collections)
- [ ] GeoJSON format correct (lng, lat order)
- [ ] DTOs validated with class-validator
- [ ] Swagger documentation added
- [ ] Tests included (unit or E2E)
- [ ] No WebSocket implementations introduced

### Quality Gates
Before merging to master:
- All tests must pass (`npm test`)
- Build must succeed (`npm run build`)
- No TypeScript errors
- Swagger docs generate correctly

## Governance

### Constitution Authority
This constitution defines the non-negotiable architecture and coding standards for Farmony. All code must comply with these principles unless:
1. Technical limitation prevents compliance (must be documented)
2. Constitution amendment is approved (requires rationale and migration plan)

### Amendment Process
1. Propose amendment with rationale in GitHub issue
2. Discuss trade-offs and alternatives
3. Update constitution with version bump (semantic versioning)
4. Create migration plan if existing code affected
5. Update all dependent templates and documentation

### Compliance Validation
- Constitution violations in PR reviews must be flagged
- `/speckit.analyze` command validates compliance
- Architecture decisions must reference relevant principles

### Living Documentation
Refer to [CLAUDE.md](../../CLAUDE.md) for day-to-day development guidance and implementation details. The constitution defines WHAT (principles), CLAUDE.md defines HOW (practical patterns).

**Version**: 1.0.0 | **Ratified**: 2025-11-09 | **Last Amended**: 2025-11-09
