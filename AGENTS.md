# Site privacy and preservation requirements

This repository is a public educational website, not a clinical booking service.
Never commit personal phone numbers, direct patient-contact links, clinic/work
addresses, private delivery/chat identifiers, patient data or private email addresses.
This includes comments, examples, commit messages, commit identities, PR text,
test fixtures, build logs and screenshots. Removal notes must not repeat values.
Use placeholders in documentation and external secrets for runtime destinations.

Preserve educational content, archives, routes, CNAME, Pages publishing configuration,
Cloudflare routing and the blind contact form. No history rewriting, force pushing,
visibility changes, artifact deletion or source-repository changes without approval.

## Local checks (one-time setup in each actual contributor clone)

Use the GitHub-provided noreply email address for both author and committer.
Activate the checked-in hooks with `git config --local core.hooksPath .githooks`.
This changes only that clone and is not automatically applied to other agents.
Before committing run `python scripts/check_privacy.py --staged`.
Before pushing run `python scripts/check_privacy.py --since <BASE_COMMIT_SHA>`.
Unit tests: `python -m unittest discover -s tests -p test_privacy.py`.

The check is heuristic. Visually review images and context; never print matched values.
The GitHub Actions check is detection AFTER upload, not pre-receive protection.
It does not gate the separate legacy Pages deployment. Local hooks are essential
and can still be bypassed; do not treat a passing check as proof of privacy.
Do not upload audit reports, original sensitive history, or real contact test data.

## Current automation status

The Actions workflow is prepared separately, but NOT installed or enabled here:
the available publishing connection lacks workflow-write permission. Local hooks
are checked in, but must be activated in every actual contributor clone.
