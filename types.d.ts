export interface ServerConfig {
  // bind to port. If falsy, some free user-space port is assigned
  port?: number

  // bind to host (defaults to "localhost")
  host?: string

  // bind to public address; make server accessible to the outside world
  public?: boolean

  // directory to serve. (default "."; current directory.)
  pubdir?: string

  // don't log requests (still logs errors)
  quiet?: boolean

  // log "serving DIR at URL" message on startup
  showServingMessage?: boolean

  // mime type for unknown file types
  defaultMimeType?: string

  // file to serve for directory requests (defaults to "index.html")
  indexFilename?: string

  // disable or customize directory listing
  dirlist?: DirlistOptions | boolean

  // emulate slow connection
  emulateSlowConnection?: boolean
}

export interface DirlistOptions {
  // disable directory listing
  disable?: boolean

  // include files which name starts with "."
  showHidden?: boolean
}

// Start a server
export function createServer(opts?: ServerConfig): Server
