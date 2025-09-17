import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle } from 'lucide-react';

interface FilePreviewProps {
  file: {
    id: number;
    filename: string;
    original_name: string;
    mimetype: string;
    size: number;
  };
  isOpen: boolean;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, isOpen, onClose }) => {
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'text' | 'unsupported'>('unsupported');

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    }
  }, [isOpen, file]);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');

    try {
      // ファイルタイプを判定
      if (file.mimetype.startsWith('image/')) {
        setPreviewType('image');
        // 画像にはトークンをクエリパラメータとして追加
        setPreviewContent(`/api/files/${file.id}/preview?token=${token}`);
      } else if (file.mimetype === 'application/pdf') {
        setPreviewType('pdf');
        // PDFにもトークンをクエリパラメータとして追加
        setPreviewContent(`/api/files/${file.id}/preview?token=${token}`);
      } else if (
        file.mimetype.startsWith('text/') ||
        ['application/json', 'application/javascript', 'application/xml'].includes(file.mimetype)
      ) {
        setPreviewType('text');
        const response = await fetch(`/api/files/${file.id}/preview`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load preview');
        }

        const data = await response.json();
        setPreviewContent(data.content);
      } else {
        setPreviewType('unsupported');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const token = localStorage.getItem('token');
    window.open(`/api/files/${file.id}/download?token=${token}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold">{file.original_name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading preview...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && previewType === 'image' && previewContent && (
            <div className="flex items-center justify-center h-full">
              <img
                src={previewContent}
                alt={file.original_name}
                className="max-w-full max-h-full object-contain"
                onError={() => setError('Failed to load image')}
              />
            </div>
          )}

          {!loading && !error && previewType === 'pdf' && previewContent && (
            <iframe
              src={previewContent}
              className="w-full h-full min-h-[600px]"
              title={file.original_name}
            />
          )}

          {!loading && !error && previewType === 'text' && previewContent && (
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap">
              {previewContent}
            </pre>
          )}

          {!loading && !error && previewType === 'unsupported' && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <AlertCircle className="w-12 h-12 mb-4" />
              <p className="text-lg mb-2">Preview not available</p>
              <p className="text-sm">This file type ({file.mimetype}) cannot be previewed.</p>
              <button
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Download File
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-sm text-gray-500">
          <div className="flex justify-between">
            <span>Type: {file.mimetype}</span>
            <span>Size: {(file.size / 1024).toFixed(2)} KB</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;