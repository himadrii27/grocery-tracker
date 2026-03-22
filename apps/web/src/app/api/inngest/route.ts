import { serve } from "inngest/next";
import {
  inngest,
  predictionRefreshJob,
  runoutAlertJob,
  postSyncPredictionsJob,
  weeklyDigestJob,
} from "@grocery-tracker/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [predictionRefreshJob, runoutAlertJob, postSyncPredictionsJob, weeklyDigestJob],
});
