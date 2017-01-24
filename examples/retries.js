"use strict";
/**
 * This example demonstrate how to retry a failed job.
 * The library has no built-in retry feature, since this would slow considerably most use-case,
 * but you can just requeue failed tasks.
 */
const JOB_COUNT = 50;
const CONCURRENCY = 5;

var FJQ = require('../lib');
var fjq = new FJQ();


// For this use case, assume 50% of the jobs fails randomly
function workerFunction(job, cb) {
  setTimeout(function() {
    // 50% chance of failing the job
    if(Math.random() < 0.5) {
      console.log("Finished job #" + job.id + " on attempt #" + job.attempts);
      cb();
    }
    else {
      cb(new Error("Job failed"));
    }
  }, 50);
}

// Define the worker function to use, and the concurrency
var queue = fjq.process(function workerWrapper(job, cb) {
  workerFunction(job, function(err) {
    if(err) {
      // Retry on failure.
      // You can cancel the job after a set amount of retries by not requeuing it
      job.attempts += 1;
      console.log("Requeuing job #" + job.id);
      fjq.create(job, cb);
    }
    else {
      // Successful job, just move on to next job
      cb();
    }
  });
}, CONCURRENCY);


// Generate fake jobs
var jobs = [];
for(var i = 1; i <= JOB_COUNT; i += 1) {
  jobs.push({id: i, attempts: 1});
}

// And add them to the queue
fjq.create(jobs, function(err) {
  console.log(err || "Added jobs in the queue");
});


// Only for this example: shutdown the process once all tasks have completed.
// In a real life situation you'd want to keep your worker running in case some tasks were to appear in the queue.
queue.drain = function() {
  fjq.shutdown();
};
