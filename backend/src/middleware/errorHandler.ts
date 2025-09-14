import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: 'Unauthorized'
    });
    return;
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
};