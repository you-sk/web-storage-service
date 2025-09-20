import { Router, Response, Request } from 'express';
import path from 'path';
import fs from 'fs';
import { runSingle } from '../config/database';

const router = Router();

router.get('/files/:publicId', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { publicId } = req.params;

    const file = await runSingle(
      `SELECT * FROM files WHERE public_id = ? AND is_public = 1`,
      [publicId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or not public' });
    }

    const filePath = file.path as string;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const originalName = file.original_name as string;
    const mimetype = file.mimetype as string;

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);

    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Public file access error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:publicId/info', async (req: Request, res: Response): Promise<Response> => {
  try {
    const { publicId } = req.params;

    const file = await runSingle(
      `SELECT id, original_name, mimetype, size, created_at FROM files WHERE public_id = ? AND is_public = 1`,
      [publicId]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or not public' });
    }

    return res.json({
      file: {
        originalName: file.original_name,
        mimetype: file.mimetype,
        size: file.size,
        createdAt: file.created_at
      }
    });
  } catch (error) {
    console.error('Public file info error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/files/:publicId/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const { publicId } = req.params;

    const file = await runSingle(
      `SELECT * FROM files WHERE public_id = ? AND is_public = 1`,
      [publicId]
    );

    if (!file) {
      res.status(404).json({ error: 'File not found or not public' });
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
        console.error('Public download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      }
    });
  } catch (error) {
    console.error('Public download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;