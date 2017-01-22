"use strict";
/**
 * This example demonstrate the use of .shutdown().
 * When invoking shutdown, all remaining tasks
 * (including pre-buffered tasks from overfillRatio)
 * will be finishjed before the callback sent to done is called
 */

var FJQ = require('../lib');

var fjq = new FJQ();

fjq.process(function(job, cb) {
  setTimeout(function() {
    console.log("Finished job #" + job.id);
    cb();
  }, 1500);
}, 10);

var jobs = [];
for(var i = 0; i < 100; i += 1) {
  jobs.push({id: i});
}

fjq.create(jobs, function() {
  setTimeout(function() {
    console.log("Sending shutdown signal");
    fjq.shutdown(function() {
      console.log("Queue shutdown");
    });
  }, 100);
});
