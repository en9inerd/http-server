import { parseopts } from './parseopts.js';
import { createServer } from './server.js';
import path from 'node:path';

function usage() {
  const v = process.argv;
  let prog = v[0].endsWith('node') ? path.relative(process.cwd(), path.resolve(v[1])) : v[0];
  const progl = `./${prog}`;
  if (process.env._ === progl) {
    // common case: ./http-server (in cwd)
    prog = progl;
  }
  prog = path.basename(prog);
  const s = `${`
Usage: ${prog} [options] [<dir>]

<dir>
  Directory to serve files from. Defaults to the current directory.

Options:
  -p, -port <port>  Listen on specific <port>
  -host <host>      Bind to <host> instead of "localhost"
  -public           Accept connections from anywhere (same as -host "")
  -q, -quiet        Don't log requests
  -no-dirlist       Disable directory listing
  -dirlist-hidden   Show files beginning with "." in directory listings
  -h, -help         Show help and exit
  -version          Print version to stdout and exit

Examples:

  ${prog}
    Serve current directory on some available port

  ${prog} -p 8080 docs
    Serve directory ./docs locally on port 8080

  ${prog} -public -no-dirlist
    Serve current directory publicly on some available port,
    without directory listing.

  `.trim()}\n`;
  console.log(s);
  process.exit(0);
}

const opts = {
  // available command-line options with default values
  port: 0, p: 0,
  host: 'localhost',
  public: false,
  q: false, quiet: false,
  noDirlist: false,  // disable directory listing
  dirlistHidden: false,
  version: false,
};

function main() {
  const args = parseopts(process.argv.slice(2), opts, usage);

  if (opts.version) {
    console.log(VERSION);
    process.exit(0);
  }

  let pubdir = '';
  if (args.length > 0) {
    if (args.length > 1) {
      console.error(`ignoring extra arguments: ${args.slice(1).join(' ')}`);
    }
    pubdir = args[0];
  }

  if (opts.public && opts.host === 'localhost') {
    opts.host = '';
  }

  opts.quiet = opts.quiet || opts.q;

  const server = createServer({
    port: opts.port || opts.p,
    host: opts.host,
    public: opts.public,
    quiet: opts.quiet,
    showServingMessage: true,
    pubdir,
    dirlist: {
      disable: opts.noDirlist,
      showHidden: opts.dirlistHidden,
    }
  });

  // stop server and exit cleanly on ^C
  process.on('SIGINT', () => {
    opts.quiet || console.log(' stopping server');
    server.close(); // stop accepting new connections
    // give ongoing requests a short time to finish processing
    setTimeout(() => process.exit(0), 500).unref();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createServer };
