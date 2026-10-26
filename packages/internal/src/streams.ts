type NormalizeError = (error: unknown) => Error;

export function wrapReadable<T>(
  stream: ReadableStream<T>,
  normalize: NormalizeError
): ReadableStream<T> {
  const reader = stream.getReader();
  let finished = false;
  let reading = false;
  let closed = false;
  const close = (controller: ReadableStreamDefaultController<T>) => {
    // The source can close before read() delivers its final chunk.
    if (finished || reading || !closed) return;
    finished = true;
    controller.close();
    reader.releaseLock();
  };
  const fail = (controller: ReadableStreamDefaultController<T>, error: unknown) => {
    if (finished) return;
    finished = true;
    controller.error(normalize(error));
    reader.releaseLock();
  };
  return new ReadableStream<T>(
    {
      start(controller) {
        // A source can close or fail even when no read is pending.
        void reader.closed.then(
          () => {
            closed = true;
            close(controller);
          },
          (error) => fail(controller, error)
        );
      },
      async pull(controller) {
        reading = true;
        try {
          const result = await reader.read();
          if (finished) return;
          if (result.done) {
            closed = true;
          } else {
            controller.enqueue(result.value);
          }
        } catch (error) {
          fail(controller, error);
        } finally {
          reading = false;
          close(controller);
        }
      },
      async cancel(reason) {
        finished = true;
        try {
          await reader.cancel(reason);
        } catch (error) {
          throw normalize(error);
        } finally {
          reader.releaseLock();
        }
      }
    },
    { highWaterMark: 0 }
  );
}

export function wrapWritable<T>(
  stream: WritableStream<T>,
  normalize: NormalizeError
): WritableStream<T> {
  const writer = stream.getWriter();
  let abortPromise: Promise<void> | undefined;
  return new WritableStream<T>({
    start(controller) {
      // Errors can arrive while the consumer is not writing.
      void writer.closed.catch((error) => controller.error(normalize(error)));
      controller.signal.addEventListener(
        'abort',
        () => {
          // The sink's abort callback waits for write(), which may need this signal to finish.
          abortPromise = writer.abort(controller.signal.reason);
          // The abort callback below reports failures once the pending write settles.
          void abortPromise.catch(() => {});
        },
        { once: true }
      );
    },
    async write(chunk) {
      try {
        await writer.write(chunk);
      } catch (error) {
        throw normalize(error);
      }
    },
    async close() {
      try {
        await writer.close();
      } catch (error) {
        throw normalize(error);
      } finally {
        writer.releaseLock();
      }
    },
    async abort(reason) {
      try {
        await (abortPromise ?? writer.abort(reason));
      } catch (error) {
        throw normalize(error);
      } finally {
        writer.releaseLock();
      }
    }
  });
}
