# http-server

> This is a fork of [rsms/serve-http](https://github.com/rsms/serve-http) with some modifications.

Simple single-file local web server

`npm i -g @enginerd/http-server`

- Single file without dependencies — copy it into your project.
- Livereload — HTML pages reload automatically in web browsers as they change.
- Safety feature: Only serves local connections unless given explicit command-line argument.
- Safety feature: Refuses to serve directories outside home directory to remote connections.

Install through [`npm i -g @enginerd/http-server`](https://www.npmjs.com/package/@enginerd/http-server)

```
$ ./http-server -help
Usage: http-server [options] [<dir>]

<dir>
  Directory to serve files from. Defaults to the current directory.

Options:
  -p, -port <port>  Listen on specific <port>
  -host <host>      Bind to <host> instead of "localhost"
  -public           Accept connections from anywhere (same as -host "")
  -q, -quiet        Don't log requests
  -no-livereload    Disable livereload
  -no-dirlist       Disable directory listing
  -dirlist-hidden   Show files beginning with "." in directory listings
  -h, -help         Show help and exit
  -version          Print version to stdout and exit

Examples:

  http-server
    Serve current directory on some available port

  http-server -p 8080 docs
    Serve directory ./docs locally on port 8080

  http-server -public -no-dirlist
    Serve current directory publicly on some available port,
    without directory listing.

```

## JavaScript API

http-server can also be used as a library:

```js
import { createServer } from "@enginerd/http-server";
const __dirname = import.meta.dirname;
const server = createServer({ pubdir: __dirname, port: 1234, showServingMessage: true });
// `server` is a standard nodejs http server instance.
```

See TypeScript type definitions for documentation of the API:
[`http-server.d.ts`](http-server.d.ts)
