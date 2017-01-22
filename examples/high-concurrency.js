"use strict";
/**
 * This example demonstrate the use of the library for a "high-concurrency" use-case:
 * 50 tasks are run in parallel, each task taking 5000ms.
 * Note that such a concurrency is only relevant for non-CPU bounds tasks,
 * e.g. network requests are a good use of such a feature since you're spending most of your time
 * waiting for the network stack anyway.
 * Monitor the CPU usage of your queue and adjust accordingly!
 *
 * In addition, this example also display the use of a watchdog to monitor concurrency.
 */

var FJQ = require('../lib');

var fjq = new FJQ();

var queue = fjq.process(function(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);
    cb();
  }, 5000);
}, 200);

var jobs = [];
for(var i = 0; i < 650; i += 1) {
  jobs.push({id: i});
}
fjq.create(jobs, function() {});

setInterval(function() {
  fjq.length(function(err, length) {
    if(err) {
      throw err;
    }

    console.log("Tasks running: " + queue.workersList().length + ", in local queue: " + queue.length() + ", in Redis queue: " + length);
  });
}, 1000);
