import type { PathLike, StatOptions } from 'node:fs';
import { fmt } from './fmt.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import type { AddressInfo } from 'node:net';
import type { ProcFSException } from './exceptions.js';

export const dlog = (
  DEBUG ? ((...args: string[]) => {
    if (typeof args[0] === 'string') {
      console.log(`D ${fmt.apply(null, args as [format: string, ...args: string[]])}`);
    } else {
      console.log.apply(console, ['D'].concat([].slice.call(args)));
    }
  }) : () => { }
);

export function die(err: Error | string) {
  console.error((!err || typeof err === 'string') ? err : String(err.stack || err));
  process.exit(1);
}

export function addrToURL(addr: AddressInfo): string {
  let host = addr.address;
  if (host === '127.0.0.1' || host === '::1') {
    host = 'localhost';
  } else if (host === '::' || host === '0.0.0.0' || host === '') {
    host = netInterfaceAddr(4) || '0.0.0.0';
  }
  return `http://${host}:${addr.port}`;
}

export function netInterfaceAddr(ipVersionPreference?: number) {
  const ifaces = os.networkInterfaces();
  let bestAddr = null;
  for (const ifname of Object.keys(ifaces)) {
    for (const iface of ifaces[ifname] ?? []) {
      if (!iface.internal) {
        if (iface.family === 'IPv4') {
          bestAddr = iface.address;
          if (ipVersionPreference === 4 || !ipVersionPreference) {
            return bestAddr;
          }
        } else if (iface.family === 'IPv6') {
          bestAddr = iface.address;
          if (ipVersionPreference === 6 || !ipVersionPreference) {
            return bestAddr;
          }
        }
      }
    }
  }
  return bestAddr;
}

export async function stat(path: PathLike, options?: StatOptions) {
  try {
    const stats = await fs.stat(path, options);
    return stats;
  } catch (err) {
    if ((<ProcFSException>err).code === 'ENOENT') {
      return null;
    } else {
      throw err;
    }
  }
}
