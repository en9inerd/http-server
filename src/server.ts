import { type Stats, realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { DirlistOptions, ServerConfig } from '../types.js';
import { createDirectoryListingHTML } from './dirlist.js';
import type { ProcFSException, ServerException } from './exceptions.js';
import { extToMimeType } from './mime.js';
import { checkSafePubdir } from './safe.js';
import type { Server } from './server.interface.js';
import { addrToURL, die, dlog, stat } from './util.js';

let pubdir = '';  // absolute path
let server: Server;

export function createServer(opts?: ServerConfig): Server {
  opts = opts ? Object.assign({}, opts) : {}; // copy
  opts.host = opts.host || (opts.public ? '' : 'localhost');
  opts.port = opts.port && opts.port > 0 ? opts.port : undefined;
  opts.dirlist = (
    opts.dirlist && typeof opts.dirlist === 'object' ? opts.dirlist :
      { disable: opts.dirlist !== undefined && !opts.dirlist }
  );

  pubdir = path.resolve(opts.pubdir || '.');
  try {
    pubdir = realpathSync(pubdir);
  } catch (err) {
    if ((<ProcFSException>err).code === 'ENOENT') {
      die(`Directory ${pubdir} does not exist`);
    }
    throw err;
  }

  const handlers = [];
  if (!opts.quiet) {
    handlers.push(requestLogger());
  }
  handlers.push(handleRequest);
  const handler = formHandlerChain(handlers);

  const handler2 = (req: IncomingMessage, res: ServerResponse) => handler(req, res).catch((err: ServerException) => {
    console.error('Internal server error:', err.stack || String(err));
    return endResponse(res, 500, `Internal server error: ${err}`);
  });

  server = createHttpServer(handler2) as Server;
  server.options = opts;

  server.localOnly = true;
  if (opts.host !== 'localhost' && opts.host !== '127.0.0.1' && opts.host !== '::1') {
    server.localOnly = false;
    if (!opts.public) {
      const msg = checkSafePubdir(pubdir);
      if (msg) {
        die(`Refusing to allow external connections for security reasons:\n  ${msg.replace(/\.$/, '.')}.\n  Set -public to ignore this safeguard. Please be careful.`);
      }
    }
  }

  server.listen(opts.port, opts.host, () => {
    const addr = server.address() as AddressInfo;

    if (opts.showServingMessage) {
      let dir = path.relative('.', pubdir);
      if (dir[0] !== '.') {
        dir = `./${dir}`;
      } else if (dir === '..' || dir.startsWith('../')) {
        dir = pubdir;
        const homedir = os.homedir();
        if (homedir === dir) {
          dir = '~/';
        } else if (homedir && dir.startsWith(homedir)) {
          dir = `~${dir.slice(homedir.length)}`;
        }
      }
      console.log(
        'serving %s%s at %s',
        dir,
        server.localOnly ? '' : ' PUBLICLY TO THE INTERNET',
        addrToURL(addr)
      );
    }

    // DEBUG && setTimeout(() => {
    //   require("http").get("http://localhost:" + addr.port + "/dir/", async res => {
    //     dlog("headers:\n  %s",
    //       Object.keys(res.headers).map(k => `${k}: ${res.headers[k]}`).join("\n  ")
    //     )
    //     let body = await readStream(res)
    //     console.log("body:", body.toString("utf8"))
    //   })
    // }, 100)
  });

  return server;
}

function formHandlerChain(handlers: Array<CallableFunction>) {
  // [ h1, h2, h3 ]
  // ->
  // (req, res) =>
  //   h1(req, res).then(() =>
  //     h2(req, res).then(() =>
  //       h3(req, res)))
  //
  handlers = handlers.filter(f => !!f);
  if (handlers.length === 1) {
    return handlers[0];
  }
  return handlers.reduce((prev, next) =>
    (req: IncomingMessage, res: ServerResponse) =>
      prev(req, res).then((req1: IncomingMessage, res1: ServerResponse) =>
        next(req1 || req, res1 || res))
  );
}

function requestLogger() {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const end = res.end;
    let statusCode: number;

    // @ts-ignore
    // biome-ignore lint/suspicious/noExplicitAny: really any type
    res.end = (chunk: any, encoding: BufferEncoding) => {
      res.end = end;
      res.end(chunk, encoding);
      const addr = req.socket?.remoteAddress;
      const time = (new Date).toUTCString();
      const httpv = `${req.httpVersionMajor}.${req.httpVersionMinor}`;
      const status = statusCode || res.statusCode;
      const ua = req.headers['user-agent'] || '-';
      console.log(`${addr} [${time}] "${req.method} ${req.url} HTTP/${httpv}" ${status} ${ua}`);
    };
  };
}


function endResponse(res: ServerResponse, status: number, str?: string, encoding?: BufferEncoding) {
  const body = str ? Buffer.from(`${str.trim()}\n`, 'utf8') : undefined;
  res.writeHead(status, {
    'Content-Type': 'text/plain',
    'Content-Length': body ? String(body.length) : '0',
  });
  res.end(body);
}


function replyNotFound(req: IncomingMessage & { pathname: string }, res: ServerResponse) {
  endResponse(res, 404, `404 not found ${req.pathname}`, 'utf8');
}


function readStream(req: IncomingMessage & { body?: Buffer }) {
  return new Promise(resolve => {
    if (req.body && req.body instanceof Buffer) {
      return resolve(req.body);
    }
    // biome-ignore lint/suspicious/noExplicitAny: really any type
    const body: any[] = [];
    req.on('data', data => body.push(data));
    req.on('end', () => {
      req.body = Buffer.concat(body)
      resolve(req.body);
    });
  });
}


async function handleRequest(req: IncomingMessage & { pathname: string }, res: ServerResponse) {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`).pathname;
  req.pathname = decodeURIComponent(parsedUrl).replace(/^\.{2,}|\.{2,}$/g, '');

  // Only allow writing over files if the server can only accept local connections
  if (req.method === 'POST' && server.localOnly) {
    return handlePOSTFileRequest(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return handleGETFileRequest(req, res);
  }

  endResponse(res, 500, `Unsupported method ${req.method}`);
}

async function handleGETFileRequest(req: IncomingMessage & { pathname: string }, res: ServerResponse) {
  const filename = path.join(pubdir, req.pathname);
  const st = await stat(filename) as Stats;
  if (!st) {
    return replyNotFound(req, res);
  }
  if (st.isFile()) {
    return serveFile(req, res, filename, st);
  }
  if (st.isDirectory()) {
    return serveDir(req, res, filename);
  }
  endResponse(res, 404, `404 not found ${req.pathname} (unreadable file type)`, 'utf8');
}


async function handlePOSTFileRequest(req: IncomingMessage & { pathname: string }, res: ServerResponse) {
  // Write files with POST. Example:
  //   curl -X POST -H "Content-Type: text/plain" -d "Hello" http://localhost:8090/hello.txt
  //
  const remoteAddr = (<AddressInfo>req.socket.address()).address;
  if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1') {
    return endResponse(res, 403, 'Forbidden');
  }

  const origin = req.headers.origin && new URL(req.headers.origin, `http://${req.headers.host}`).hostname;
  if (origin) {
    // if (origin !== 'localhost' && origin !== '127.0.0.1' && origin !== "::1") {
    //   return endResponse(res, 403, "Forbidden")
    // }
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  const filename = path.join(pubdir, req.pathname);
  const [st, body] = await Promise.all([
    stat(filename, {}),
    readStream(req)
  ]);
  if (st?.isDirectory()) {
    return endResponse(res, 409, 'Conflict: Directory exists at path');
  }
  await writeFile(filename, body as Buffer);
  if (st) {
    endResponse(res, 200, 'File replaced');
  } else {
    endResponse(res, 201, 'File created');
  }
}


function isProbablyUTF8Text(buf: Buffer) {
  for (let i = 0; i < Math.min(4096, buf.length); i++) {
    const b = buf[i];
    if (b <= 0x08) { return false; }
    if (b >= 0x80 && ((b >> 5) !== 0x6 || (b >> 4) !== 0xe || (b >> 3) !== 0x1e)) {
      return false;  // not UTF-8
    }
  }
  return true;
}


async function serveFile(req: IncomingMessage & { pathname: string }, res: ServerResponse, filename: string, st: Stats) {
  const opts = server.options;
  res.statusCode = 200;

  let body = await readFile(filename);

  const mimeType = (
    extToMimeType[path.extname(filename).slice(1)] ||
    opts.defaultMimeType ||
    (isProbablyUTF8Text(body) ? 'text/plain; charset=utf-8' : 'application/octet-stream')
  );

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Last-Modified', st.mtime.toUTCString());
  res.setHeader('ETag', etag(st));
  res.setHeader('Content-Length', body.length);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  if (opts?.emulateSlowConnection) {
    const chunkTime = 1000; // Stream each file out over a second
    const chunkCount = 100; // The number of chunks to deliver the file in
    const chunkSize = Math.ceil(body.length / chunkCount);
    function next() {
      if (body.length > 0) {
        res.write(body.subarray(0, chunkSize));
        body = body.subarray(chunkSize);
        setTimeout(next, chunkTime / chunkCount);
      } else {
        res.end();
      }
    }
    return next();
  }

  res.end(body);
}


async function serveDir(req: IncomingMessage & { pathname: string }, res: ServerResponse, filename: string) {
  dlog('serveDir %r', req.pathname);
  const opts = server.options;
  const indexFilename = opts.indexFilename || 'index.html';

  const indexFile = path.join(filename, indexFilename);
  const indexFileSt = await stat(indexFile) as Stats;
  if (indexFileSt?.isFile()) {
    return serveFile(req, res, indexFile, indexFileSt);
  }

  if (typeof opts?.dirlist === 'object' && opts.dirlist.disable) {
    return replyNotFound(req, res);
  }

  if (req.pathname[req.pathname.length - 1] !== '/') {
    // redirect to "/"
    res.writeHead(303, {
      Expires: 'Sun, 11 Mar 1984 12:00:00 GMT',
      Location: `${req.pathname}/`,
      'Content-Length': '0',
    });
    res.end();
    return;
  }

  let body: string | Buffer = await createDirectoryListingHTML(filename, req.pathname, opts.dirlist as DirlistOptions);
  body = Buffer.from(body, 'utf8');
  res.writeHead(200, {
    Expires: 'Sun, 11 Mar 1984 12:00:00 GMT',
    'Content-Type': 'text/html',
    'Content-Length': String(body.length),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}


function etag(st: Stats) {
  return `"${st.mtimeMs.toString(36)}-${st.ino.toString(36)}-${st.size.toString(36)}"`;
}
