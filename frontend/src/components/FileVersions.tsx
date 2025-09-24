import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface FileVersion {
  id: number | null;
  file_id: number;
  version_number: number;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  path: string;
  metadata: string;
  change_description: string;
  created_by: number;
  created_by_username: string;
  created_at: string;
  is_current?: boolean;
}

interface FileVersionsProps {
  fileId: number;
  onClose: () => void;
}

const FileVersions: React.FC<FileVersionsProps> = ({ fileId, onClose }) => {
  const [currentVersion, setCurrentVersion] = useState<FileVersion | null>(null);
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changeDescription, setChangeDescription] = useState('');
  const [comparing, setComparing] = useState(false);
  const [version1, setVersion1] = useState<string>('');
  const [version2, setVersion2] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  useEffect(() => {
    fetchVersions();
  }, [fileId]);

  const fetchVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setCurrentVersion(response.data.current);
      setVersions(response.data.versions);
    } catch (error) {
      console.error('Error fetching versions:', error);
      toast.error('Failed to fetch file versions');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadNewVersion = async () => {
    if (!newVersionFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', newVersionFile);
    formData.append('change_description', changeDescription);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      toast.success('New version uploaded successfully');
      setNewVersionFile(null);
      setChangeDescription('');
      setUploadingNewVersion(false);
      fetchVersions();
    } catch (error) {
      console.error('Error uploading new version:', error);
      toast.error('Failed to upload new version');
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!confirm('Are you sure you want to restore this version?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions/${versionId}/restore`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      toast.success('Version restored successfully');
      fetchVersions();
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    }
  };

  const handleDownloadVersion = async (versionId: number, originalName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions/${versionId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading version:', error);
      toast.error('Failed to download version');
    }
  };

  const handleDeleteVersion = async (versionId: number) => {
    if (!confirm('Are you sure you want to delete this version? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions/${versionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      toast.success('Version deleted successfully');
      fetchVersions();
    } catch (error) {
      console.error('Error deleting version:', error);
      toast.error('Failed to delete version');
    }
  };

  const handleCompareVersions = async () => {
    if (!version1 || !version2) {
      toast.error('Please select two versions to compare');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/files/${fileId}/versions/compare`,
        {
          params: { v1: version1, v2: version2 },
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      setComparisonResult(response.data);
    } catch (error) {
      console.error('Error comparing versions:', error);
      toast.error('Failed to compare versions');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">Loading versions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">File Version History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upload New Version Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          {!uploadingNewVersion ? (
            <button
              onClick={() => setUploadingNewVersion(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Upload New Version
            </button>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Upload New Version</h3>
              <input
                type="file"
                onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <input
                type="text"
                placeholder="Change description (optional)"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUploadNewVersion}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Upload
                </button>
                <button
                  onClick={() => {
                    setUploadingNewVersion(false);
                    setNewVersionFile(null);
                    setChangeDescription('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version Comparison Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          {!comparing ? (
            <button
              onClick={() => setComparing(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Compare Versions
            </button>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold">Compare Versions</h3>
              <div className="flex gap-4">
                <select
                  value={version1}
                  onChange={(e) => setVersion1(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select first version</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id?.toString()}>
                      Version {v.version_number} - {format(new Date(v.created_at), 'PPP')}
                    </option>
                  ))}
                </select>
                <select
                  value={version2}
                  onChange={(e) => setVersion2(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select second version</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id?.toString()}>
                      Version {v.version_number} - {format(new Date(v.created_at), 'PPP')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCompareVersions}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Compare
                </button>
                <button
                  onClick={() => {
                    setComparing(false);
                    setVersion1('');
                    setVersion2('');
                    setComparisonResult(null);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>

              {comparisonResult && (
                <div className="mt-4 p-4 bg-white rounded border">
                  <h4 className="font-semibold mb-2">Comparison Result</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium">Version {comparisonResult.version1.version_number}</h5>
                      <p className="text-sm text-gray-600">File: {comparisonResult.version1.original_name}</p>
                      <p className="text-sm text-gray-600">Size: {formatFileSize(comparisonResult.version1.size)}</p>
                      <p className="text-sm text-gray-600">Date: {format(new Date(comparisonResult.version1.created_at), 'PPP')}</p>
                    </div>
                    <div>
                      <h5 className="font-medium">Version {comparisonResult.version2.version_number}</h5>
                      <p className="text-sm text-gray-600">File: {comparisonResult.version2.original_name}</p>
                      <p className="text-sm text-gray-600">Size: {formatFileSize(comparisonResult.version2.size)}</p>
                      <p className="text-sm text-gray-600">Date: {format(new Date(comparisonResult.version2.created_at), 'PPP')}</p>
                    </div>
                  </div>
                  <div className="mt-2 text-sm">
                    <p>Size difference: {formatFileSize(Math.abs(comparisonResult.differences.size_diff))}</p>
                    <p>Time difference: {Math.round(comparisonResult.differences.time_diff / (1000 * 60 * 60 * 24))} days</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current Version */}
        {currentVersion && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Current Version</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-600">Version:</span>
                <p className="font-medium">{currentVersion.version_number}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">File Name:</span>
                <p className="font-medium">{currentVersion.original_name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Size:</span>
                <p className="font-medium">{formatFileSize(currentVersion.size)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Last Modified:</span>
                <p className="font-medium">{format(new Date(currentVersion.created_at), 'PPP')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Version History */}
        <div>
          <h3 className="font-semibold mb-4">Version History</h3>
          {versions.length === 0 ? (
            <p className="text-gray-500">No previous versions available</p>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="font-semibold">Version {version.version_number}</span>
                        <span className="text-sm text-gray-600">
                          {format(new Date(version.created_at), 'PPP p')}
                        </span>
                        <span className="text-sm text-gray-600">
                          by {version.created_by_username}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span>File: {version.original_name}</span>
                        <span className="mx-2">•</span>
                        <span>Size: {formatFileSize(version.size)}</span>
                      </div>
                      {version.change_description && (
                        <p className="text-sm italic text-gray-700">
                          "{version.change_description}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestoreVersion(version.id!)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDownloadVersion(version.id!, version.original_name)}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDeleteVersion(version.id!)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileVersions;