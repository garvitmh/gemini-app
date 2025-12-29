# Revert Guide: shopify-sync-fix-stable

If you encounter issues after future changes and need to return to this stable state, follow these steps:

## 1. View Checkpoints
To see all available checkpoints, run:
```bash
git tag --list "checkpoint/*"
```

## 2. Revert to Stable State
Run the following command to reset the codebase to the `shopify-sync-fix-stable` checkpoint:

> [!CAUTION]
> This will discard all uncommitted changes. Save your work before running this.

```bash
git reset --hard checkpoint/shopify-sync-fix-stable
```

## 3. Re-initialize Environment
After reverting, you might need to restart the servers:

1. Stop existing processes (Ctrl+C in the terminal).
2. Start Backend:
   ```bash
   cd backend && npm run dev
   ```
3. Start Frontend:
   ```bash
   cd frontend && npm run dev
   ```

## 4. Verification
- Open [http://localhost:5173](http://localhost:5173) and verify the dashboard loads.
- Check [http://localhost:3005/api/health](http://localhost:3005/api/health) for backend status.
