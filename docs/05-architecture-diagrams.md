# Farmony Architecture Diagrams (Mermaid)

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Module Structure & Dependencies](#2-module-structure--dependencies)
3. [ServiceRequest Lifecycle Flow](#3-servicerequest-lifecycle-flow)
4. [Wave-Based Matching Algorithm](#4-wave-based-matching-algorithm)
5. [Database Schema Relationships](#5-database-schema-relationships)
6. [Authentication & Authorization Flow](#6-authentication--authorization-flow)
7. [Data Embedding Strategy](#7-data-embedding-strategy)
8. [Client-Server Communication Pattern](#8-client-server-communication-pattern)
9. [API Request Flow](#9-api-request-flow)

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        MA[Seeker Mobile App<br/>React Native]
        MB[Provider Mobile App<br/>React Native]
        WA[Admin Portal<br/>React Web]
    end

    subgraph "Client Communication"
        PL[REST API Polling<br/>Status Updates]
        PN[Push Notifications<br/>FCM]
    end

    subgraph "Authentication Layer"
        FA[Firebase Auth<br/>ID Tokens]
    end

    subgraph "API Gateway"
        NG[NestJS Backend<br/>REST API Only]
        FG[FirebaseAuthGuard]
    end

    subgraph "Domain Modules"
        ID[Identity<br/>Users, Auth, KYC*]
        MP[Marketplace<br/>Catalogue, Listings, Matches]
        TR[Transactions<br/>ServiceRequests, Payments*, Disputes*]
        EG[Engagement<br/>Messaging, Notifications, Ratings*]
        DB[Dashboard<br/>Provider View, Seeker View, Admin*]
    end

    subgraph "Common Infrastructure"
        CM[Common Module<br/>Firebase, Geo, Storage]
    end

    subgraph "Data Layer"
        MDB[(MongoDB<br/>Users, Catalogue, Listings<br/>ServiceRequests, MatchRequests<br/>Conversations, Buckets)]
    end

    subgraph "External Services"
        GM[Google Maps API]
        FCM[Firebase Cloud Messaging<br/>Push Notifications]
        S3[AWS S3 Storage]
        SMS[SMS Gateway*]
        PAY[Payment Gateway*]
    end

    MA --> PL
    MB --> PL
    WA --> PL
    MA --> PN
    MB --> PN
    PL --> FA
    FA --> NG
    NG --> FG
    FG --> ID
    FG --> MP
    FG --> TR
    FG --> EG
    FG --> DB
    ID --> CM
    MP --> CM
    TR --> CM
    EG --> CM
    DB --> CM
    CM --> MDB
    CM --> FCM
    CM --> GM
    CM --> S3
    CM --> SMS
    CM --> PAY
    EG --> FCM

    style MA fill:#e1f5fe
    style MB fill:#e1f5fe
    style WA fill:#e1f5fe
    style PL fill:#f0f4c3
    style PN fill:#f0f4c3
    style MDB fill:#fff3e0
    style TR fill:#ffebee
    style MP fill:#f3e5f5
    style EG fill:#e8f5e9
    style SMS stroke-dasharray: 5 5
    style PAY stroke-dasharray: 5 5
```

*\* = Future Implementation (Post-MVP)*

## 2. Module Structure & Dependencies

```mermaid
graph LR
    subgraph "src/modules"
        subgraph "identity/"
            A1[auth.controller]
            A2[auth.service]
            A3[users.controller]
            A4[users.service]
            A5[firebase-auth.guard]
            A6[kyc/*future*]
        end

        subgraph "marketplace/"
            B1[catalogue.controller]
            B2[catalogue.service]
            B3[listings.controller]
            B4[listings.service]
            B5[matches.controller]
            B6[matches.service]
        end

        subgraph "transactions/"
            C1[requests.controller]
            C2[requests.service]
            C3[matching.service]
            C4[order.service]
            C5[payments/*future*]
            C6[disputes/*future*]
        end

        subgraph "engagement/"
            D1[chat.controller]
            D2[chat.service]
            D3[push.service]
            D4[sms.service/*future*]
            D5[ratings/*future*]
        end

        subgraph "dashboard/"
            E1[provider-dash.service]
            E2[seeker-dash.service]
            E3[admin/*future*]
        end

        subgraph "common/"
            F1[firebase.service]
            F2[distance.service]
            F3[geocoding.service]
            F4[s3.service]
        end
    end

    A1 --> A2
    A3 --> A4
    B1 --> B2
    B3 --> B4
    B5 --> B6
    C1 --> C2
    C2 --> C3
    C2 --> C4
    D1 --> D2

    A2 --> F1
    B6 --> F2
    C3 --> F2
    B4 --> F4
    C2 --> F3
    D3 --> F1

    style A6 stroke-dasharray: 5 5
    style C5 stroke-dasharray: 5 5
    style C6 stroke-dasharray: 5 5
    style D4 stroke-dasharray: 5 5
    style D5 stroke-dasharray: 5 5
    style E3 stroke-dasharray: 5 5
```

## 3. ServiceRequest Lifecycle Flow

```mermaid
stateDiagram-v2
    [*] --> Open: Seeker Creates Request

    Open --> Matching: Start Wave Processing

    state Matching {
        [*] --> Wave1
        Wave1: Wave 1 (0-5km)
        Wave2: Wave 2 (5-10km)
        Wave3: Wave 3 (10-20km)
        Wave4: Wave 4 (20-50km)
        Wave5: Wave 5 (50km+)

        Wave1 --> NotifyProviders1
        NotifyProviders1 --> Wait1: Send Push
        Wait1 --> Wave2: No Response (5min)
        Wait1 --> Accepted: Provider Accepts

        Wave2 --> NotifyProviders2
        NotifyProviders2 --> Wait2: Send Push
        Wait2 --> Wave3: No Response (5min)
        Wait2 --> Accepted: Provider Accepts

        Wave3 --> NotifyProviders3
        NotifyProviders3 --> Wait3: Send Push
        Wait3 --> Wave4: No Response (5min)
        Wait3 --> Accepted: Provider Accepts

        Wave4 --> NotifyProviders4
        NotifyProviders4 --> Wait4: Send Push
        Wait4 --> Wave5: No Response (5min)
        Wait4 --> Accepted: Provider Accepts

        Wave5 --> NotifyProviders5
        NotifyProviders5 --> Wait5: Send Push
        Wait5 --> NoProviders: No Response
        Wait5 --> Accepted: Provider Accepts
    }

    Matching --> Accepted: Provider Accepts
    Matching --> NoProviders: All Waves Exhausted
    Matching --> Expired: TTL Reached
    Matching --> Cancelled: User Cancels

    Accepted --> InProgress: Service Starts
    InProgress --> Completed: Service Ends

    state Completed {
        [*] --> RatingExchange
        RatingExchange --> PaymentRelease
        PaymentRelease --> [*]
    }

    NoProviders --> [*]
    Expired --> [*]
    Cancelled --> [*]
    Completed --> [*]

    Accepted --> UnderDispute: Conflict Arises
    InProgress --> UnderDispute: Issue Reported
    UnderDispute --> Resolved: Admin Resolution
    Resolved --> Completed: Continue
    Resolved --> Cancelled: Terminate
```

## 4. Wave-Based Matching Algorithm

```mermaid
flowchart TD
    A[Service Request Created] --> B[Initialize Wave 1<br/>radius = 5km]
    B --> C{Find Providers<br/>in Radius}

    C -->|Found| D[Sort by Distance]
    C -->|Not Found| E{More Waves?}

    D --> F[Filter Already<br/>Notified]
    F --> G{New Providers?}

    G -->|Yes| H[Send Push<br/>Notifications]
    G -->|No| E

    H --> I[Record in<br/>notificationWaves]
    I --> J[Wait 5 Minutes]

    J --> K{Provider<br/>Accepted?}

    K -->|Yes| L[Create Order]
    K -->|No| M{Timeout?}

    M -->|No| J
    M -->|Yes| N[Expand Wave<br/>radius += 5km]

    N --> E

    E -->|Yes| C
    E -->|No| O[Mark as<br/>no_providers_available]

    L --> P[Stop Wave<br/>Processing]
    O --> P
    P --> Q[End]
```

### Wave Expansion Visualization

```mermaid
graph TB
    subgraph "Geographic Wave Expansion"
        C[Request Location<br/>0,0]

        subgraph "Wave 1 - 5km"
            P1[Provider 1<br/>3km]
            P2[Provider 2<br/>4km]
        end

        subgraph "Wave 2 - 10km"
            P3[Provider 3<br/>8km]
            P4[Provider 4<br/>9km]
        end

        subgraph "Wave 3 - 20km"
            P5[Provider 5<br/>18km]
            P6[Provider 6<br/>19km]
        end
    end

    C -.->|3km| P1
    C -.->|4km| P2
    C -.->|8km| P3
    C -.->|9km| P4
    C -.->|18km| P5
    C -.->|19km| P6

    style C fill:#ff9999
    style P1 fill:#99ff99
    style P2 fill:#99ff99
```

## 5. Database Schema Relationships

```mermaid
erDiagram
    USERS ||--o{ LISTINGS : provides
    USERS ||--o{ SERVICE_REQUESTS : creates
    USERS {
        ObjectId _id
        String name
        String phone
        Array addresses
        Object ratingSummary
        Object preferences
    }

    CATALOGUE ||--o{ LISTINGS : categorizes
    CATALOGUE ||--o{ SERVICE_REQUESTS : categorizes
    CATALOGUE {
        ObjectId _id
        String name
        String category
        ObjectId parentId
        Array categoryPath
    }

    LISTINGS {
        ObjectId _id
        ObjectId providerId
        ObjectId categoryId
        Object serviceAddress
        Number price
        Boolean isActive
    }

    SERVICE_REQUESTS ||--|| MATCH_REQUESTS : generates
    SERVICE_REQUESTS ||--o| CONVERSATIONS : creates
    SERVICE_REQUESTS {
        UUID _id
        ObjectId seekerId
        ObjectId categoryId
        GeoJSON location
        Object lifecycle_matching
        Object lifecycle_order
        Date expiresAt
    }

    MATCH_REQUESTS {
        UUID _id
        ObjectId seekerId
        Array candidates
        Date expiresAt_TTL
    }

    CONVERSATIONS ||--o{ CONVERSATION_BUCKETS : contains
    CONVERSATIONS {
        ObjectId _id
        Array participants
        ObjectId relatedOrderId
        Map unreadCount
    }

    CONVERSATION_BUCKETS {
        ObjectId _id
        ObjectId conversationId
        Number bucketNumber
        Array messages_max_1000
    }
```

## 6. Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant FB as Firebase Auth
    participant API as NestJS API
    participant Guard as FirebaseAuthGuard
    participant DB as MongoDB
    participant Ctrl as Controller

    App->>FB: 1. Phone + OTP
    FB-->>App: 2. Verify OTP
    FB-->>App: 3. ID Token

    App->>API: 4. API Request<br/>Bearer Token
    API->>Guard: 5. Validate Token
    Guard->>FB: 6. Verify Token
    FB-->>Guard: 7. User Data

    Guard->>DB: 8. Load User
    DB-->>Guard: 9. User Record

    Guard->>Ctrl: 10. Inject @CurrentUser
    Ctrl->>Ctrl: 11. Process Request
    Ctrl-->>App: 12. API Response
```

### Role-Based Access Control

```mermaid
graph TD
    subgraph "Role Hierarchy"
        ADMIN[Admin<br/>Full Access]
        FPO[FPO<br/>Commission Mgmt<br/>+ Analytics]
        SHG[SHG<br/>Group Mgmt<br/>+ Bulk Ops]
        IND[Individual<br/>Basic Operations]

        ADMIN --> FPO
        FPO --> SHG
        SHG --> IND
    end

    subgraph "Permissions"
        P1[Create Listings]
        P2[Create Requests]
        P3[Accept Requests]
        P4[Manage Members]
        P5[Bulk Operations]
        P6[View Analytics]
        P7[Manage Platform]
        P8[Moderate Content]
    end

    IND --> P1
    IND --> P2
    IND --> P3
    SHG --> P4
    SHG --> P5
    FPO --> P6
    ADMIN --> P7
    ADMIN --> P8
```

## 7. Data Embedding Strategy

```mermaid
flowchart LR
    subgraph "Traditional Normalized"
        U1[Users Table]
        A1[Addresses Table]
        B1[Bookings Table]
        R1[Ratings Table]
        P1[Payments Table]

        U1 -->|FK| A1
        B1 -->|FK| R1
        B1 -->|FK| P1
        U1 -->|FK| B1
    end

    subgraph "Our Embedded Approach"
        U2[User Document<br/>+ addresses[]<br/>+ ratingSummary{}]
        SR[ServiceRequest<br/>+ lifecycle.matching{}<br/>+ lifecycle.order{}<br/>+ ratings{}<br/>+ payment{}]
    end

    style U1 fill:#ffcccc
    style A1 fill:#ffcccc
    style B1 fill:#ffcccc
    style R1 fill:#ffcccc
    style P1 fill:#ffcccc

    style U2 fill:#ccffcc
    style SR fill:#ccffcc
```

### Embedding Decision Tree

```mermaid
flowchart TD
    A[Data Relationship] --> B{1-to-1 or<br/>1-to-few?}

    B -->|Yes| C{Frequently<br/>accessed together?}
    B -->|No| D[Use References]

    C -->|Yes| E{Under 16MB<br/>total size?}
    C -->|No| D

    E -->|Yes| F{Low update<br/>frequency?}
    E -->|No| G[Use Bucketing]

    F -->|Yes| H[✓ Embed Data]
    F -->|No| D

    style H fill:#90EE90
    style D fill:#FFB6C1
    style G fill:#87CEEB
```

## 8. Client-Server Communication Pattern

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as REST API
    participant FCM as FCM Push
    participant DB as MongoDB

    Note over App,DB: Service Request Creation & Monitoring

    App->>API: POST /service-requests
    API->>DB: Create Request
    API-->>App: 201 {id, status: 'open'}

    Note over API,FCM: Async Notification Flow
    API->>FCM: Send push to Wave 1 providers
    FCM-->>App: Push notification received

    Note over App,API: Client Polling Pattern
    loop Every 5-10 seconds
        App->>API: GET /service-requests/:id
        API->>DB: Check status
        DB-->>API: Current status
        API-->>App: {status, lifecycle data}

        alt Status changed
            App->>App: Update UI
        end
    end

    Note over API,DB: Provider Accepts
    API->>DB: Update status: 'accepted'
    API->>FCM: Push to seeker
    FCM-->>App: "Your request accepted!"

    App->>API: GET /service-requests/:id
    API-->>App: {status: 'accepted', provider details}
```

### Polling Intervals & Strategy

| Resource | Polling Interval | When to Poll | Cache Strategy |
|----------|-----------------|--------------|----------------|
| Service Request Status | 5-10 seconds | While status is 'open' or 'in_progress' | ETag/If-None-Match |
| Conversation Messages | 10 seconds | When chat screen is open | Last message timestamp |
| Dashboard Metrics | 30 seconds | When dashboard is visible | 5 minute cache |
| Available Listings | On demand | On search/filter change | 10 minute cache |
| User Profile | On demand | On profile view | 1 hour cache |

### Push Notification Events

```mermaid
flowchart LR
    subgraph "Push Notification Triggers"
        E1[New Request<br/>for Provider]
        E2[Request Accepted<br/>for Seeker]
        E3[Service Started<br/>for Seeker]
        E4[Service Completed<br/>for Both]
        E5[New Message<br/>in Chat]
        E6[Request Expired<br/>for Seeker]
    end

    subgraph "FCM Processing"
        FCM[Firebase Cloud<br/>Messaging]
    end

    subgraph "Client Actions"
        A1[Show Alert]
        A2[Update Badge]
        A3[Refresh Data]
        A4[Navigate to Screen]
    end

    E1 --> FCM
    E2 --> FCM
    E3 --> FCM
    E4 --> FCM
    E5 --> FCM
    E6 --> FCM

    FCM --> A1
    FCM --> A2
    FCM --> A3
    FCM --> A4
```

## 9. API Request Flow

```mermaid
flowchart TD
    A[Client Request] --> B[API Gateway]
    B --> C{ValidationPipe}

    C -->|Valid| D[FirebaseAuthGuard]
    C -->|Invalid| E[400 Bad Request]

    D -->|Authenticated| F[Controller]
    D -->|Unauthorized| G[401 Unauthorized]

    F --> H[Service Layer]

    H --> I[Business Logic]
    I --> J[MongoDB Operations]

    J --> K{Success?}

    K -->|Yes| L[Response Serialization]
    K -->|No| M[Error Handler]

    L --> N[201/200 Response]

    M --> O{Error Type}
    O -->|Business| P[409 Conflict]
    O -->|NotFound| Q[404 Not Found]
    O -->|Server| R[500 Internal Error]

    subgraph "Async Processing"
        I --> S[Job Queue]
        S --> T[Wave Matching]
        S --> U[Send Notifications]
        S --> V[Schedule Timers]
    end

    style E fill:#ffcccc
    style G fill:#ffcccc
    style P fill:#ffcccc
    style Q fill:#ffcccc
    style R fill:#ffcccc
    style N fill:#ccffcc
```

### Error Handling Pipeline

```mermaid
flowchart LR
    A[Exception Thrown] --> B[Global Exception Filter]

    B --> C{Exception Type}

    C -->|ValidationError| D[400 Bad Request<br/>Field Errors]
    C -->|UnauthorizedException| E[401 Unauthorized<br/>Invalid Token]
    C -->|ForbiddenException| F[403 Forbidden<br/>No Permission]
    C -->|NotFoundException| G[404 Not Found<br/>Resource Missing]
    C -->|ConflictException| H[409 Conflict<br/>Business Rule]
    C -->|Unknown| I[500 Server Error<br/>Log & Alert]

    D --> J[Error Response]
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J

    J --> K[Client]
```

## Legend

- **Solid Lines**: Implemented/MVP features
- **Dashed Lines**: Future implementations
- **Green Fill**: Optimal/Recommended approach
- **Red Fill**: Avoided/Anti-pattern
- **Blue Fill**: Alternative approach

## Notes

1. All diagrams represent the target architecture as defined in [03-module-structure.md](./03-module-structure.md)
2. ServiceRequest is the central entity containing the entire transaction lifecycle
3. Wave-based matching is the core differentiator of the platform
4. Embedding strategy optimizes for read performance over write flexibility
5. Future features (marked with *) are designed but not implemented in MVP