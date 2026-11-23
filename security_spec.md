# CreatorOS Firestore Security Specification

## Data Invariants
1. Every document in `brandVoices`, `scripts`, `calendarItems`, and `audits` must belong strictly to an authenticated, email-verified user (`userId == request.auth.uid`).
2. `users/{userId}` documents contain user email PII and are strictly readable and writable only by the owner (`userId == request.auth.uid`).
3. Every `createdAt` and `updatedAt` timestamp must match `request.time`, and `createdAt` and `userId`/`uid` are immutable after creation.
4. No shadow fields or oversized strings/arrays are permitted; all collections enforce strict key allowlists (`hasAll` + `hasOnly`) and explicit string/array size limits.
5. Published scripts (`status == 'published'`) and published calendar items lock status/content or require explicit owner-scoped field allowlists.

## Dirty Dozen Adversarial Payloads
1. Unauthenticated read on `/scripts/{id}` -> `PERMISSION_DENIED`
2. Unverified email user creating `/scripts/{id}` (`email_verified: false`) -> `PERMISSION_DENIED`
3. Identity spoofing: creating a script with `userId: "other-user"` -> `PERMISSION_DENIED`
4. Shadow field injection: creating a brandVoice with extra `isAdmin: true` -> `PERMISSION_DENIED`
5. ID poisoning: creating `/scripts/bad$id!` with invalid characters -> `PERMISSION_DENIED`
6. Oversized payload: creating `/scripts/{id}` with `body.size() > 20000` -> `PERMISSION_DENIED`
7. Client timestamp forgery: creating `/scripts/{id}` with forged `createdAt` != `request.time` -> `PERMISSION_DENIED`
8. Cross-tenant list query: listing `/brandVoices` without `where('userId', '==', auth.uid)` -> `PERMISSION_DENIED`
9. Immutable field mutation: updating `userId` or `createdAt` on `/calendarItems/{id}` -> `PERMISSION_DENIED`
10. Invalid enum status: setting `status: "hacked"` on `/scripts/{id}` -> `PERMISSION_DENIED`
11. Unbounded array injection: creating `/audits/{id}` with 20 tips (`tips.size() > 8`) -> `PERMISSION_DENIED`
12. PII read leak: reading `/users/{otherUserId}` as an authenticated non-owner -> `PERMISSION_DENIED`
