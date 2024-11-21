import PQueue from "p-queue";
import EventEmitter from "events";

export class QueueManager extends EventEmitter {
  constructor({ concurrency = { text: 4, image: 2 } } = {}) {
    super();
    this.queues = {
      text: new PQueue({ concurrency: concurrency.text }),
      image: new PQueue({ concurrency: concurrency.image }),
    };

    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      queueSizes: { text: 0, image: 0 },
      completedByType: { text: 0, image: 0 },
      failedByType: { text: 0, image: 0 },
      inProgressByType: { text: 0, image: 0 },
    };

    // Set up queue monitoring
    Object.entries(this.queues).forEach(([type, queue]) => {
      queue.on("active", () => {
        this.stats.inProgress++;
        this.stats.inProgressByType[type]++;
        this.stats.queueSizes[type] = queue.size;
        this.emitProgress();
      });

      queue.on("completed", () => {
        this.stats.completed++;
        this.stats.completedByType[type]++;
        this.stats.inProgress--;
        this.stats.inProgressByType[type]--;
        this.stats.queueSizes[type] = queue.size;
        this.emitProgress();
      });

      queue.on("error", () => {
        this.stats.failed++;
        this.stats.failedByType[type]++;
        this.stats.inProgress--;
        this.stats.inProgressByType[type]--;
        this.stats.queueSizes[type] = queue.size;
        this.emitProgress();
      });
    });
  }

  getQueue(type) {
    return this.queues[type === "image" ? "image" : "text"];
  }

  incrementTotal() {
    this.stats.total++;
    this.emitProgress();
  }

  emitProgress() {
    const progress = {
      ...this.stats,
      percentage: this.stats.total
        ? (
            ((this.stats.completed + this.stats.failed) / this.stats.total) *
            100
          ).toFixed(1)
        : 0,
      queues: {
        text: {
          waiting: this.queues.text.size,
          pending: this.queues.text.pending,
          concurrency: this.queues.text.concurrency,
        },
        image: {
          waiting: this.queues.image.size,
          pending: this.queues.image.pending,
          concurrency: this.queues.image.concurrency,
        },
      },
    };

    this.emit("progress", progress);
  }

  reset() {
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: 0,
      queueSizes: { text: 0, image: 0 },
      completedByType: { text: 0, image: 0 },
      failedByType: { text: 0, image: 0 },
      inProgressByType: { text: 0, image: 0 },
    };
    this.emitProgress();
  }
}
