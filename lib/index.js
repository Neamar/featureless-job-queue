"use strict";
var async = require("async");
var redis = require("redis");
var debug = require("debug");

var log = debug("featureless-job-queue");

var noop = function() {};


var FJQ = function FJQ(options) {
  options = options || {};
  options.redisUrl = options.redisUrl || "redis://localhost";
  options.redisKey = options.redisKey || "fjq:jobs";

  this.options = options;

  log("Initialized new featureless job queue");
};


FJQ.prototype.process = function process(concurrency, queueWorker) {
  // TODO
  queueWorker();
};


FJQ.prototype.create = function create(jobs, cb) {
  if(!jobs) {
    return cb(new Error("no job specified!"));
  }
  if(!Array.isArray(jobs)) {
    jobs = [jobs];
  }

  log("Adding " + jobs.length + " jobs in " + this.options.redisKey);

  var self = this;

  // We use one connection for calls to create, and cache it.
  // If it does not already exists, create it
  if(!this.createConnection) {
    this.createConnection = redis.createClient(this.options.redisUrl);
  }

  var cargo = async.cargo(function(jobs, cb) {
    var errored = false;

    var jobsJSON = jobs.map(function(job) {
      var jobJSON = JSON.stringify(job);
      if(!jobJSON) {
        errored = job;
        return "";
      }

      // Escape apostrophes
      jobJSON = jobJSON.replace(/'/g, "\\'");

      return jobJSON;
    });

    if(errored) {
      return cb(new Error("non JSON job specified: " + errored.toString()));
    }

    self.createConnection.rpush(self.options.redisKey, jobsJSON, cb);
  }, 200);

  cargo.push(jobs, function(err) {
    if(err) {
      log("Error adding job", err);
      cb(err);
      cargo.drain = null;
      cb = noop;
    }
  });

  cargo.drain = cb;
};


module.exports = FJQ;
