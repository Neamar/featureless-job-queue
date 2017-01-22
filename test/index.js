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
      client.del(fjq.options.redisKey, done);
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
  });
});
