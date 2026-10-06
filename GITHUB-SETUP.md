# Private GitHub test repository

This source is prepared for a private `proxyhub` repository. GitHub publication has not been performed yet.

The `Shop tests and build` workflow runs isolated tests and builds the Worker. It does not deploy the web or access production data.

For the optional real SePay read-only test, create a new Production token. In the repository go to Settings → Secrets and variables → Actions → New repository secret, named `SEPAY_API_TOKEN`. Then Actions → SePay read-only connection check → Run workflow. The test prints only HTTP outcome and the number of active accounts. It never credits wallets or prints transaction/account data.

A successful Actions probe does not prove the hosted Worker can connect. Compare its result with the deployed web's bank-loading request. Actual deposits must be verified separately after configuration.

GitHub Pages cannot run this Worker/D1 backend. Existing private Sites hosting remains the deployment target. Do not commit API keys, environment files, user stock or database exports.
