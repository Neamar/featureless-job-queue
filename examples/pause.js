"use strict";
/**
 * This example demonstrate how to pause and resume a worker.
 * Please note that a paused worker will still finish all its ongoing tasks, it just won't process any more tasks
 * until you call .resume()!
 *
 * Have a look at http://caolan.github.io/async/docs.html#QueueObject for the list of things you can do on the queue.
 * Warning: do not use .shutdown() on a paused queue! shutdown() waits for all workers to finish, and would never call your callback.
 */

const JOB_COUNT = 50;
const CONCURRENCY = 1;

var FJQ = require('../lib');
var fjq = new FJQ();


// Define the worker function to use, and the concurrency
var queue = fjq.process(function workerFunction(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);

    cb();
  }, 50);
}, CONCURRENCY);


// every half second, pause or unpause the queue
// Tasks currently being worked won't be affected, but new tasks won't be processed.
setInterval(function() {
  if(queue.paused) {
    console.log("Resuming queue");
    queue.resume();
  }
  else {
    console.log("Pausing queue");
    queue.pause();
  }
}, 500).unref();


// Generate fake jobs
var jobs = [];
for(var i = 1; i <= JOB_COUNT; i += 1) {
  jobs.push({id: i});
}

// And add them to the queue
fjq.create(jobs, function(err) {
  console.log(err || "Added jobs in the queue");
});


// Only for this example: shutdown the process once all tasks have completed.
// In a real life situation you'd want to keep your worker running in case some tasks were to appear in the queue.
queue.drain = function() {
  // We can safely call .shutdown, since there is no way the queue can be drained while paused anyway.
  fjq.shutdown();
};
