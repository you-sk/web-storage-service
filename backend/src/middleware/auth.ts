import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // まずヘッダーからトークンを取得
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // ヘッダーにトークンがない場合は、クエリパラメータから取得（プレビュー用）
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'dev-secret';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = (decoded as any).userId;
    next();
  });
};