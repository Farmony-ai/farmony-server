# Identity Module Security Fixes Spec

## Problem Statement

The identity module has security vulnerabilities where most endpoints in `UsersController` lack authentication and authorization. Additionally, the `FirebaseAuthGuard` doesn't hydrate the MongoDB user, making it impossible to use `userId` in controllers.

## Current Issues

### 1. Unprotected Endpoints in UsersController

| Endpoint | Current State | Risk |
|----------|---------------|------|
| `GET /users/:id` | No auth | Anyone can view any user's profile |
| `PATCH /users/:id` | No auth | Anyone can update any user |
| `GET /users/:id/preferences` | No auth | Anyone can view preferences |
| `PATCH /users/:id/preferences` | No auth | Anyone can update preferences |
| `PATCH /users/:id/verify` | No auth | Anyone can verify users |
| `PATCH /users/:id/unverify` | No auth | Anyone can unverify users |
| `GET /users/check-phone/:phone` | No auth | Phone enumeration (acceptable for registration flow) |
| `GET /users/debug/phones` | No auth | **Critical** - Leaks all user data |
| `POST /users/:id/profile-picture` | No auth | Anyone can change any user's photo |
| `DELETE /users/:id/profile-picture` | No auth | Anyone can delete any user's photo |
| `POST /users/fcm-token` | No auth | Will fail - uses undefined `userId` |
| `DELETE /users/fcm-token` | No auth | Will fail - uses undefined `userId` |
| All `/users/:id/addresses/*` | No auth | Anyone can CRUD any user's addresses |

### 2. FirebaseAuthGuard Missing User Hydration

Current guard only sets Firebase claims on `request.user`:
```typescript
request.user = {
    uid: decodedToken.uid,        // Firebase UID
    phone: decodedToken.phone_number,
    // ... other Firebase claims
    // Missing: userId (MongoDB _id)
}
```

Controllers need `userId` (MongoDB ObjectId) for database operations.

### 3. No Ownership Validation

Even with auth, there's no check that users can only modify their own data.

---

## Proposed Changes

### 1. Update FirebaseAuthGuard

**File:** `src/modules/identity/guards/firebase-auth.guard.ts`

**Changes:**
- Inject `UsersService` (requires making guard request-scoped or using ModuleRef)
- After verifying Firebase token, lookup user in MongoDB by `firebaseUserId`
- Set `userId` (MongoDB `_id`) on `request.user`
- Throw 401 if user doesn't exist in database

**New request.user shape:**
```typescript
request.user = {
    userId: string,              // MongoDB _id (NEW)
    uid: string,                 // Firebase UID
    phone: string,
    email: string,
    role: string,
    isProvider: boolean,
    isSeeker: boolean,
    isAdmin: boolean,
    isVerified: boolean,
    kycStatus: string,
}
```

### 2. Create OwnershipGuard

**File:** `src/modules/identity/guards/ownership.guard.ts` (NEW)

**Purpose:** Validates that the `:id` param matches the authenticated user's `userId`, OR user is admin.

**Usage:**
```typescript
@UseGuards(FirebaseAuthGuard, OwnershipGuard)
@Patch(':id')
async updateUser(...) { }
```

### 3. Secure UsersController

**File:** `src/modules/identity/controllers/users.controller.ts`

**Changes:**

| Endpoint | Guards | Notes |
|----------|--------|-------|
| `GET /users/:id` | `FirebaseAuthGuard` | Allow viewing any user (public profiles) |
| `PATCH /users/:id` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `GET /users/:id/preferences` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `PATCH /users/:id/preferences` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `PATCH /users/:id/verify` | `FirebaseAuthGuard`, `RolesGuard` | Admin only |
| `PATCH /users/:id/unverify` | `FirebaseAuthGuard`, `RolesGuard` | Admin only |
| `GET /users/check-phone/:phone` | None | Keep public for registration flow |
| `GET /users/debug/phones` | **DELETE** | Remove entirely |
| `POST /users/:id/profile-picture` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `DELETE /users/:id/profile-picture` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `POST /users/fcm-token` | `FirebaseAuthGuard` | Uses `currentUser.userId` |
| `DELETE /users/fcm-token` | `FirebaseAuthGuard` | Uses `currentUser.userId` |
| `GET /users/:id/addresses` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `GET /users/:userId/addresses/:addressId` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `POST /users/:id/addresses` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `PATCH /users/:userId/addresses/:addressId` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `DELETE /users/:userId/addresses/:addressId` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |
| `PATCH /users/:id/default-address` | `FirebaseAuthGuard`, `OwnershipGuard` | Owner or admin only |

### 4. Add /users/me Endpoint

**File:** `src/modules/identity/controllers/users.controller.ts`

**New endpoint:** `GET /users/me`
- Returns current authenticated user's profile
- More intuitive than requiring client to know their own ID

---

## Files to Modify

### Security (Guards & Controllers)
1. `src/modules/identity/guards/firebase-auth.guard.ts` - Add user hydration
2. `src/modules/identity/guards/ownership.guard.ts` - **New file**
3. `src/modules/identity/controllers/users.controller.ts` - Add guards, remove debug endpoint, add /me, use ParseMongoIdPipe
4. `src/modules/identity/identity.module.ts` - Register OwnershipGuard if needed

### Validation (DTOs & Pipes)
5. `src/modules/common/pipes/parse-mongo-id.pipe.ts` - **New file**
6. `src/modules/common/validators/coordinates.validator.ts` - **New file**
7. `src/modules/identity/dto/set-default-address.dto.ts` - Change to `@IsMongoId()`
8. `src/modules/identity/dto/create-address.dto.ts` - Add pincode pattern, coordinate validation, nested validation
9. `src/modules/identity/dto/create-user.dto.ts` - Add name length constraint
10. `src/modules/identity/dto/register.dto.ts` - Add name length constraint
11. `src/modules/identity/dto/update-user.dto.ts` - Remove privileged fields, add phone validation, add length constraints
12. `src/modules/identity/dto/admin-update-user.dto.ts` - **New file** for admin-only updates
13. `src/modules/identity/dto/fcm-token.dto.ts` - **New file**

## Files Unchanged

- `src/modules/identity/services/*.ts` - No changes needed
- `src/modules/identity/controllers/auth.controller.ts` - Already properly guarded
- `src/modules/identity/schemas/users.schema.ts` - No changes needed

---

## Testing Checklist

### Security
- [ ] Unauthenticated requests to protected endpoints return 401
- [ ] User cannot update another user's profile (returns 403)
- [ ] User can update their own profile
- [ ] Admin can update any user's profile
- [ ] Admin can verify/unverify users
- [ ] Non-admin cannot verify/unverify users
- [ ] FCM token registration works with authenticated user
- [ ] `/users/me` returns current user's profile
- [ ] `/users/debug/phones` no longer exists (404)
- [ ] `/users/check-phone/:phone` still works without auth

### Validation
- [ ] Invalid MongoDB ObjectId in route params returns 400 (not 500 CastError)
- [ ] Invalid pincode format rejected (not 6 digits)
- [ ] Invalid coordinates rejected (out of range lng/lat)
- [ ] Name too short/long rejected
- [ ] User cannot set `isVerified` or `kycStatus` on themselves
- [ ] FCM token with invalid length rejected
- [ ] Invalid phone number format rejected on update

---

## Validation Fixes

### Current State

Most DTOs have basic validation, but there are gaps and inconsistencies.

### Issues to Fix

#### 1. Route Parameter Validation

**Problem:** Route params (`:id`, `:userId`, `:addressId`) are not validated as valid MongoDB ObjectIds. Invalid IDs cause Mongoose CastErrors instead of clean 400 responses.

**Solution:** Create a `ParseMongoIdPipe` or use `@IsMongoId()` validation.

```typescript
// New file: src/modules/common/pipes/parse-mongo-id.pipe.ts
@Injectable()
export class ParseMongoIdPipe implements PipeTransform {
    transform(value: string) {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException('Invalid ID format');
        }
        return value;
    }
}

// Usage in controller
@Get(':id')
async getUser(@Param('id', ParseMongoIdPipe) id: string) { }
```

#### 2. SetDefaultAddressDto

**File:** `src/modules/identity/dto/set-default-address.dto.ts`

**Problem:** `addressId` uses `@IsString()` instead of `@IsMongoId()`

```typescript
// Before
@IsNotEmpty()
@IsString()
addressId: string;

// After
@IsNotEmpty()
@IsMongoId()
addressId: string;
```

#### 3. CreateAddressDto

**File:** `src/modules/identity/dto/create-address.dto.ts`

| Field | Issue | Fix |
|-------|-------|-----|
| `pincode` | No format validation | Add `@Matches(/^[1-9][0-9]{5}$/)` for Indian pincode |
| `location` | Missing `@ValidateNested()` | Add decorator |
| `serviceCategories` | `@IsString({ each: true })` | Change to `@IsMongoId({ each: true })` |
| `GeoPointDto.coordinates` | No range validation | Add custom validator for lng/lat ranges |

**GeoPointDto coordinate validation:**
```typescript
export class GeoPointDto {
    @IsString()
    type: 'Point' = 'Point';

    @IsArray()
    @ArrayMinSize(2)
    @ArrayMaxSize(2)
    @IsNumber({}, { each: true })
    @Min(-180, { each: true })  // Won't work - need custom validator
    coordinates: [number, number];
}

// Better: Custom validator
@ValidatorConstraint({ async: false })
export class IsValidCoordinates implements ValidatorConstraintInterface {
    validate(coords: [number, number]) {
        if (!Array.isArray(coords) || coords.length !== 2) return false;
        const [lng, lat] = coords;
        return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    }
    defaultMessage() {
        return 'Coordinates must be [longitude, latitude] with valid ranges';
    }
}
```

#### 4. UpdateUserDto - Privileged Fields

**File:** `src/modules/identity/dto/update-user.dto.ts`

**Problem:** Users can update `isVerified` and `kycStatus` on themselves.

**Solution:** Remove these fields from `UpdateUserDto`, create separate admin-only DTO.

```typescript
// Remove from UpdateUserDto:
// - isVerified
// - kycStatus

// New DTO for admin operations
export class AdminUpdateUserDto extends UpdateUserDto {
    @IsOptional()
    @IsBoolean()
    isVerified?: boolean;

    @IsOptional()
    @IsIn(['none', 'pending', 'approved', 'rejected'])
    kycStatus?: string;
}
```

#### 5. UpdateUserDto - Phone Validation Inconsistency

**Problem:** `CreateUserDto` uses `@IsPhoneNumber()` but `UpdateUserDto` only uses `@IsString()`

**Fix:**
```typescript
// UpdateUserDto
@IsOptional()
@IsPhoneNumber()  // Add this
phone?: string;
```

#### 6. String Length Constraints

| DTO | Field | Constraint |
|-----|-------|------------|
| `CreateUserDto` | `name` | `@Length(2, 100)` |
| `RegisterDto` | `name` | `@Length(2, 100)` |
| `UpdateUserDto` | `name` | `@Length(2, 100)` |
| `UpdateUserDto` | `bio` | `@MaxLength(500)` |
| `CreateAddressDto` | `addressLine1` | `@Length(5, 200)` |
| `CreateAddressDto` | `customLabel` | `@MaxLength(50)` |
| `CreateAddressDto` | `accessInstructions` | `@MaxLength(500)` |

#### 7. Missing FCM Token DTO

**Problem:** FCM endpoints use raw `@Body('token')` with no validation.

**Solution:** Create proper DTO.

```typescript
// New file: src/modules/identity/dto/fcm-token.dto.ts
export class FcmTokenDto {
    @IsString()
    @IsNotEmpty()
    @Length(100, 500)  // FCM tokens are typically ~150-200 chars
    token: string;
}
```

#### 8. Missing VerifyTokenDto

**Problem:** `/auth/verify-token` uses inline `{ idToken: string }`.

**Solution:** Reuse `LoginDto` or create `VerifyTokenDto`.

---

## Files to Create

1. `src/modules/common/pipes/parse-mongo-id.pipe.ts` - MongoDB ObjectId validation pipe
2. `src/modules/identity/dto/fcm-token.dto.ts` - FCM token DTO
3. `src/modules/identity/dto/admin-update-user.dto.ts` - Admin-only user updates
4. `src/modules/common/validators/coordinates.validator.ts` - GeoJSON coordinate validation

---

## Open Questions

1. **Public profiles:** Should `GET /users/:id` require auth, or allow public viewing? (Spec assumes auth required but no ownership check - anyone logged in can view)

2. **Rate limiting:** Should `/users/check-phone/:phone` have rate limiting to prevent enumeration attacks? (Out of scope for this fix)

3. **Soft delete:** Should removing debug endpoint be a hard delete or just admin-protect it for dev purposes?

4. **Phone validation strictness:** Should `@IsPhoneNumber()` require country code, or accept local formats?
