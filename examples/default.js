"use strict";
/**
 * This example demonstrate the use of the library for a basic use case:
 * just enqueuing stuff in a FIFO, and working on tasks in parallel.
 * Obviously, in a real world use case, you'll probably want to run this over multiple processes or multiple servers!
 */
const JOB_COUNT = 50;
const CONCURRENCY = 5;

var FJQ = require('../lib');
var fjq = new FJQ();


// Define the worker function to use, and the concurrency
fjq.process(function workerFunction(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);

    cb();

    // Shutdown on last task, you'll probably never do that in a real use case but this ensure this example finishes!
    if(job.id === JOB_COUNT) {
      fjq.shutdown();
    }
  }, 50);
}, CONCURRENCY);


// Generate fake jobs
var jobs = [];
for(var i = 1; i <= JOB_COUNT; i += 1) {
  jobs.push({id: i});
}
// And add them to the queue
fjq.create(jobs, function(err) {
  console.log(err || "Added jobs in the queue");
});
