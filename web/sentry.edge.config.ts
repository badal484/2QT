import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://c0c6eaa8f741cdf24b36e55a81a7b560@o4511873871642624.ingest.us.sentry.io/4511873914765312',
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,
});
