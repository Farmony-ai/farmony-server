# Farmony Documentation

## 📚 Documentation Structure

This directory contains comprehensive documentation for the Farmony agricultural marketplace platform. Documents are numbered for logical reading order.

## 📑 Table of Contents

### 1. [Project Scope](./01-project-scope.md)
**Complete project requirements and specifications**
- Project overview and goals
- Included features (MVP scope)
- Explicitly excluded features
- Acceptance criteria
- Timeline and milestones
- Payment terms and legal details

### 2. [Architecture Overview](./02-architecture-overview.md)
**High-level system architecture and design decisions**
- System overview and layers
- Domain-driven module structure
- Core business flow (ServiceRequest lifecycle)
- Data flow examples
- Key design decisions
- Security architecture
- Client communication strategy (REST + Polling + Push)
- Performance optimizations
- Migration path

### 3. [Module Structure](./03-module-structure.md)
**Target module organization we're migrating towards**
- Clean domain separation
- Module responsibilities
- Future vs current implementation status

### 4. [Database Schemas](./04-database-schemas.md)
**Complete MongoDB/Mongoose schemas**
- User model with embedded addresses
- Catalogue (service categorization)
- Listing (provider equipment)
- ServiceRequest (main transaction entity)
- MatchRequest (temporary matching)
- Conversation and ConversationBucket
- GeoJSON utilities

### 5. [Architecture Diagrams](./05-architecture-diagrams.md)
**Visual representations using Mermaid diagrams**
- System architecture overview
- Module dependencies
- ServiceRequest lifecycle state machine
- Wave-based matching algorithm
- Database relationships (ERD)
- Authentication flow
- Data embedding strategy
- Client-server communication patterns
- API request flow

## 🎯 Quick Start for Developers

1. **New to the project?** Start with [Project Scope](./01-project-scope.md) to understand what we're building
2. **Understanding the architecture?** Read [Architecture Overview](./02-architecture-overview.md)
3. **Working on a feature?** Check [Module Structure](./03-module-structure.md) to find the right module
4. **Database work?** Reference [Database Schemas](./04-database-schemas.md)
5. **Need visual understanding?** Browse [Architecture Diagrams](./05-architecture-diagrams.md)

## 🔑 Key Concepts

### Wave-Based Matching
The core innovation - providers are notified in expanding geographic waves (5km → 10km → 15km → 25km → 40km) with 5-minute timeouts between waves.

### ServiceRequest as Central Entity
The `ServiceRequest` document contains the entire transaction lifecycle including matching, order, payment (future), and dispute (future) data.

### REST + Polling + Push
No WebSockets - we use REST APIs with client polling for updates and FCM push notifications for alerts.

### Embedded Data Strategy
User addresses, ratings, and transaction lifecycle data are embedded in documents for performance rather than normalized across collections.

## 📝 Documentation Standards

- **Numbered files**: For logical reading order
- **Markdown format**: For version control and readability
- **Mermaid diagrams**: For maintainable visual documentation
- **Clear sections**: Each document has a clear purpose
- **Cross-references**: Documents reference each other where relevant

## 🚀 Living Documentation

These documents are actively maintained and updated as the system evolves. When making changes:
1. Update relevant documentation
2. Ensure consistency across documents
3. Update CLAUDE.md if it affects development patterns

Last Updated: November 2024