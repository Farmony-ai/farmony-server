# Firebase Authentication Issues Analysis

## Problem Summary

The current auth flow incorrectly uses `decodedToken.user_id` as a phone number, when it's actually the Firebase UID.

## Current Flow (Broken)

```typescript
// auth.service.ts:24
const phoneNumber = decodedToken.user_id;  // WRONG: user_id is Firebase UID, not phone
let user = await this.usersService.findByPhone(phoneNumber);  // Will never match
```

### What `decodedToken` actually contains:

| Auth Method | `uid` / `user_id` | `phone_number` | `email` |
|-------------|-------------------|----------------|---------|
| Phone OTP   | `firebase-uid-123` | `+919876543210` | `null` |
| Email/Pass  | `firebase-uid-456` | `null` | `admin@example.com` |

The `uid` is **always** a Firebase-generated identifier, never the phone/email itself.

## Issues

1. **Wrong field used for lookup**: `decodedToken.user_id` is Firebase UID, not phone
2. **`firebaseUserId` never populated**: Schema has the field but `create()` doesn't set it
3. **No `findByFirebaseUserId()` method**: Can't look up users by their Firebase UID
4. **Email/password auth broken**: Admins have no phone number, so lookup fails entirely
5. **Phone still marked required**: Schema has `phone: { required: true }` but admins don't have one

## Required Fixes

### 1. Add `findByFirebaseUserId()` to UsersService

```typescript
async findByFirebaseUserId(firebaseUserId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ firebaseUserId }).exec();
}
```

### 2. Update `CreateUserDto` and `create()` method

Add `firebaseUserId` to the DTO and ensure it's saved during creation.

### 3. Fix `firebaseLogin()` logic

```typescript
async firebaseLogin(dto: VerifyFirebaseTokenDto) {
    const decodedToken = await this.firebaseAdmin.verifyIdToken(dto.idToken);

    const firebaseUserId = decodedToken.uid;  // Correct: Firebase UID
    const phone = decodedToken.phone_number;  // May be null for email auth
    const email = decodedToken.email;         // May be null for phone auth

    // Primary lookup: by Firebase UID
    let user = await this.usersService.findByFirebaseUserId(firebaseUserId);

    if (!user) {
        // New user - create with firebaseUserId
        user = await this.usersService.create({
            firebaseUserId,
            phone: phone || dto.phoneNumber,  // Phone optional for admins
            email: email || dto.email,
            name: dto.name || 'User',
        });
    }
    // ... rest of flow
}
```

### 4. Make `phone` optional in schema

```typescript
@Prop({ type: String, index: true })  // Remove required: true
phone?: string;
```

### 5. Update uniqueness checks in `create()`

Currently checks phone uniqueness unconditionally. Should only check if phone is provided.

## Migration Consideration

Existing users won't have `firebaseUserId` populated. Options:
- Backfill script that matches users by phone and populates `firebaseUserId`
- Handle gracefully in login: if `findByFirebaseUserId` fails, fall back to phone lookup, then update the record with `firebaseUserId`
