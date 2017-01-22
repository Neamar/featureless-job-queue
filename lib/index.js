"use strict";

var FJQ = function FJQ(options) {
  options = options || {};
  options.redisUrl = options.redisUrl || "redis://localhost";
  options.redisKey = options.redisKey || "fjq:jobs";

  this.options = options;
};


FJQ.prototype.process = function process(concurrency, queueWorker) {
  // TODO
  queueWorker();
};


FJQ.prototype.create = function create(jobs, cb) {
  if(!jobs) {
    return cb(new Error("no job specified!"));
  }

  var jobJSON = JSON.stringify(jobs);
  if(!jobJSON) {
    return cb(new Error("non JSON job specified"));
  }

  cb();
};


module.exports = FJQ;
