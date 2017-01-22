"use strict";
var assert = require("assert");
var async = require("async");
var redis = require("redis");

var client = redis.createClient();
var FJQ = require('../lib');


describe("Featureless job queue", function() {
  describe("constructor", function() {
    it("should default if options is unspecified", function() {
      var fjq = new FJQ();
      assert.equal(fjq.options.redisUrl, "redis://localhost");
      assert.equal(fjq.options.redisKey, "fjq:jobs");
      assert.equal(fjq.options.cargoConcurrency, 200);
    });

    it("should use specified redisUrl", function() {
      var fjq = new FJQ({redisUrl: "fakeUrl"});
      assert.equal(fjq.options.redisUrl, "fakeUrl");
    });

    it("should use specified redisKey", function() {
      var fjq = new FJQ({redisKey: "fakeKey"});
      assert.equal(fjq.options.redisKey, "fakeKey");
    });
  });

  describe(".create(job, cb)", function() {
    var fjq = new FJQ();
    beforeEach(function(done) {
      fjq.clearAll(done);
    });

    it("should require a job", function(done) {
      fjq.create(null, function(err) {
        assert.ok(err.toString().indexOf("no job specified") !== -1);
        done();
      });
    });

    it("should require a valid job", function(done) {
      fjq.create(function() {}, function(err) {
        assert.ok(err.toString().indexOf("non JSON job specified") !== -1);
        done();
      });
    });

    it("should save the job to Redis", function(done) {
      var fakeJob = {foo: "bar"};
      async.waterfall([
        function createJob(cb) {
          fjq.create(fakeJob, cb);
        },
        function loadJobInRedis(cb) {
          client.lrange(fjq.options.redisKey, 0, 10, cb);
        },
        function checkCorrect(result, cb) {
          assert.equal(result.length, 1);
          assert.equal(result[0], JSON.stringify(fakeJob));
          cb();
        }
      ], done);
    });

    it("should save multiple jobs to Redis", function(done) {
      var fakeJob = {foo: "bar"};
      var fakeJobs = [fakeJob, fakeJob, fakeJob];

      async.waterfall([
        function createJob(cb) {
          fjq.create(fakeJobs, cb);
        },
        function loadJobInRedis(cb) {
          client.lrange(fjq.options.redisKey, 0, 10, cb);
        },
        function checkCorrect(result, cb) {
          assert.equal(result.length, fakeJobs.length);
          assert.equal(result[0], JSON.stringify(fakeJob));
          cb();
        }
      ], done);
    });

    it("should save multiple jobs to Redis when jobs.length > cargoConcurrency", function(done) {
      var fjq = new FJQ({
        cargoConcurrency: 5
      });

      var fakeJob = {foo: "bar"};
      var fakeJobs = [fakeJob, fakeJob, fakeJob, fakeJob, fakeJob, fakeJob];

      async.waterfall([
        function createJob(cb) {
          fjq.create(fakeJobs, cb);
        },
        function loadJobInRedis(cb) {
          client.lrange(fjq.options.redisKey, 0, 10, cb);
        },
        function checkCorrect(result, cb) {
          assert.equal(result.length, fakeJobs.length);
          assert.equal(result[0], JSON.stringify(fakeJob));
          assert.equal(result[5], JSON.stringify(fakeJob));
          cb();
        }
      ], done);
    });
  });

  describe(".process(concurrency, queueWorker)", function() {
    var fjq;
    beforeEach(function(done) {
      fjq = new FJQ();
      fjq.clearAll(done);
    });

    afterEach(function(done) {
      fjq.shutdown(done);
    });

    it("should require a function", function() {
      assert.throws(function() {
        fjq.process(true);
      });
    });

    it("should work on already created tasks", function(done) {
      var fakeJob = {foo: "bar"};
      async.waterfall([
        function addJob(cb) {
          fjq.create(fakeJob, cb);
        },
        function process(cb) {
          fjq.process(function(job, jobCb) {
            assert.equal(job.foo, fakeJob.foo);
            jobCb();
            cb();
          }, 1);
        }
      ], done);
    });

    it("should start working on tasks queued after .process()", function(done) {
      var fakeJob = {foo: "bar"};
      var called = false;
      async.waterfall([
        function processJob(cb) {
          fjq.process(function(job, jobCb) {
            assert.equal(job.foo, fakeJob.foo);
            called = true;
            jobCb();
          }, 1);

          cb();
        },
        function addJob(cb) {
          fjq.create(fakeJob, cb);
        },
        function waitForCompletion(cb) {
          var interval = setInterval(function() {
            if(called) {
              clearInterval(interval);
              cb();
            }
          }, 5);
        }
      ], done);
    });

    it("should remove tasks once finished", function(done) {
      var fakeJob = {foo: "bar"};
      async.waterfall([
        function addJob(cb) {
          fjq.create(fakeJob, cb);
        },
        function processJob(cb) {
          fjq.process(function(job, jobCb) {
            assert.equal(job.foo, fakeJob.foo);
            jobCb();
            cb();
          }, 1);
        },
        function loadJobInRedis(cb) {
          client.lrange(fjq.options.redisKey, 0, 10, cb);
        },
        function checkCorrect(result, cb) {
          assert.equal(result.length, 0);
          cb();
        }
      ], done);
    });
  });

  describe(".length(cb)", function() {
    var fjq;
    beforeEach(function(done) {
      fjq = new FJQ();
      fjq.clearAll(done);
    });

    afterEach(function(done) {
      fjq.shutdown(done);
    });

    it("should return 0 by default", function(done) {
      fjq.length(function(err, count) {
        assert.ifError(err);
        assert.equal(count, 0);
        done();
      });
    });

    it("should return length of jobs", function(done) {
      async.waterfall([
        function createJobs(cb) {
          fjq.create([{}, {}, {}], cb);
        },
        function getLength(cb) {
          fjq.length(cb);
        },
        function assertLength(count, cb) {
          assert.equal(count, 3);
          cb();
        }
      ], done);

    });
  });

  describe(".shutdown(done)", function() {
    var fjq;
    beforeEach(function(done) {
      fjq = new FJQ();
      fjq.clearAll(done);
    });

    afterEach(function(done) {
      fjq.shutdown(done);
    });

    it("should prevent user from creating new tasks once shut down", function(done) {
      fjq.shutdown();
      fjq.create({}, function(err) {
        assert.ok(err.toString().indexOf("queue was shutdown") !== -1);
        done();
      });
    });

    it("should prevent user from adding new workers once shut down", function() {
      fjq.shutdown();
      assert.throws(function() {
        fjq.process(function() {}, 1);
      });
    });

    it("should only shut down once workers have finished", function(done) {
      var fakeJob = {foo: "bar"};
      var hasProcessed = false;
      async.waterfall([
        function processJob(cb) {
          fjq.process(function(job, jobCb) {
            setTimeout(function() {
              hasProcessed = true;
              jobCb();
            }, 100);
          }, 1);
          cb();
        },
        function addJob(cb) {
          fjq.create(fakeJob, cb);
        },
        function wait(cb) {
          setTimeout(cb, 20);
        },
        function shutdown(cb) {
          assert.equal(hasProcessed, false);
          fjq.shutdown(cb);
        },
        function ensureHasProcessed(cb) {
          assert.equal(hasProcessed, true);
          cb();
        }
      ], done);
    });
  });
});
