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
var queue = fjq.process(function workerFunction(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);

    cb();
  }, 50);
}, CONCURRENCY);


// Generate fake jobs
var jobs = [];
for(var i = 1; i <= JOB_COUNT; i += 1) {
  jobs.push({id: i});
}

// And add them to the queue
fjq.create(jobs, function(err, count) {
  console.log(err || "Added jobs in the queue, number of tasks: " + count);
});


// Only for this example: shutdown the process once all tasks have completed.
// In a real life situation you'd want to keep your worker running in case some tasks were to appear in the queue.
queue.drain = function() {
  fjq.shutdown();
};
