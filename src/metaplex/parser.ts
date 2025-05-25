export const dweb = (cid: string) => {
  return `https://${cid}.ipfs.dweb.link`;
};

export const basicIpfs = (cid: string) => {
  return `https://ipfs.io/ipfs/${cid}`;
};

export const pinataIpfs = (cid: string) => {
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
};

export const infura = (cid: string) => {
  return `https://infura-ipfs.io/ipfs/${cid}`;
};

export const nftStorage = (cid: string) => {
  return `https://nftstorage.link/ipfs/${cid}`;
};

export const web3Storage = (cid: string) => {
  return `https://w3s.link/ipfs/${cid}`;
};

export function ipfsThirdweb(cid: string) {
  return `https://ipfs-3.thirdwebcdn.com/ipfs/${cid}`;
}

export function ipfsFleek(cid: string) {
  return `https://ipfs.fleek.co/ipfs/${cid}`;
}

export const everland = (cid: string) => {
  return `https://${cid}.ipfs.4everland.io`;
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
  promiseFactories: ((signal: AbortSignal) => Promise<T>)[]
): Promise<T> {
  const controller = new AbortController();
  const signal = controller.signal;
  let errors: any[] = new Array(promiseFactories.length);
  let rejectedCount = 0;

  return new Promise<T>((resolve, reject) => {
    promiseFactories.forEach((factory, index) => {
      factory(signal)
        .then(result => {
          controller.abort(); // Cancel all other requests
          resolve(result);
        })
        .catch(err => {
          errors[index] = err;
          rejectedCount++;
          if (rejectedCount === promiseFactories.length) {
            reject(new AggregateError(errors, "All gateways failed"));
          }
        });
    });
  });
}
