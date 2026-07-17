// Re-exports from the canonical firebase init so there is only one app instance.
// authDomain is resolved dynamically to prevent Chrome Storage Partitioning from
// wiping sessionStorage during the reCAPTCHA redirect on mobile Chrome 115+.
export { app as firebaseApp, auth } from '../app/lib/firebase';

import { getAnalytics, Analytics } from "firebase/analytics";
import { app } from '../app/lib/firebase';

export const analytics: Analytics | null =
  typeof window !== "undefined" ? getAnalytics(app) : null;
