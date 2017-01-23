"use strict";
/**
 * This example demonstrate the use of the library for a "high-concurrency" use-case:
 * 25 tasks are run in parallel, each task taking 1500ms.
 * Note that such a concurrency is only relevant for non-CPU bounds tasks,
 * e.g. network requests are a good use of such a feature since you're spending most of your time
 * waiting for the network stack anyway.
 * Monitor the CPU usage of your queue and adjust accordingly!
 * A concurrency of 200 might make sense for HTTP requests if you have a decent network adapter.
 * In any case, this library won't be an issue even if your concurrency goes over a couple millions / sec (tested and approved)
 *
 * In addition, this example also display the use of a watchdog to monitor concurrency.
 */
const CONCURRENCY = 25;

var FJQ = require('../lib');
var fjq = new FJQ();


// Define the worker function to use, and the concurrency
var queue = fjq.process(function workerFunction(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);
    cb();
  }, 1500);
}, CONCURRENCY);


// Generate fake jobs
var jobs = [];
for(var i = 0; i < 90; i += 1) {
  jobs.push({id: i});
}
jobs[jobs.length - 1].shutdown = true;


// And add them to the queue
fjq.create(jobs, function(err) {
  console.log(err || "Added jobs in the queue");
});


// Add a watcher to see how many tasks are running / in queue
setInterval(function() {
  fjq.length(function(err, length) {
    if(err) {
      throw err;
    }

    console.log("Tasks running: " + queue.workersList().length + ", in local queue: " + queue.length() + ", in Redis queue: " + length);

    if(length === 0 && queue.workersList().length === 0) {
      process.exit();
    }
  });
}, 1000);
