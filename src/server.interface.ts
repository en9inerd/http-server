import type { Server as NodeServer } from 'node:http';
import type { ServerConfig } from '../types.js';

export interface Server extends NodeServer {
  options: ServerConfig,
  localOnly: boolean
}
