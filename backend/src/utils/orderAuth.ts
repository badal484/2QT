// Security fix, Phase 7 Step 0 — extracted from socket/index.ts into its own small module.
//
// Two reasons for the extraction, not just inlining this in socket/index.ts:
//   1. It makes the authorization decision independently unit-testable without needing a real
//      Socket.IO client/server pair (no socket.io-client dependency exists in this project).
//   2. Testing it via socket/index.ts directly pulled in socket.io/@socket.io/redis-adapter/
//      @socket.io/redis-emitter/jsonwebtoken at module-load time purely to reach one pure
//      function, and — empirically, reproduced and confirmed against the pre-Phase-7 baseline
//      showing zero such flakiness — caused intermittent cross-test-file interference (lingering
//      handles/timers from those libraries bleeding into other test files sharing the same Jest
//      worker). This module has exactly one real dependency (isAuthorizedForOrder), avoiding
//      that entire import chain.
//
// Delegates the actual authorization decision to routes/order.ts's isAuthorizedForOrder() — the
// exact same rule already enforced by the HTTP order endpoints — so there is exactly one place
// in the codebase that decides "can this user see this order," not two drifting implementations.
import { isAuthorizedForOrder } from '../routes/order';

export function canJoinOrderRoom(
    user: { userId?: string; role?: string; kitchenId?: string | null; tenantRestaurantId?: string | null } | null | undefined,
    order: { customer_id: string; rider_id: string | null; kitchen_id: string; restaurant_id?: string | null } | null | undefined
): boolean {
    // Unauthenticated ("guest") or malformed identity is never authorized for any order.
    // isAuthorizedForOrder's fallthrough (`return true` for roles it doesn't special-case) is
    // designed for trusted platform-staff roles (admin/finance/support) — it must never see a
    // socket that failed to authenticate.
    if (!user || !user.userId || !user.role || user.role === 'guest') return false;
    if (!order) return false; // unknown/nonexistent order — reject safely
    return isAuthorizedForOrder(
        { role: user.role, userId: user.userId, kitchenId: user.kitchenId ?? null, tenantRestaurantId: user.tenantRestaurantId ?? null },
        order
    );
}
