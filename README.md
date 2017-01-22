Featureless job queue
======================

Very simple job queue focusing on high performance / high throughput.

There are very decent job queue for more complex use cases (TTL, job retries, priority, progress indicator). If you're interested in this kind of features, have a look at [Kue](https://github.com/Automattic/kue).

However, those features comes with tradeoff -- tons of calls to Redis' HSET, potential stuck jobs spoiling concurrency, and `O(log(n))` operations to pop something in a priority queue.

Moreover, those libraries need to maintain a bigger pool of connection to Redis, which can be costly since most Redis providers bills by the number of open connections.

They also store atomic data in multiple keys, which lead to an increased memory consumption and number of calls to Redis.

By only focusing on one use case, this library is much faster but also less flexible.
Once again, this does not mean other libraries do a bad job -- just a more generic one.

## When should I use this library?

* You need to run many small jobs at once
* Your tasks are not CPU bound and you can run more than your number of CPU cores
* You need concurrency across many servers (if you don't, just use [`async.queue`](https://caolan.github.io/async/docs.html#queue))
* You don't need priority -- just a plain FIFO
* You can afford to lose a couple tasks on app critical failure (SIGKILL or power failure). SIGTERM is fine.

## How to use this library
### Constructor
```js
var FJQ = require('featureless-job-queue')
var fjq = FJQ({redisUrl: redisUrl})
```

The constructor accepts two important options:

* redisUrl, the URL to use for Redis. If unspecified, this will default to localhost on default port.
* redisKey, the key to use to store the jobs. Default is `fjq:jobs`

Other options are documented lower in this README, where it makes sense to introduce them.

### Process jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = FJQ({redisUrl: redisUrl})

// Number of workers to run at the same time, will default to 1
var concurrency = 40
var workerFunction = function(job, cb) {
    // your function, call cb(err) once done.    
}

fjq.process(workerFunction, concurrency)
```

Concurrency will always be respected, but note that some jobs might be unqueued before they're sent to a worker to ensure optimal throughput. This behavior can be tweaked by specifying the key `overfillRatio` in the constructor options. This value default to 1.1 (e.g, for concurrency of 40, 40 workers will run in parallel and 4 tasks will be pre-buffered to be sent to workers).

This function will return an [`async.queue`](https://caolan.github.io/async/docs.html#queue)). You can listen for events on it, and FJQ will append jobs to the queue automatically. Theoretically, you can dynamically update the concurrency, but this is not a supported feature.

### Queue jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = FJQ({redisUrl: redisUrl})

// job can be any valid Js structure.
// Try to keep it as small as possible since it will transit across the network and be fulyl stored in Redis
// It will be serialized using JSON.serialize, so you can't use any fancy items in your job (e.g. functions)
var job = {
    type: "something",
    foo: "bar"
}

fjq.create(job, function(err) {
    if(err) return console.warn(err)
    // Job successfully created
})

// OR
var jobs = [{job1: true}, {job2: true}, ...]
fjq.create(job, function(err) {
    // Please note: if you get an error, some jobs may have been saved and others not :(
    if(err) return console.warn(err)
    // Jobs successfully created
})
```

If you need to save multiple jobs at once, use the array function to minimize the amount of calls sent to Redis. There is no limit to the quantity of jobs that can be saved at once, the library will ensure all the data can be sent to Redis by saving the jobs chunks by chunks.

Chunk size can be configured with the constructor's option `cargoConcurrency`, which default to 200.

### Stop processing
```js
fjq.shutdown(function() {
    console.log("All workers drained and Redis connections closed!")
})
```

The callback will only be called once:

* all workers have finished their current task (including tasks pre-buffered with `overfillRatio`). Note that this means some workers might start new jobs even after you've called `.shutdown`!
* all opened Redis connections have been closed

You'll probably want to hook this function to `process.on('SIGTERM')` ;)

### Other
* use `fjq.length(function(err, count))` to get the number of jobs currently queued
* use `fjq.clearAll(function(err))` to clear all jobs currently in Redis. Workers currenty runnign won't be affected; ideally, only use this function in your test suite and never in prod!

## Implementation notes
* FIFO queue
* The library uses `BLPOP` to process jobs, so you'll have one Redis connection per call to process
* If you never use `.create` from a worker, you won't have a second connection. From the moment you use `.create`, a new connection is established with Redis (since `BLPOP` is blocking and can't be used again) and maintained for performance.
* See https://github.com/Neamar/featureless-job-queue/issues/1 for a detailed breakdown of the performance improvement you can expect when switching from Kue to featureless-job-queue.
