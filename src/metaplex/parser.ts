export const dweb = (cid: string) => {
  return `https://${cid}.ipfs.dweb.link`;
};

export const basicIpfs = (cid: string) => {
  return `https://ipfs.io/ipfs/${cid}`;
};

export const pinataIpfs = (cid: string) => {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
};

class AggregateError extends Error {
  errors: any[];
  constructor(errors: any[], message: string) {
    super(message);
    this.errors = errors;
    this.name = "AggregateError";
  }
}

export async function firstSuccessful<T>(
  promises: (() => Promise<T>)[]
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let errors: any[] = [];
    let rejectedCount = 0;

    promises.forEach((fn, i) => {
      fn()
        .then(resolve)
        .catch((err) => {
          errors[i] = err;
          rejectedCount++;
          if (rejectedCount === promises.length) {
            reject(new AggregateError(errors, "All gateways failed"));
          }
        });
    });
  });
}
