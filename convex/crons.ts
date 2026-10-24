import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("requeue expired agent jobs", { minutes: 1 }, internal.jobs.requeueExpired, {});
export default crons;
