Featureless job queue
======================

Very simple job queue focusing on high performance / high throughput.

Basically, just a distributed FIFO.

## Why use this library?
There are very decent job queues for more complex use cases (TTL, job retries, priority, progress indicator). If you're interested in this kind of features, have a look at [Kue](https://github.com/Automattic/kue).

However, those features come with a tradeoff -- tons of calls to Redis' HSET, potential stuck jobs spoiling concurrency, and `O(log(n))` operations to pop something in a priority queue.

Moreover, those libraries need to maintain a bigger pool of connection to Redis, which can be costly on Redis providers billing by the number of open connections.

They also store atomic data in multiple keys, which lead to an increased memory consumption and number of calls to Redis.

By only focusing on one use case, this library is much faster but also less flexible. See [this page](https://github.com/Neamar/featureless-job-queue/issues/1) for a performance comparison between kue and this library.

## When should I use this library?

* You need to run many small jobs at once
* Your tasks are not CPU bound and you can run more than your number of CPU cores
* You need concurrency across many servers (if you don't, just use [`async.queue`](https://caolan.github.io/async/docs.html#queue))
* You don't need priority -- just a plain FIFO
* You can afford to lose a couple of tasks on critical app failure (SIGKILL or power failure). SIGTERM is fine.

## How to use this library
> Too lazy to read doc? Have a look at the [examples folder](https://github.com/Neamar/featureless-job-queue/tree/master/examples)!

### Constructor
```js
var FJQ = require('featureless-job-queue')
var fjq = new FJQ({redisUrl: redisUrl})
```

The constructor accepts two important options:

* `redisUrl`, the URL to use for Redis. If unspecified, this will default to localhost on the default port.
* `redisKey`, the redis key to use to store the jobs. Default is `fjq:jobs`, change it if you need to run multiple job queues on the same Redis instance.

Other options are documented lower in this README, where it makes sense to introduce them.

### Process jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = new FJQ({redisUrl: redisUrl})

// Number of workers to run at the same time, will default to 1
var concurrency = 40
var workerFunction = function(job, cb) {
    // your function, call cb(err) once done.    
}

fjq.process(workerFunction, concurrency)
```

Concurrency will always be respected, but note that some jobs might be unqueued before they're sent to a worker to ensure optimal throughput. This behavior can be tweaked by specifying the key `overfillRatio` in the constructor options. This value defaults to 1.1 (e.g., for concurrency of 40, 40 workers will run in parallel, and 4 tasks will be pre-buffered to be sent to workers).

This function will return an [`async.queue`](https://caolan.github.io/async/docs.html#queue). You can listen to events on it, and FJQ will append jobs to the queue automatically. Updating the queue concurrency in real time is not supported.

### Queue jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = new FJQ({redisUrl: redisUrl})

// job can be any valid JS structure.
// Try to keep it as small as possible since it will transit across the network and be fully stored in Redis
// It will be serialized using JSON.serialize, so you can't use any fancy items in your job (e.g. functions)
var job = {
    type: "something",
    foo: "bar"
}

fjq.create(job, function(err, count) {
    if(err) return console.warn(err)
    // Job successfully created
    // `count` is the number of items currently in the queue (after saving this job)
})

// OR
var jobs = [{job1: true}, {job2: true}, ...]
fjq.create(job, function(err, count) {
    // Please note: if you get an error, some jobs may have been saved and others not :(
    if(err) return console.warn(err)
    // Jobs successfully created
})
```

If you need to save multiple jobs at once, use the array version of the function to minimize the number of calls sent to Redis. There is no limit to the number of jobs that can be saved at once.

### Stop processing
```js
fjq.shutdown(function() {
    console.log("All workers drained, Redis connections closed!")
})
```

The callback will only be called once all of this is true:

* all workers have finished their current task (including tasks pre-buffered with `overfillRatio`). *Note that this means some workers might start new jobs even after you've called `.shutdown`!*
* all opened Redis connections have been closed

You'll probably want to hook this function to `process.on('SIGTERM')` ;)

### Other
* use `fjq.length(function(err, count))` to get the number of jobs currently queued in Redis (doesn't include tasks currently worked on and pre-buffered tasks)
* use `fjq.clearAll(function(err))` to clear all jobs currently in Redis. Workers currenty running won't be affected; ideally, only use this function in your test suite and never in prod!
* if you need access to a Redis connection, use `fjq.getCommandConnection()` which returns a [redis client](https://www.npmjs.com/package/redis).

## Implementation notes
* FIFO queue
* The library uses `BLPOP` to process jobs, so you'll have one Redis connection per call to `.process`
* If you never use `.create` from a worker, you won't have a second connection. From the moment you use `.create`, a new connection is established with Redis (since `BLPOP` is blocking and can't be used again) and maintained for performance.
* See https://github.com/Neamar/featureless-job-queue/issues/1 for a detailed breakdown of the performance improvement you can expect when switching from Kue to featureless-job-queue.

## Does it work?
This library is currently used in various productions environment. The biggest one I know of handles more than 45 millions tasks a day with less than 8 open Redis connections.
