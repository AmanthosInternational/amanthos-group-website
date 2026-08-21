/**
 * Sentry browser telemetry — Amanthos Group (www.amanthos.com)
 *
 * Loaded from the CDN bundle rather than the Loader script: the org lives in
 * Sentry's EU region, and keeping the whole configuration here means sampling
 * rates and privacy settings are reviewable in git instead of hidden behind a
 * dashboard toggle. The bundle is pinned to an exact version and guarded by an
 * SRI hash, so a compromised CDN cannot execute anything on these pages.
 *
 * Both script tags are `defer`, and this file is ordered before the site's own
 * scripts. Deferred scripts run in document order, so Sentry is initialised
 * before app.js/booking.js and catches their errors, without blocking render.
 *
 * No Session Replay on this site. Replay costs 37 KB gzip on every page view
 * and only pays for itself on a booking funnel (analysing abandoned bookings);
 * the corporate site has none. The three booking sites keep it and load it
 * lazily on the first interaction with their booking bar. Hence the plain
 * `bundle.tracing.min.js` in the HTML instead of the `.replay.` variant.
 */
(function () {
  // The bundle is blocked by common ad blockers. Without this guard that turns
  // into a ReferenceError on every such visit — noise in the console of exactly
  // the users we cannot observe anyway.
  if (typeof Sentry === 'undefined') return;

  Sentry.init({
    dsn: 'https://31700d964d64e53146a9b20ca0868892@o4511372064915456.ingest.de.sentry.io/4511927219060816',
    environment: 'production',

    // No IP addresses, no cookies, no request bodies. Guest data must not leave
    // the browser; the point of this instrumentation is broken code, not people.
    sendDefaultPii: false,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Core Web Vitals and page load timings. 10% is enough to see trends on a
    // marketing site and keeps well inside the org's event quota.
    tracesSampleRate: 0.1,

    // DELIBERATELY EMPTY — do not add the API hosts here without changing them
    // first. Trace propagation adds `sentry-trace` and `baggage` headers to
    // outgoing requests. Measured 2026-08-17: the booking API answers the CORS
    // preflight with `Access-Control-Allow-Headers: Content-Type, X-API-Key,
    // Authorization`. Neither header is on that list, so the browser would
    // reject the preflight and the availability call would fail — the booking
    // funnel would break to gain a trace. Connecting browser and backend traces
    // requires allowing both headers server-side first.
    tracePropagationTargets: [],

    // Noise that is not our code and cannot be fixed by us. Left unfiltered,
    // these bury the real errors — the same failure mode that made 559 of 673
    // events in this org a single client disconnect (fixed 2026-08-17).
    ignoreErrors: [
      // Benign browser layout notice, fires on healthy pages.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Browser extensions and injected scripts.
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      // Network hiccups on the visitor's side, not a defect of the site.
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      // Safari/iOS quirks with no actionable stack.
      'Non-Error promise rejection captured',
    ],

    denyUrls: [
      // Third-party tags: their errors belong to their owners, not to us.
      /googletagmanager\.com/,
      /google-analytics\.com/,
      /gstatic\.com/,
      /extensions\//,
      /^chrome:\/\//,
    ],
  });

  // Which of the four sites an event came from, without relying on the URL.
  Sentry.setTag('site', 'amanthos-group-website');
})();
