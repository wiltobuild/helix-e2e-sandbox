# Helix E2E sandbox

Throwaway repository for Helix's real GitHub feedback-loop test. Managed by
`scripts/e2e/setup-github-sandbox.mjs` in https://github.com/wiltobuild/helix.
Every pull request fails its check until it adds `CI_FIXED.md`; the test then
expects Helix to route that failure back to the agent and merge only on request.
