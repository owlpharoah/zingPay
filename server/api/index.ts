// Vercel serverless entrypoint.
//
// The full Express app lives in ../src/index.ts and is exported as its default
// handler (an Express app is itself a `(req, res)` function). Vercel invokes
// this function for every request the catch-all rewrite in vercel.json routes
// here, and Express handles the original path internally — so every existing
// route (/notify, /otp/*, /received/*, /phone/*, /cron/refund, /health) keeps
// working unchanged.
import app from "../src/index";

export default app;
