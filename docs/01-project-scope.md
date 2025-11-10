# FARMONY - PROJECT SCOPE DOCUMENT

**Project:** Farmony Agricultural Marketplace Platform  
**Client:** Lakshmana Ravula  
**Developer:** Eswar Saladi & Anirudh Saladi  
**Version:** 1.0  
**Date:** October 27, 2025  
**Effective Date:** Upon signature of Change Order

---

## 1. PROJECT OVERVIEW

### 1.1 Purpose

This document defines the complete scope of work for the Farmony agricultural marketplace platform, establishing clear boundaries between included and excluded features, acceptance criteria, and delivery milestones.

### 1.2 Project Goals

-   Launch a functional agricultural services marketplace by January 15, 2026
-   Connect service providers (equipment owners) with seekers (farmers) through wave-based matching
-   Provide core marketplace functionality with manual workarounds for enterprise features
-   Create foundation for future feature enhancements based on market validation

### 1.3 Target Users

-   **Primary:** Farmers seeking agricultural equipment/services (Seekers)
-   **Secondary:** Equipment owners providing services (Providers)
-   **Tertiary:** Platform administrators managing operations

---

## 2. SCOPE OF WORK - INCLUDED FEATURES

### 2.1 User Authentication & Management

**Registration & Login:**

-   ✅ Phone number-based authentication via Firebase
-   ✅ OTP verification for secure access
-   ✅ Role selection (Seeker vs. Provider)
-   ✅ Basic profile creation during onboarding

**Profile Management:**

-   ✅ User profile with contact information
-   ✅ Profile photo upload and display
-   ✅ Location/address management
-   ✅ Service area definition for providers
-   ✅ Equipment catalog for providers (type, specifications, pricing)

**Account Features:**

-   ✅ Password reset functionality
-   ✅ Profile editing and updates
-   ✅ Account deactivation option
-   ✅ Session management and security

### 2.2 Wave-Based Matching Engine

**Request Creation (Seeker Side):**

-   ✅ Service request form with equipment type, location, date/time, duration
-   ✅ Request submission and tracking
-   ✅ Request status visibility

**Wave-Based Notification System:**

-   ✅ Proximity-based provider matching (closest first)
-   ✅ Automatic wave progression if no acceptance
-   ✅ Push notifications to matched providers
-   ✅ Request details visible to matched providers
-   ✅ Time window for response per wave

**Provider Response:**

-   ✅ Accept/reject functionality for incoming requests
-   ✅ View request details before acceptance
-   ✅ Dashboard showing available, in-progress, and completed requests

### 2.3 Service Listings & Discovery

**Seeker Features:**

-   ✅ Browse available equipment types/categories
-   ✅ View provider profiles and equipment details
-   ✅ See provider ratings and reviews
-   ✅ Filter by location and equipment type
-   ✅ Search functionality for specific equipment

**Provider Features:**

-   ✅ Create and manage equipment listings
-   ✅ Set pricing and availability
-   ✅ Update equipment specifications
-   ✅ Toggle availability status
-   ✅ View listing performance metrics

### 2.4 Order Management

**Order Lifecycle:**

-   ✅ Order creation upon provider acceptance
-   ✅ Order status tracking (Pending, Confirmed, In Progress, Completed, Cancelled)
-   ✅ Order details view for both parties
-   ✅ Order history and records

**Status Management:**

-   ✅ Provider can mark service as started
-   ✅ Provider can mark service as completed
-   ✅ Seeker receives notifications at status changes
-   ✅ Basic order timeline/audit log

**Post-Service:**

-   ✅ Completion confirmation by seeker
-   ✅ Rating and review prompt
-   ✅ Order marked as completed in system

### 2.5 Communication Features

**In-App Messaging:**

-   ✅ Direct messaging between matched seeker and provider
-   ✅ Message notifications
-   ✅ Chat history persistence
-   ✅ Message status indicators (sent, delivered, read)
-   ✅ Basic text messaging (no multimedia in MVP)

**Notification System:**

-   ✅ Push notifications for key events (match, acceptance, status changes)
-   ✅ In-app notification center
-   ✅ Notification preferences and settings

### 2.6 Ratings & Reviews

**Review System:**

-   ✅ 5-star rating system
-   ✅ Written review submission
-   ✅ Review display on provider profiles
-   ✅ Review submission after service completion
-   ✅ Average rating calculation and display

**Review Management:**

-   ✅ Review history for users
-   ✅ Basic moderation (admin can hide inappropriate reviews)
-   ✅ One review per completed order

### 2.7 Admin Dashboard

**User Management:**

-   ✅ View all users (seekers and providers)
-   ✅ User search and filtering
-   ✅ Basic user details and activity
-   ✅ User account status management (active/inactive)

**Order Management:**

-   ✅ View all orders across platform
-   ✅ Order status and details
-   ✅ Order filtering and search
-   ✅ Basic order analytics (counts, status distribution)

**Content Moderation:**

-   ✅ Review and flag management
-   ✅ Report handling interface
-   ✅ Basic content moderation tools

**Platform Monitoring:**

-   ✅ Basic dashboard with key metrics (user counts, order counts, active requests)
-   ✅ Recent activity feed
-   ✅ System health indicators

### 2.8 Multi-Language Support

**Language Options:**

-   ✅ English (default)
-   ✅ Hindi
-   ✅ Telugu
-   ✅ Tamil

**Implementation:**

-   ✅ UI text localization
-   ✅ Language selection in settings
-   ✅ Persistent language preference
-   ✅ All user-facing text translated

### 2.9 Design & User Experience

**Developer-Provided Design (Complete Mobile App):**

-   ✅ Authentication flow UI/UX design
-   ✅ Seeker flow (all screens)
-   ✅ Provider flow (all screens)
-   ✅ Chat/messaging interface (DoorDash-style patterns)
-   ✅ Ratings and reviews interface (DoorDash-style patterns)

**Design Approach:**
Mobile app follows proven marketplace design patterns ensuring familiar, intuitive user experience.

**Admin Dashboard:**
Functional UI using standard admin component libraries (e.g., Material-UI, Ant Design). Clean, professional interface for platform management.

**Design Value:**
Complete mobile application design represents ₹1.5-2L of additional value provided outside ₹10L development scope.

### 2.10 Technical Infrastructure

**Platform:**

-   ✅ React Native mobile application (iOS and Android)
-   ✅ Firebase backend services (Auth, Firestore, Cloud Functions, Storage)
-   ✅ Single-region deployment (India/Asia region)

**Database:**

-   ✅ Firestore database with 5 core collections
-   ✅ Optimized schema for marketplace operations
-   ✅ Indexed queries for performance

**Deployment:**

-   ✅ Google Play Store submission and approval
-   ✅ Apple App Store submission and approval
-   ✅ Production environment setup
-   ✅ Basic monitoring and logging

---

## 3. OUT OF SCOPE - EXPLICITLY EXCLUDED FEATURES

### 3.1 Payment Processing

**NOT Included:**

-   ❌ Payment gateway integration (Razorpay, Stripe, PayTM)
-   ❌ In-app payment collection
-   ❌ Escrow service for payment holding
-   ❌ Refund processing
-   ❌ Payment dispute resolution
-   ❌ Payment history and receipts
-   ❌ Multiple payment methods (UPI, cards, wallets)

**Rationale:** Payment integration with escrow requires 3-4 weeks of dedicated development, testing, and compliance work. This is recommended for Phase 2 after market validation.

**Workaround for MVP:** Manual payment handling via bank transfer, cash, or external payment apps. Order system tracks completion status without payment processing.

### 3.2 KYC Verification

**NOT Included:**

-   ❌ Document verification workflows (Aadhaar, PAN, business licenses)
-   ❌ ID document upload and processing
-   ❌ OCR/document scanning integration
-   ❌ Admin verification interface for documents
-   ❌ Verification status and badges
-   ❌ Background checks or verification services
-   ❌ Business registration verification

**Rationale:** KYC workflows require 2-3 weeks for document handling, admin workflows, and compliance. Recommended for Phase 2 as trust-building feature.

**Workaround for MVP:** Basic profile verification through phone number. Manual review of suspicious accounts by admin if needed.

### 3.3 Advanced Infrastructure

**NOT Included:**

-   ❌ Kubernetes (K8s) deployment
-   ❌ Microservices architecture
-   ❌ Multi-region deployment and CDN
-   ❌ Advanced load balancing
-   ❌ Auto-scaling infrastructure
-   ❌ Redis caching layer
-   ❌ Advanced monitoring (Prometheus, Grafana, ELK stack)

**Rationale:** Enterprise infrastructure requires 3-4 weeks for setup, configuration, and testing. Not necessary for MVP scale (hundreds of users). Recommended for Phase 3 when scaling beyond thousands of active users.

**MVP Approach:** Firebase managed services provide adequate performance and reliability for initial launch. Simple deployment, easy to maintain.

### 3.4 Automated Testing

**NOT Included:**

-   ❌ Comprehensive automated test suite (unit, integration, E2E)
-   ❌ Detox/Appium test framework setup
-   ❌ CI/CD pipeline with automated testing
-   ❌ Test coverage reporting
-   ❌ Performance testing
-   ❌ Load testing infrastructure
-   ❌ Device farm testing (BrowserStack, Sauce Labs)

**Rationale:** Comprehensive automated testing infrastructure requires 4-5 weeks for framework setup, test case development, and CI integration. Cost/benefit doesn't justify for MVP.

**MVP Approach:** Manual testing on real devices before each milestone. Thorough manual test cases for critical paths. Bug tracking and resolution process.

### 3.5 Advanced Features

**NOT Included:**

-   ❌ Advanced analytics and reporting
-   ❌ Data export and business intelligence tools
-   ❌ Promotional campaigns and discount codes
-   ❌ Subscription plans for providers
-   ❌ Advanced search with ML recommendations
-   ❌ Geofencing and location-based triggers
-   ❌ Integration with third-party services (weather, soil data, etc.)
-   ❌ Loyalty programs or rewards
-   ❌ Multi-item bookings
-   ❌ Scheduling calendar with availability management
-   ❌ Insurance or damage protection features
-   ❌ Video chat or multimedia messaging
-   ❌ Social features (follow, share, community)

**Rationale:** These features are enhancements beyond core marketplace functionality. Each adds 1-3 weeks of development time. Recommended for future phases based on user feedback and proven market demand.

---

## 4. ACCEPTANCE CRITERIA

The following 10 acceptance criteria must be met for project completion and final milestone payment:

### AC1: User Registration & Authentication

**Criteria:** Users can successfully register using phone number, receive and enter OTP, select role (Seeker/Provider), and create basic profile.  
**Test:** Register 5 new users (3 seekers, 2 providers) and verify all can log in/out successfully.

### AC2: Profile Management

**Criteria:** Users can view and edit their profile, upload profile photo, update contact information and location.  
**Test:** Edit profile for 3 users, upload photos, change location. Verify changes persist.

### AC3: Service Request Creation

**Criteria:** Seekers can create service requests with equipment type, location, date/time, and duration. Request is saved and visible in their dashboard.  
**Test:** Create 10 service requests across different equipment types and verify they appear in seeker dashboard.

### AC4: Wave-Based Matching

**Criteria:** When seeker creates request, system identifies providers within 5km radius, sends notification to closest provider first (Wave 1). If no acceptance within 5 minutes, proceeds to next wave (10km, 20km, etc.).  
**Test:** Create request, verify Wave 1 provider receives notification. Don't accept. After 5 minutes, verify Wave 2 provider receives notification.

### AC5: Provider Response

**Criteria:** Provider receives push notification for matched request, can view request details, and accept or reject. Acceptance creates order and stops wave progression.  
**Test:** Send 5 requests, have providers accept/reject in different waves. Verify order created on acceptance.

### AC6: Order Management

**Criteria:** Completed orders are visible to both parties with status (Pending → Confirmed → In Progress → Completed). Provider can update status. Both parties receive notifications.  
**Test:** Create 5 orders, progress through all statuses. Verify notifications sent and status updates correctly.

### AC7: In-App Messaging

**Criteria:** Seeker and provider can exchange text messages after match. Message history persists. Notifications work for new messages.  
**Test:** Send 20 messages between 5 different order conversations. Verify delivery, history, and notifications.

### AC8: Ratings & Reviews

**Criteria:** After order completion, seeker can submit 1-5 star rating and written review. Review appears on provider profile. Average rating calculates correctly.  
**Test:** Submit 10 reviews across 5 providers. Verify reviews display and average ratings calculate correctly.

### AC9: Admin Dashboard

**Criteria:** Admin can view all users, orders, and basic platform metrics. Can search/filter users and orders. Can hide inappropriate reviews.  
**Test:** Admin logs in, views 50+ users and 30+ orders. Performs searches and filters. Hides 2 test reviews.

### AC10: Multi-Language Support

**Criteria:** App supports English, Hindi, Telugu, and Tamil. User can switch language in settings. All UI text translates correctly.  
**Test:** Switch between all 4 languages. Navigate through key flows (registration, request creation, order view) in each language. Verify translations correct.

**Acceptance Process:**

-   Client tests each acceptance criteria in staging environment
-   Issues/bugs documented and fixed within warranty period
-   Final acceptance signoff required before M4 payment
-   Any criterion failing prevents milestone acceptance

---

## 5. TIMELINE & MILESTONES

### M1: Core Authentication & User Management

**Delivery Date:** November 15, 2025 (3 weeks)  
**Payment:** ₹2,50,000 upon acceptance

**Deliverables:**

-   Phone-based authentication (Firebase)
-   User registration with role selection
-   Profile creation and editing
-   Profile photo upload
-   Basic user dashboard
-   Multi-language support (4 languages)

**Acceptance Criteria:** AC1, AC2, AC10

---

### M2: Matching Engine & Service Management

**Delivery Date:** December 6, 2025 (3 weeks)  
**Payment:** ₹2,50,000 upon acceptance

**Deliverables:**

-   Service request creation (seeker side)
-   Equipment listing management (provider side)
-   Wave-based matching algorithm
-   Push notification system
-   Provider acceptance/rejection flow
-   Request status tracking

**Acceptance Criteria:** AC3, AC4, AC5

---

### M3: Orders, Messaging & Reviews

**Delivery Date:** December 20, 2025 (2 weeks)  
**Payment:** ₹2,50,000 upon acceptance

**Deliverables:**

-   Order management system
-   Order status tracking and updates
-   In-app messaging between matched users
-   Ratings and reviews functionality
-   Notification system for order events
-   Order history

**Acceptance Criteria:** AC6, AC7, AC8

---

### M4: Admin Dashboard & Launch Preparation

**Delivery Date:** January 15, 2026 (4 weeks)  
**Payment:** ₹2,50,000 upon acceptance

**Deliverables:**

-   Admin dashboard (user, order, content management)
-   App Store submissions (iOS and Android)
-   Production deployment
-   Final testing and bug fixes
-   User documentation and admin guide
-   30-day post-launch warranty support

**Acceptance Criteria:** AC9 + Full platform integration test

**Launch Requirements:**

-   All 10 acceptance criteria passing
-   Apps approved and live on both stores
-   Production environment stable
-   Admin trained on dashboard
-   Known issues documented with workarounds

---

## 6. TECHNICAL SPECIFICATIONS

### 6.1 Technology Stack

**Frontend (Mobile App):**

-   React Native 0.72+
-   TypeScript
-   React Navigation for routing
-   Firebase SDK for backend integration
-   Push notifications (Firebase Cloud Messaging)
-   i18n for multi-language support

**Backend:**

-   Firebase Authentication
-   Cloud Firestore (NoSQL database)
-   Firebase Cloud Functions (serverless)
-   Firebase Cloud Storage (file uploads)
-   Firebase Hosting (admin dashboard)

**Admin Dashboard:**

-   React.js web application
-   Material-UI or Ant Design component library
-   Firebase Admin SDK
-   Hosted on Firebase Hosting

**DevOps:**

-   Firebase project configuration
-   Environment management (dev, staging, prod)
-   Basic monitoring via Firebase Console
-   Error logging via Firebase Crashlytics

### 6.2 Database Schema

**Core Collections (5):**

1. **users** - User profiles, authentication data, roles
2. **requests** - Service requests from seekers
3. **orders** - Matched and confirmed service orders
4. **messages** - In-app messaging history
5. **reviews** - Ratings and reviews for providers

**Document Structure:**

-   Optimized for read-heavy workloads
-   Indexed fields for common queries
-   Denormalization for performance
-   Composite indexes for wave matching queries

### 6.3 Wave-Based Matching Algorithm

**Logic:**

1. Seeker creates request with location and equipment type
2. System queries providers:
    - Matching equipment type
    - Within current wave radius (5km, 10km, 20km, etc.)
    - Available/active status
    - Sorted by distance (closest first)
3. Send push notification to closest provider (Wave 1)
4. Wait 5 minutes for response
5. If no acceptance, proceed to next provider/wave
6. Continue until acceptance or all waves exhausted
7. On acceptance, create order and stop matching

**Wave Configuration:**

-   Wave 1: 0-5km radius
-   Wave 2: 5-10km radius
-   Wave 3: 10-20km radius
-   Wave 4: 20-50km radius
-   Wave 5: 50km+ radius

### 6.4 Security

**Authentication:**

-   Firebase phone authentication with OTP
-   Secure token-based sessions
-   Token refresh and expiration handling

**Data Protection:**

-   Firestore security rules enforcing user access control
-   Cloud Functions authentication validation
-   HTTPS for all API communications
-   File upload validation and sanitization

**Privacy:**

-   User data access limited to authorized parties
-   Phone numbers hashed/encrypted where possible
-   Location data used only for matching, not stored permanently
-   Review anonymization options

### 6.5 Performance Targets

**Response Times:**

-   App launch: < 3 seconds
-   Authentication: < 2 seconds
-   Request creation: < 2 seconds
-   Messaging: < 1 second
-   Profile updates: < 2 seconds

**Scalability:**

-   Support 1,000+ concurrent users
-   Handle 10,000+ requests per day
-   100,000+ messages per day
-   Database optimized for marketplace query patterns

**Availability:**

-   Target 99.5% uptime (managed by Firebase)
-   Graceful degradation if backend services slow
-   Offline capability for viewing cached data

---

## 7. CLIENT RESPONSIBILITIES

Client (Lakshmana Ravula) is responsible for providing:

### 7.1 Content & Assets

-   Brand assets (logo, colors, typography, icons)
-   Sample images for equipment categories
-   Terms of service and privacy policy content
-   App Store and Play Store account credentials
-   Company/business information for app submissions

### 7.2 Decisions & Approvals

-   Timely review and approval of designs (48-hour turnaround)
-   Milestone acceptance within 5 business days of delivery
-   Approval of app store submissions content
-   Feature prioritization decisions when conflicts arise
-   Final signoff on translations

### 7.3 Access & Environment

-   Firebase project ownership and billing
-   Apple Developer account ($99/year)
-   Google Play Developer account ($25 one-time)
-   Domain name if custom domain needed for admin dashboard
-   Any third-party service accounts required

### 7.4 Testing & Feedback

-   Participate in milestone acceptance testing
-   Provide feedback on staging environment within agreed timeframes
-   Recruit beta testers if desired (optional but recommended)
-   Report bugs and issues in structured format

### 7.5 Communication

-   Designate single point of contact for project
-   Weekly check-in meetings (30 minutes)
-   Respond to developer questions within 24 hours for blocking issues
-   Escalate concerns early rather than waiting

**Delays in client responsibilities may impact project timeline and milestone delivery dates.**

---

## 8. PAYMENT TERMS

### 8.1 Total Project Cost

**₹10,00,000** (Ten Lakh Rupees)

### 8.2 Payment Schedule

**Advance Payment (Already Paid):**

-   ₹3,00,000 - Paid upon project initiation

**Milestone Payments (Remaining):**

-   **M1 Payment:** ₹2,50,000 upon M1 acceptance (Nov 15, 2025)
-   **M2 Payment:** ₹2,50,000 upon M2 acceptance (Dec 6, 2025)
-   **M3 Payment:** ₹2,50,000 upon M3 acceptance (Dec 20, 2025)
-   **M4 Payment:** ₹2,50,000 upon M4 acceptance (Jan 15, 2026)

**Total Remaining:** ₹7,00,000

### 8.3 Payment Terms

-   Milestone payments due within 5 business days of acceptance
-   Acceptance defined as client signoff that acceptance criteria are met
-   Minor bugs/issues don't prevent acceptance if core functionality works
-   Payment via bank transfer to developer account

### 8.4 Non-Acceptance

If client does not accept milestone:

1. Client provides specific list of acceptance criteria failures
2. Developer has 5 business days to fix issues
3. Re-testing and acceptance process repeats
4. Payment released upon successful acceptance

If issues are outside defined acceptance criteria (scope creep), Change Request process applies.

---

## 9. ASSUMPTIONS

This project scope is based on the following assumptions:

### 9.1 Technical Assumptions

-   Firebase services remain available and pricing stable
-   React Native platform remains stable (no major breaking changes)
-   Apple and Google maintain current app review processes
-   No major changes to privacy/compliance requirements during development
-   Client provides required accounts and credentials promptly

### 9.2 Scope Assumptions

-   Features listed in Section 2 are complete and final
-   No additional features will be requested without Change Request
-   Manual workarounds acceptable for excluded features (Section 3)
-   4 languages (English, Hindi, Telugu, Tamil) are sufficient
-   Wave-based matching logic as described is acceptable

### 9.3 Timeline Assumptions

-   Client provides timely feedback and approvals (48 hours)
-   No major scope changes during development
-   App store review times are standard (1-7 days)
-   Holidays/weekends excluded from timeline counting
-   Developer availability as committed (no extended absences)

### 9.4 Resource Assumptions

-   Two developers (Eswar Saladi, Anirudh Emmadi) assigned to project
-   Client available for weekly check-ins and timely responses
-   Staging/testing environment accessible to client
-   No major external dependencies or integrations required

**If assumptions change materially, timeline and/or cost may be impacted and require change request.**

---

## 10. CHANGE MANAGEMENT

### 10.1 Change Request Process

**When Change Request Required:**

-   Adding features not in Section 2 (Scope of Work)
-   Modifying excluded features in Section 3
-   Significant changes to acceptance criteria
-   Timeline extensions beyond defined milestones
-   Architectural changes not covered in tech specs
-   Integration with third-party services

**Change Request Procedure:**

1. Client submits written change request with details
2. Developer assesses impact (scope, timeline, cost)
3. Developer provides change estimate within 3 business days
4. Client approves or declines change estimate
5. If approved, change order executed with updated terms
6. Work proceeds after change order signature

### 10.2 Minor Changes (No Change Request)

**Considered Minor (Included):**

-   UI/UX tweaks within approved designs
-   Bug fixes for issues found in testing
-   Small copy/text changes
-   Color or styling adjustments within design system
-   Performance optimizations within defined scope

**Process for Minor Changes:**

-   Discussed in weekly check-in meetings
-   Documented in meeting notes
-   Implemented in next milestone if time permits
-   No formal change order required

### 10.3 Timeline Impact

Changes impacting timeline:

-   Milestone dates may shift based on change complexity
-   Client notified immediately of timeline impact
-   Updated project schedule provided with change order
-   Subsequent milestones may shift to accommodate

---

## 11. INTELLECTUAL PROPERTY

### 11.1 Project-Specific IP (Client Owns)

Client receives full ownership of:

-   ✅ Complete source code for Farmony application
-   ✅ All design assets created for Farmony (UI/UX designs, graphics, logos)
-   ✅ Database schemas and configurations specific to Farmony
-   ✅ Documentation and technical specifications
-   ✅ Farmony brand name, identity, and business model
-   ✅ Firebase project and all data
-   ✅ Any content, text, or copy written for Farmony

**Transfer:** Upon final payment (M4), all project-specific IP transfers to client.

### 11.2 General-Purpose Tools & Techniques (Developer Retains)

Developer retains right to reuse in non-competing projects:

-   ✅ General algorithms and coding techniques (e.g., geospatial radius queries, distance calculations)
-   ✅ Reusable UI components not branded to Farmony
-   ✅ Development processes and methodologies
-   ✅ General marketplace patterns and approaches
-   ✅ Firebase configuration patterns and utilities

**Non-Compete Scope:**
Developer will not create competing agricultural marketplace in India targeting same user base for 12 months post-launch.

**Clarification:**
This allows developer to use learned techniques in other industries (e.g., food delivery, ride sharing, home services) without restriction. Agricultural marketplace constraint applies only to directly competing products.

### 11.3 Third-Party & Open Source

Project includes:

-   Open source libraries and frameworks (React Native, Firebase SDK, etc.)
-   Third-party services (Firebase, Apple/Google platforms)
-   Existing icons and design resources from licensed sources

Client receives project under these libraries' existing licenses. Developer makes no warranty of ownership for third-party components.

### 11.4 Portfolio & Marketing

Developer retains right to:

-   Include Farmony in portfolio and case studies
-   Show screenshots/demos (with client approval of specific content)
-   Reference project in general terms ("agricultural marketplace")
-   Use as reference for future clients

Client may request anonymity or delayed public disclosure if needed.

---

## 12. WARRANTY & SUPPORT

### 12.1 Warranty Period

**30 Days Post-Launch (M4 Completion)**

Warranty covers:

-   ✅ Bugs in delivered features (Section 2)
-   ✅ Acceptance criteria not functioning as specified
-   ✅ Critical production issues affecting core functionality
-   ✅ Performance issues within defined targets (Section 6.5)
-   ✅ Security vulnerabilities in delivered code

Warranty does NOT cover:

-   ❌ Feature requests or enhancements
-   ❌ Issues caused by client modifications to code
-   ❌ Third-party service outages (Firebase, Apple, Google)
-   ❌ Operating system or platform updates breaking compatibility
-   ❌ Issues with excluded features (Section 3)
-   ❌ User error or misuse of platform

### 12.2 Response Times (During Warranty)

**Critical Issues (App completely down):**

-   Response: 4 hours
-   Resolution target: 24 hours

**High Priority (Core feature broken):**

-   Response: 8 hours
-   Resolution target: 48 hours

**Medium Priority (Minor feature issue):**

-   Response: 24 hours
-   Resolution target: 5 business days

**Low Priority (Cosmetic, non-blocking):**

-   Response: 48 hours
-   Resolution target: Best effort

### 12.3 Post-Warranty Support

After 30-day warranty expires, ongoing support available at:

-   **Bug Fixes:** ₹5,000 per issue (estimated, may vary by complexity)
-   **Minor Updates:** ₹10,000-25,000 per month retainer
-   **Major Enhancements:** Quoted separately based on scope

**Recommended:** Monthly retainer for ongoing maintenance, minor updates, and platform monitoring.

### 12.4 Knowledge Transfer

Included at M4 completion:

-   Code walkthrough session (2 hours)
-   Documentation of architecture and key systems
-   Admin dashboard training (1 hour)
-   Deployment and monitoring guide
-   FAQ document for common issues

**Optional (Additional Cost):** Extended training for client's technical team if desired.

---

## 13. TERMS & CONDITIONS

### 13.1 Confidentiality

Both parties agree to keep confidential:

-   Business strategies and plans
-   Technical implementations and code (pre-launch)
-   Financial terms of this agreement
-   User data and private information
-   Any information marked "confidential"

Confidentiality survives project completion indefinitely.

### 13.2 Liability Limitations

**Developer Liability Limited To:**
Maximum liability for any claim: Total amount paid for project (₹10L)

**Developer NOT Liable For:**

-   Indirect, consequential, or incidental damages
-   Lost profits or business opportunities
-   Third-party claims against client
-   Issues caused by client modifications or misuse
-   Force majeure events (natural disasters, war, pandemic, etc.)
-   Third-party service failures (Firebase, app stores, etc.)

### 13.3 Termination

**Client Termination Rights:**

-   Terminate for convenience with 15 days written notice
-   Pay for work completed to date (pro-rated milestone)
-   Receive code and deliverables completed up to termination date
-   No refund of advance payment if work has commenced

**Developer Termination Rights:**

-   Terminate if client misses 2+ milestone payments
-   Terminate if client breaches material terms
-   15 days written notice required
-   Client pays for work completed to date

**Mutual Termination:**

-   Both parties can agree to terminate at any time
-   Settlement of payments for work completed
-   Handover of all completed deliverables
-   Clean break with no further obligations

### 13.4 Dispute Resolution

**Process:**

1. Good faith discussion between parties (7 days)
2. Mediation with neutral third party if needed (14 days)
3. Binding arbitration in Dallas, Texas if mediation fails
4. Arbitration costs split equally
5. Texas law governs this agreement

**During Dispute:**

-   Work may be paused pending resolution
-   Payments held in escrow if applicable
-   Both parties refrain from public disparagement
-   Confidentiality remains in effect

### 13.5 Force Majeure

Neither party liable for delays caused by:

-   Natural disasters, pandemics, war
-   Government actions or regulations
-   Internet or infrastructure outages beyond control
-   Strikes or labor disputes
-   Acts of terrorism or civil unrest

Timeline extended by duration of force majeure event. If event exceeds 30 days, either party may terminate.

---

## 14. SIGNATURES

**By signing below, both parties agree to all terms in this Project Scope document and the accompanying Change Order.**

---

**CLIENT:**

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Name: Lakshmana Ravula  
Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**DEVELOPER:**

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Name: Eswar Saladi  
Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
Name: Anirudh Emmadi  
Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

**END OF DOCUMENT**
