```
modules/
  identity/              ← User & auth
    controllers/
    services/
    kyc/                 ← Future: KYC verification

  marketplace/           ← Discovery
    catalogue/
    listings/
    matches/

  transactions/          ← Money flow
    service-requests/    ← Main workflow
    payments/            ← Future: Payment processing (NOT in MVP)
    disputes/            ← Future: Service quality disputes (NOT in MVP)

  engagement/            ← User interactions
    ratings/             ← Future: Extract from service-requests
    messaging/           ← Future: Order chat + general chat
    notifications/       ← Push, SMS, email

  dashboard/             ← Views
    providers/
    seekers/
    admin/               ← Future: Admin panel

  common/                ← Infrastructure
    firebase/
    geo/
    queues/              ← Background job processing
```
