import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService } from '../services/api'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const { data: files, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: async () => {
      const response = await fileService.getFiles()
      return response.files
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return fileService.upload(file)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setSelectedFile(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return fileService.deleteFile(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setDeleteConfirm(null)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      await fileService.downloadFile(fileId, filename)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name })
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id)
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">File Upload</h2>

          <div className="mb-8">
            <input
              type="file"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </div>
            )}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
            </button>
          </div>

          <h3 className="text-xl font-semibold mb-4">Your Files</h3>
          {isLoading ? (
            <p>Loading files...</p>
          ) : files && files.length > 0 ? (
            <div className="grid gap-4">
              {files.map((file: any) => (
                <div key={file.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold">{file.original_name}</h4>
                      <p className="text-sm text-gray-600">
                        Size: {formatFileSize(file.size)} | Type: {file.mimetype}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Uploaded: {new Date(file.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(file.id, file.original_name)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(file.id, file.original_name)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No files uploaded yet</p>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}