import { Job } from "@sampla/shared";

const jobs = new Map<string, Job>();

export const putJob = (j: Job): Job => {
  jobs.set(j.id, j);
  return j;
};

export const getJob = (id: string): Job | undefined => jobs.get(id);

export const updateJob = (id: string, patch: Partial<Job>): Job | undefined => {
  const cur = jobs.get(id);
  if (!cur) return undefined;
  const next = Job.parse({ ...cur, ...patch });
  jobs.set(id, next);
  return next;
};
