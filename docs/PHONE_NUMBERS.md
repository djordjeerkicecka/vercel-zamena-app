# Serbian and Bosnian phone numbers

The shared `lib/phone.ts` normalizer accepts Serbian (`381`) and Bosnian (`387`)
phone numbers. Order lookup normalizes both the supplied phone and the order's
phone fields before comparing them. Ticket validation uses the same normalizer
and stores the customer's original formatted number with its country code intact.

Supported Bosnian examples:

- `+387 60 12 34 567`
- `00387601234567`
- `387601234567`
- `+387 61 234 567`
- `+387 33 123 456`

Bosnian numbers require eight or nine national digits after `387`, without the
domestic trunk zero. Formatting spaces, parentheses, slashes and hyphens are
ignored. Existing Serbian international and local formats retain their behavior.
Numbers without an explicit country code still default to Serbia because the
two countries' domestic formats overlap. Bosnian callers should include `+387`
or `00387`; Serbian and Bosnian numbers with the same national digits remain
different numbers.

The Shopify theme in `15 Zamena Test Store` uses the same Bosnian validation rule.
The original source in `16 Zamene tiketi - src` is not part of this update.
No database migration, new API scope, credential change or new dependency is needed.

Run `npm run test:phone` for normalization, country-code separation, order lookup
and ticket submission regressions. These tests isolate Shopify and Supabase;
they do not read customer orders or create live tickets.
