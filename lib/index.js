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
  options.cargoConcurrency = options.cargoConcurrency || 200;
  options.overfillRatio = options.overfillRatio || 1.1;

  this.options = options;
  this.connectionsInUse = [];
  this.queuesInUse = [];
  this.isActive = true;

  log("Initialized new featureless job queue");
};


FJQ.prototype.process = function process(queueWorker, concurrency) {
  if(!this.isActive) {
    throw new Error("Queue was shutdown and can't be used anymore");
  }

  if(!concurrency) {
    concurrency = 1;
  }
  if(typeof(queueWorker) !== 'function') {
    throw new Error("Queue worker must be a function!");
  }


  var self = this;

  var connection = redis.createClient(this.options.redisUrl);
  connection._fjqProcessor = true;
  this.connectionsInUse.push(connection);

  var queue = async.queue(queueWorker, concurrency);
  this.queuesInUse.push(queue);

  var refiller = function() {
    if(!self.isActive) {
      // We're shutting down this .process(), don't try to queue more tasks
      return;
    }

    connection.blpop(self.options.redisKey, 0, function(err, values) {
      if(err && err.toString().indexOf("AbortError") !== -1) {
        // Queue is being shutdown, clean everything properly
        log("Shutting down queue on " + self.options.redisKey);
        return;
      }

      if(err) {
        log(err);
        refiller();
        return;
      }
      var jobJSON = values[1];
      log("Read job: " + jobJSON);
      var job = JSON.parse(jobJSON);
      queue.push(job, refiller);
    });
  };

  // fill queue, ensuring we have a little more to be as fast as possible
  for(var i = 0; i < concurrency * this.options.overfillRatio; i += 1) {
    refiller();
  }
};


FJQ.prototype.getCommandConnection = function getCommandConnection() {
  if(!this.isActive) {
    throw new Error("queue was shutdown");
  }

  // We use one connection for calls to create, and cache it.
  // If it does not already exists, create it
  if(!this.commandConnection) {
    this.commandConnection = redis.createClient(this.options.redisUrl);
    this.connectionsInUse.push(this.commandConnection);
  }

  return this.commandConnection;
};

FJQ.prototype.create = function create(jobs, cb) {
  if(!this.isActive) {
    return cb(new Error("queue was shutdown"));
  }

  if(!jobs) {
    return cb(new Error("no job specified!"));
  }
  if(!Array.isArray(jobs)) {
    jobs = [jobs];
  }

  if(typeof(cb) !== 'function') {
    throw new Error("callback must be a function!");
  }

  log("Creating " + jobs.length + " job" + (jobs.length > 1 ? "s" : "") + " in " + this.options.redisKey);

  var self = this;


  var cargo = async.cargo(function(jobs, cb) {
    log("Adding " + jobs.length + " jobs at the same time...");
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

    self.getCommandConnection().rpush(self.options.redisKey, jobsJSON, cb);
  }, this.options.cargoConcurrency);

  cargo.push(jobs, function(err) {
    if(err) {
      log("Error adding job", err);
      cargo.drain = noop;
      cb(err);
      cb = noop;
    }
  });

  cargo.drain = cb;
};

FJQ.prototype.clearAll = function clearAll(done) {
  this.getCommandConnection().del(this.options.redisKey, done);
};

FJQ.prototype.length = function length(done) {
  this.getCommandConnection().llen(this.options.redisKey, done);
};

FJQ.prototype.shutdown = function shutdown(done) {
  var self = this;
  if(!done) {
    done = noop;
  }

  if(!this.isActive) {
    // Queue was already shut down
    return done();
  }

  this.isActive = false;

  this.connectionsInUse.forEach(function(connection) {
    if(connection._fjqProcessor) {
      // Blocking connection needs to be flushed
      connection.end(true);
    }
    else {
      // Other connection can be closed properly
      connection.quit();
    }
  });

  async.each(this.queuesInUse, function(queue, cb) {
    if(queue.idle()) {
      log("Shutting down empty queue");
      // Queue already idle
      return cb();
    }

    // Once all tasks have been handled, call cb()
    log("Shutting down currently running queue, adding listener for drain event");
    queue.drain = cb;
  }, function() {
    self.queuesInUse.forEach(function(queue) {
      queue.kill();
    });

    log("All queues shut down!");
    done();
  });
};

module.exports = FJQ;
