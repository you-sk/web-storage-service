import React, { useState, useEffect } from 'react';
import { FiTrash2, FiRefreshCw, FiDownload, FiAlertCircle } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface TrashFile {
  id: number;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  deleted_at: string;
  created_at: string;
}

const Trash: React.FC = () => {
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<number | null>(null);

  const fetchTrashFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/files/trash/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trash files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching trash files:', error);
      alert('ゴミ箱の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrashFiles();
  }, []);

  const restoreFile = async (fileId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to restore file');
      }

      alert('ファイルを復元しました');
      await fetchTrashFiles();
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Error restoring file:', error);
      alert('ファイルの復元に失敗しました');
    }
  };

  const permanentlyDeleteFile = async (fileId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/permanent`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to permanently delete file');
      }

      alert('ファイルを完全に削除しました');
      await fetchTrashFiles();
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Error permanently deleting file:', error);
      alert('ファイルの削除に失敗しました');
    }
  };

  const emptyTrash = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/files/trash/empty', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to empty trash');
      }

      const data = await response.json();
      alert(`ゴミ箱を空にしました（${data.deletedCount}件のファイルを削除）`);
      await fetchTrashFiles();
      setSelectedFiles(new Set());
    } catch (error) {
      console.error('Error emptying trash:', error);
      alert('ゴミ箱の削除に失敗しました');
    }
  };

  const restoreSelected = async () => {
    for (const fileId of selectedFiles) {
      await restoreFile(fileId);
    }
  };

  const deleteSelected = async () => {
    for (const fileId of selectedFiles) {
      await permanentlyDeleteFile(fileId);
    }
    setShowDeleteConfirm(false);
    setSelectedFiles(new Set());
  };

  const toggleFileSelection = (fileId: number) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FiTrash2 className="mr-3 text-gray-500" size={24} />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                ゴミ箱
              </h3>
              <span className="ml-3 text-sm text-gray-500">
                ({files.length}件)
              </span>
            </div>
            <div className="flex space-x-3">
              {selectedFiles.size > 0 && (
                <>
                  <button
                    onClick={restoreSelected}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <FiRefreshCw className="mr-2" size={16} />
                    選択したファイルを復元
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    <FiTrash2 className="mr-2" size={16} />
                    選択したファイルを完全削除
                  </button>
                </>
              )}
              {files.length > 0 && (
                <button
                  onClick={() => setShowEmptyConfirm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  <FiTrash2 className="mr-2" size={16} />
                  ゴミ箱を空にする
                </button>
              )}
            </div>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-12">
            <FiTrash2 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">ゴミ箱は空です</h3>
            <p className="mt-1 text-sm text-gray-500">削除されたファイルはありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === files.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    サイズ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    削除日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.original_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(new Date(file.deleted_at), {
                        addSuffix: true,
                        locale: ja
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button
                        onClick={() => restoreFile(file.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        復元
                      </button>
                      <button
                        onClick={() => {
                          setFileToDelete(file.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        完全削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 空にする確認ダイアログ */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center mb-4">
              <FiAlertCircle className="text-red-600 mr-3" size={24} />
              <h3 className="text-lg font-medium text-gray-900">ゴミ箱を空にしますか？</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              この操作は取り消すことができません。すべてのファイルが完全に削除されます。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  emptyTrash();
                  setShowEmptyConfirm(false);
                }}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                空にする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center mb-4">
              <FiAlertCircle className="text-red-600 mr-3" size={24} />
              <h3 className="text-lg font-medium text-gray-900">ファイルを完全削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              この操作は取り消すことができません。ファイルが完全に削除されます。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setFileToDelete(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (fileToDelete) {
                    await permanentlyDeleteFile(fileToDelete);
                    setFileToDelete(null);
                  } else if (selectedFiles.size > 0) {
                    await deleteSelected();
                  }
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;