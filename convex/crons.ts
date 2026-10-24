import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("requeue expired agent jobs", { minutes: 1 }, internal.jobs.requeueExpired, {});
crons.daily("refresh exchange rates", { hourUTC: 16, minuteUTC: 30 }, internal.fx.refresh, {});
export default crons;
