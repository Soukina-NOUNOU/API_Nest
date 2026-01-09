import { HttpException, HttpStatus } from '@nestjs/common';

// 400 Bad Request
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

// 401 Unauthorized
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

// 403 Forbidden
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

// 404 Not Found
export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

// 409 Conflict
export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(message, HttpStatus.CONFLICT);
  }
}

// 500 Internal Server Error
export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error') {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

// 501 Not Implemented
export class NotImplementedException extends HttpException {
  constructor(message = 'Not Implemented') {
    super(message, HttpStatus.NOT_IMPLEMENTED);
  }
}

// 502 Bad Gateway
export class BadGatewayException extends HttpException {
  constructor(message = 'Bad Gateway') {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}

// 503 Service Unavailable
export class ServiceUnavailableException extends HttpException {
  constructor(message = 'Service Unavailable') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}