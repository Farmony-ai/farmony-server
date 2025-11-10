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
    payments/            ← Future: Extract from service-requests
    disputes/            ← Future: Extract from service-requests

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
```
