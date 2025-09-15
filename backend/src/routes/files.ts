import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { runQuery, runInsert, runSingle } from '../config/database';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || '/app/uploads';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760')
  }
});

router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = req.body.metadata ? JSON.stringify(req.body.metadata) : null;

    const fileId = await runInsert(
      `INSERT INTO files (user_id, filename, original_name, mimetype, size, path, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path,
        metadata
      ]
    );

    return res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const files = await runQuery(
      `SELECT id, filename, original_name, mimetype, size, metadata, created_at
       FROM files WHERE user_id = ? ORDER BY created_at DESC`,
      [req.userId]
    );

    return res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/download', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = await runSingle(
      `SELECT * FROM files WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const filePath = file.path as string;

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    const originalName = file.original_name as string;

    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;