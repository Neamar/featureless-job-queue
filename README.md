Featureless job queue
======================

Very simple job queue focusing on high performance / high throughput.

There are very decent job queue for more complex use cases (TTL, job retries, priority, progress indicator). If you're interested in this kind of feature, have a look at [Kue](https://github.com/Automattic/kue).

However, those features comes with tradeoff -- tons of calls to Redis' HSET, potential stuck jobs spoiling concurrency, and `O(log(n))` operations to pop something in a priority queue.

Moreover, those libraries need to maintain a bigger pool of connection to Redis, which can be costly since most Redis providers bills by the number of open connection.

They also store data in multiple keys, which lead to an increased memory consumption.

By only focusing on one use case, this library is much faster but also less flexible.
Once again, this does not mean other libraries do a bad job -- just a more generic one.

## When should I use this library?

* You need to run many small jobs at once
* Your tasks are not CPU bound and you can run more than your number of CPU cores
* You need concurrency across many servers (if you don't just use [`async.queue`](https://caolan.github.io/async/docs.html#queue))
* You don't need priority
* You can afford to lose a couple tasks on app critical failure (no retries, only an issue on SIGKILL and power failure)

## How to use this library

### Process jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = FJQ(redisUrl)

// Number of workers to run at the same time
var concurrency = 40
var workerFunction = function(job, cb) {
    // your function, call cb(err) once done.    
}

fjq.process(concurrency, workerFunction)
```


### Queue jobs
```js
var FJQ = require('featureless-job-queue')
var fjq = FJQ(redisUrl)

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

## Implementation notes
* FIFO queue
* The library uses `BLPOP` to process jobs, so you'll have one Redis connection per call to process
* If you never use `.create` from a worker, you won't have a second connection. From the moment you use `.create`, a new connection is established with Redis (since `BLPOP` is blocking and can't be used again) and maintained for performance.
