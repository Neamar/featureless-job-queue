"use strict";
/**
 * This example demonstrate the use of the library with two different queues.
 * Each queue has a different concurrency settnig, and a different worker function.
 * In this simple example, the workers are mostly similar however the concurrency is different, and all tasks from A will finish way before B.
 * Note that the same jobs are used for both tasks, this is only for example purpose!
 * This example will use 4 connections to Redis: one for each call to .process, and one for each call to create().
 * Calling create again wouldn't add more connections, however adding more .process() would add one connection per call since the worker would keep running.
 */

const JOB_COUNT = 50;
const CONCURRENCY_TASK_A = 50;
const CONCURRENCY_TASK_B = 5;

var FJQ = require('../lib');
var fjqTaskA = new FJQ({redisKey: "taskA:jobs"});
var fjqTaskB = new FJQ({redisKey: "taskB:jobs"});


var queueA = fjqTaskA.process(function workerFunctionA(job, cb) {
  setTimeout(function() {
    console.log("Finished job from task A #" + job.id);
    cb();
  }, 50);
}, CONCURRENCY_TASK_A);


var queueB = fjqTaskB.process(function workerFunctionB(job, cb) {
  setTimeout(function() {
    console.log("Finished job from task B #" + job.id);
    cb();
  }, 50);
}, CONCURRENCY_TASK_B);


// Generate fake jobs
var jobs = [];
for(var i = 1; i <= JOB_COUNT; i += 1) {
  jobs.push({id: i});
}

// And add them to the queues
fjqTaskA.create(jobs, function(err) {
  console.log(err || "Added jobs in queue A");
});
fjqTaskB.create(jobs, function(err) {
  console.log(err || "Added jobs in queue B");
});


// Only for this example: shutdown the process once all tasks have completed.
// In a real life situation you'd want to keep your worker running in case some tasks were to appear in the queue.
queueA.drain = function() {
  fjqTaskA.shutdown();
};
queueB.drain = function() {
  fjqTaskB.shutdown();
};
