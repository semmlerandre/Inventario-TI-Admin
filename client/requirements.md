## Packages
date-fns | Formatting dates for transactions
recharts | Dashboard charts for stock visualization
lucide-react | Beautiful icons

## Notes
- The app uses a dynamic primary color fetched from `/api/settings` which modifies the `--primary` CSS variable at runtime.
- Authentication uses HTTP-only cookies, verified via `/api/auth/me`.
