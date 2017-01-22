"use strict";

var FJQ = require('../lib');

var fjq = new FJQ();

var queue = fjq.process(function(job, cb) {
  setTimeout(function() {
    // console.log("Finished job #" + job.id);
    cb();
  }, 5000);
}, 50);

var jobs = [];
for(var i = 0; i < 180; i += 1) {
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
