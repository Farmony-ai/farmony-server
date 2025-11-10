# Farmony Architecture Documentation

## System Overview

Farmony is an agricultural marketplace platform that connects equipment owners (providers) with farmers (seekers) through a unique wave-based geographic matching system. The platform facilitates equipment rentals, service bookings, and manages the entire transaction lifecycle.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile App (React Native)                │
├─────────────────────────────────────────────────────────────┤
│                    Firebase Authentication                   │
├─────────────────────────────────────────────────────────────┤
│                     NestJS Backend (REST API)                │
├─────────────────────────────────────────────────────────────┤
│  Identity │ Marketplace │ Transactions │ Engagement │ Dashboard │
├─────────────────────────────────────────────────────────────┤
│                      MongoDB Database                        │
│                    (Geospatial Indexes)                     │
├─────────────────────────────────────────────────────────────┤
│     Firebase Services    │    AWS S3    │   Google Maps     │
└─────────────────────────────────────────────────────────────┘
```

## Domain-Driven Module Structure

### 1. Identity Module
**Purpose**: User management and authentication

- **User Management**: Registration, profiles, addresses
- **Authentication**: Firebase integration, JWT validation
- **KYC** (Future): Document verification workflows

**Key Components**:
- `FirebaseAuthGuard`: Validates Firebase tokens
- `UserService`: User CRUD operations
- Embedded addresses for performance

### 2. Marketplace Module
**Purpose**: Discovery and matching

- **Catalogue**: Service categorization (machines, manpower, materials)
- **Listings**: Provider equipment/service offerings
- **Matches**: Wave-based geographic matching engine

**Wave-Based Matching**:
```
Wave 1: 0-5km    → Immediate vicinity
Wave 2: 5-10km   → Local area
Wave 3: 10-20km  → Extended local
Wave 4: 20-50km  → Regional
Wave 5: 50km+    → Wide regional
```

### 3. Transactions Module
**Purpose**: Core transaction lifecycle management

**ServiceRequest Entity** - The central entity containing:
- **Creation**: Category, location, dates, requirements
- **Matching Lifecycle** (`lifecycle.matching`):
  - Wave progression tracking
  - Provider notifications per wave
  - Declined/accepted provider lists
- **Order Lifecycle** (`lifecycle.order`):
  - Provider acceptance details
  - Pricing agreements
  - Payment tracking (future)
  - Escrow management (future)
- **Completion**:
  - Embedded ratings
  - Dispute resolution (future)

### 4. Engagement Module
**Purpose**: User interactions and communications

- **Messaging**: REST API-based chat between matched users
- **Notifications**: Push notifications via FCM
- **Ratings** (Future): Extract from ServiceRequest

**Conversation Architecture**:
- `Conversation`: Thread metadata
- `ConversationBucket`: Message storage (1000 msgs/bucket)
- **No WebSockets**: Clients poll for new messages

### 5. Dashboard Module
**Purpose**: Analytics and reporting

- **Provider Dashboard**: Listings, bookings, earnings
- **Seeker Dashboard**: Requests, bookings, expenses
- **Admin Panel** (Future): Platform management

### 6. Common Module
**Purpose**: Shared infrastructure services

- **Firebase Services**: Auth, storage, notifications
- **Geo Utilities**: Distance calculations, geocoding
- **File Upload**: S3 integration

## Data Flow Examples

### Service Request Flow

```
Seeker Creates Request
        ↓
[ServiceRequest Created]
        ↓
Wave 1: Find Providers < 5km
        ↓
Send Push Notifications
        ↓
Wait 5 minutes
        ↓
No Response? → Wave 2: 10km
        ↓
Provider Accepts
        ↓
[Order Created in ServiceRequest.lifecycle.order]
        ↓
Service Delivered
        ↓
Ratings Exchange
        ↓
[Request Completed]
```

### Key Design Decisions

1. **Embedded Data Strategy**
   - User addresses embedded in User document
   - Entire lifecycle embedded in ServiceRequest
   - Ratings denormalized (summary in User, details in ServiceRequest)
   - Benefits: Fewer queries, better performance

2. **UUID for ServiceRequests**
   - Uses string UUIDs instead of ObjectIds
   - Avoids ObjectId hotspotting
   - Better for distributed systems

3. **Message Bucketing**
   - Conversations split into buckets (1000 messages each)
   - Prevents document size limits
   - Improves query performance

4. **TTL Indexes**
   - Automatic cleanup of expired MatchRequests
   - ServiceRequests auto-expire after deadline

5. **Geospatial Indexing**
   - All locations use MongoDB GeoJSON format
   - 2dsphere indexes for proximity queries
   - Efficient wave-based matching

## Database Schema

### Core Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User profiles | name, phone, addresses[], ratingSummary |
| `catalogue` | Service categories | name, category, transactionType |
| `listings` | Provider offerings | providerId, categoryId, price, location |
| `servicerequests` | Main transaction | _id (UUID), lifecycle.matching, lifecycle.order |
| `matchrequests` | Temp matching | _id (UUID), candidates[], TTL |
| `conversations` | Chat threads | participants[], relatedOrderId |
| `conversationbuckets` | Messages | conversationId, messages[] |

### Index Strategy

```javascript
// Geospatial indexes
ServiceRequest: { location: '2dsphere' }
Listing: { 'serviceAddress.location': '2dsphere' }
User: { 'addresses.location': '2dsphere' }

// Query optimization
ServiceRequest: { status: 1, expiresAt: 1 }
ServiceRequest: { 'lifecycle.order.providerId': 1, status: 1 }
Listing: { categoryId: 1, isActive: 1 }

// TTL for auto-cleanup
MatchRequest: { expiresAt: 1 } // expireAfterSeconds: 0
```

## API Structure

### RESTful Endpoints

```
/api/
  /auth
    POST /register
    POST /login
    POST /refresh

  /users
    GET /profile
    PUT /profile
    POST /addresses

  /catalogue
    GET /categories
    GET /categories/:id/items

  /listings
    POST /
    GET /:id
    PUT /:id
    GET /search

  /service-requests
    POST /
    GET /:id
    PUT /:id/accept
    PUT /:id/complete
    GET /my-requests

  /matches
    POST /find-providers
    GET /:requestId/candidates

  /conversations
    GET /
    GET /:id/messages
    POST /:id/messages
```

## Client Communication Strategy

### REST API + Polling Architecture
The system deliberately avoids WebSockets in favor of a simpler, more reliable approach:

1. **REST API**: All operations are standard HTTP requests
   - Stateless and scalable
   - Works reliably through firewalls and proxies
   - Simple to debug and monitor

2. **Client Polling**: Mobile apps poll for updates
   - Status checks: `/service-requests/:id` every 5-10 seconds
   - Message checks: `/conversations/:id/messages` every 10 seconds
   - Efficient with HTTP caching headers

3. **Push Notifications**: Real-time alerts via FCM
   - Critical events trigger immediate push notifications
   - Users get alerted without needing the app open
   - Fallback to polling if push fails

**Benefits**:
- No persistent connection management
- Better battery life on mobile devices
- Simpler infrastructure (no WebSocket servers)
- More reliable in poor network conditions

## Security Architecture

### Authentication Flow
```
Mobile App → Firebase Auth → ID Token
     ↓
Backend API ← Bearer Token in Header
     ↓
FirebaseAuthGuard → Validate Token
     ↓
Extract User → @CurrentUser() Decorator
```

### Authorization Patterns
- Role-based access (individual, SHG, FPO, admin)
- Resource ownership checks
- Firebase security rules for client SDK

## Performance Optimizations

1. **Query Projections**: Limit returned fields
2. **Embedded Data**: Reduce join operations
3. **Bucketing**: Prevent large documents
4. **Indexes**: Optimize common queries
5. **TTL**: Automatic data cleanup
6. **UUID Strategy**: Better distribution
7. **Denormalization**: Trade storage for speed

## Deployment Architecture

### Current (MVP)
```
Firebase Hosting → Admin Dashboard
Firebase Functions → Serverless compute
Firestore/MongoDB → Database
Firebase Storage → File uploads
```

### Future (Scale)
```
Kubernetes → Container orchestration
Microservices → Service separation
Redis → Caching layer
CDN → Global content delivery
```

## Migration Path

### Current State
- Legacy structure in `modules/bookings/`
- Mixed patterns and responsibilities
- Separate entities for matches/bookings

### Target State
- Clean domain modules
- ServiceRequest as single source of truth
- Embedded lifecycle management
- Clear separation of concerns

### Migration Strategy
1. Create new module structure
2. Move services incrementally
3. Refactor to use embedded patterns
4. Update API endpoints
5. Deprecate old modules
6. Clean up legacy code

## Development Guidelines

### When Adding Features
1. Identify the domain module
2. Follow existing patterns
3. Embed data when appropriate
4. Add proper indexes
5. Include API documentation
6. Write tests

### Common Pitfalls to Avoid
- Creating separate entities when embedding makes sense
- Forgetting geospatial indexes
- Not using UUIDs for high-write collections
- Missing TTL indexes for temporary data
- Over-normalizing data

## Monitoring & Observability

### Key Metrics
- Wave expansion rates
- Provider response times
- Match success rates
- API response times
- Database query performance

### Health Checks
- Database connectivity
- Firebase service status
- S3 availability
- Memory/CPU usage

## Future Enhancements

### Phase 2 (Post-MVP)
- Payment gateway integration
- KYC verification
- Advanced matching algorithms
- In-app voice/video calls

### Phase 3 (Scale)
- Microservices architecture
- Multi-region deployment
- Advanced analytics
- ML-based recommendations

## References

- Module Structure: [03-module-structure.md](./03-module-structure.md)
- Database Schemas: [04-database-schemas.md](./04-database-schemas.md)
- Project Scope: [01-project-scope.md](./01-project-scope.md)
- Development Guide: [../CLAUDE.md](../CLAUDE.md)