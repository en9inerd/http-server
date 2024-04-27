export class ServerException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ServerException';
  }
}

type ErrorCode = 'ENOENT' | 'EACCES' | 'EEXIST' | 'EISDIR' | 'ENOTDIR';

export class ProcFSException extends Error {
  code?: ErrorCode;
  constructor(message: string, options?: { cause?: unknown }, code?: ErrorCode) {
    super(message, options);
    this.name = 'ProcFSException';
    this.code = code;
  }
}
