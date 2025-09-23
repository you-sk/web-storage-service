import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService, tagService } from '../services/api'
import FilePreview from '../components/FilePreview'

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [editingMetadata, setEditingMetadata] = useState<{ id: string; metadata: any } | null>(null)
  const [metadataText, setMetadataText] = useState('')
  const [editingTags, setEditingTags] = useState<{ fileId: string; selectedTags: string[] } | null>(null)
  const [newTagName, setNewTagName] = useState('')
  const [showTagManager, setShowTagManager] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagFilter, setSelectedTagFilter] = useState<string[]>([])
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [previewFile, setPreviewFile] = useState<any | null>(null)
  const [publicLinkModal, setPublicLinkModal] = useState<{ fileId: string; publicId: string | null; isPublic: boolean } | null>(null)

  const { data: files, isLoading } = useQuery({
    queryKey: ['files', searchQuery, selectedTagFilter, selectedTypeFilter],
    queryFn: async () => {
      if (isSearching) {
        const response = await fileService.searchFiles(searchQuery, selectedTagFilter, selectedTypeFilter)
        return response.files
      } else {
        const response = await fileService.getFiles()
        return response.files
      }
    },
  })

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await tagService.getTags()
      return response.tags
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

  const uploadMultipleMutation = useMutation({
    mutationFn: async (files: File[]) => {
      return fileService.uploadMultiple(files)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setSelectedFiles([])
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

  const metadataMutation = useMutation({
    mutationFn: async ({ id, metadata }: { id: string; metadata: any }) => {
      return fileService.updateMetadata(id, metadata)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setEditingMetadata(null)
      setMetadataText('')
    },
  })

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      return fileService.updateVisibility(id, isPublic)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      if (publicLinkModal) {
        setPublicLinkModal({
          ...publicLinkModal,
          isPublic: data.isPublic,
          publicId: data.publicId
        })
      }
    },
  })

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      return tagService.createTag(name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
    },
  })

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      return tagService.deleteTag(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const updateFileTagsMutation = useMutation({
    mutationFn: async ({ fileId, tagIds }: { fileId: string; tagIds: string[] }) => {
      return tagService.updateFileTags(fileId, tagIds)
    },
    onSuccess: () => {
      setEditingTags(null)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleMultipleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles(filesArray)
    }
  }

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile)
    }
  }

  const handleMultipleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMultipleMutation.mutate(selectedFiles)
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

  const handleEditMetadata = (file: any) => {
    const metadata = file.metadata ? (typeof file.metadata === 'string' ? JSON.parse(file.metadata) : file.metadata) : {}
    setEditingMetadata({ id: file.id, metadata })
    setMetadataText(JSON.stringify(metadata, null, 2))
  }

  const saveMetadata = () => {
    if (editingMetadata) {
      try {
        const metadata = JSON.parse(metadataText)
        metadataMutation.mutate({ id: editingMetadata.id, metadata })
      } catch (error) {
        alert('Invalid JSON format')
      }
    }
  }

  const handleEditTags = async (fileId: string) => {
    const response = await tagService.getFileTags(fileId)
    const selectedTags = response.tags.map((tag: any) => tag.id.toString())
    setEditingTags({ fileId, selectedTags })
  }

  const saveFileTags = () => {
    if (editingTags) {
      updateFileTagsMutation.mutate({
        fileId: editingTags.fileId,
        tagIds: editingTags.selectedTags
      })
    }
  }

  const createTag = () => {
    if (newTagName.trim()) {
      createTagMutation.mutate(newTagName.trim())
    }
  }

  const handleSearch = () => {
    setIsSearching(true)
    queryClient.invalidateQueries({ queryKey: ['files'] })
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSelectedTagFilter([])
    setSelectedTypeFilter('')
    setIsSearching(false)
    queryClient.invalidateQueries({ queryKey: ['files'] })
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">File Upload</h2>

          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Single File Upload</h3>
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

            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">Multiple Files Upload</h3>
              <input
                type="file"
                multiple
                onChange={handleMultipleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {selectedFiles.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  <div className="font-medium">Selected {selectedFiles.length} file(s):</div>
                  <ul className="mt-1 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="text-xs">
                        {file.name} ({formatFileSize(file.size)})
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 font-medium">
                    Total size: {formatFileSize(selectedFiles.reduce((acc, file) => acc + file.size, 0))}
                  </div>
                </div>
              )}
              <button
                onClick={handleMultipleUpload}
                disabled={selectedFiles.length === 0 || uploadMultipleMutation.isPending}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {uploadMultipleMutation.isPending ? 'Uploading...' : `Upload ${selectedFiles.length} Files`}
              </button>
            </div>
          </div>

          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Search & Filter Files</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or metadata..."
                className="px-3 py-2 border border-gray-300 rounded"
              />

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">All file types</option>
                <option value="image">Images</option>
                <option value="pdf">PDF</option>
                <option value="text">Text</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>

              <div className="flex gap-2">
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Search
                </button>
                {isSearching && (
                  <button
                    onClick={clearSearch}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: any) => (
                  <label key={tag.id} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTagFilter.includes(tag.id.toString())}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTagFilter([...selectedTagFilter, tag.id.toString()])
                        } else {
                          setSelectedTagFilter(selectedTagFilter.filter(id => id !== tag.id.toString()))
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                      {tag.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Your Files</h3>
            <button
              onClick={() => setShowTagManager(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Manage Tags
            </button>
          </div>
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
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded ${file.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {file.is_public ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </div>
                      {file.metadata && (
                        <pre className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                          {JSON.stringify(JSON.parse(file.metadata), null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="px-3 py-1 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleEditTags(file.id)}
                        className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                      >
                        Tags
                      </button>
                      <button
                        onClick={() => handleEditMetadata(file)}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                      >
                        Metadata
                      </button>
                      <button
                        onClick={() => setPublicLinkModal({ fileId: file.id, publicId: file.public_id, isPublic: file.is_public })}
                        className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600"
                      >
                        Share
                      </button>
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
              「{deleteConfirm.name}」をゴミ箱に移動しますか？ゴミ箱からファイルを復元または完全に削除できます。
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

      {editingMetadata && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Metadata</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Metadata (JSON format)
              </label>
              <textarea
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm"
                placeholder='{"key": "value", "description": "File description"}'
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingMetadata(null)
                  setMetadataText('')
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveMetadata}
                disabled={metadataMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {metadataMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTags && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit File Tags</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select tags for this file
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tags.map((tag: any) => (
                  <label key={tag.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingTags.selectedTags.includes(tag.id.toString())}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditingTags({
                            ...editingTags,
                            selectedTags: [...editingTags.selectedTags, tag.id.toString()]
                          })
                        } else {
                          setEditingTags({
                            ...editingTags,
                            selectedTags: editingTags.selectedTags.filter(id => id !== tag.id.toString())
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span>{tag.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingTags(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveFileTags}
                disabled={updateFileTagsMutation.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {updateFileTagsMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreview
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {publicLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">File Sharing Settings</h3>

            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicLinkModal.isPublic}
                  onChange={(e) => {
                    visibilityMutation.mutate({
                      id: publicLinkModal.fileId,
                      isPublic: e.target.checked
                    })
                  }}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Make file publicly accessible</span>
              </label>
            </div>

            {publicLinkModal.isPublic && publicLinkModal.publicId && (
              <div className="mb-4 p-3 bg-gray-50 rounded">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Public Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/api/public/files/${publicLinkModal.publicId}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded bg-white"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/public/files/${publicLinkModal.publicId}`)
                      alert('Link copied to clipboard!')
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Anyone with this link can view and download the file
                </p>
              </div>
            )}

            {visibilityMutation.isPending && (
              <p className="text-sm text-gray-600 mb-4">Updating visibility...</p>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setPublicLinkModal(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTagManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Manage Tags</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Create New Tag
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  onClick={createTag}
                  disabled={createTagMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {createTagMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Existing Tags
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tags.length > 0 ? (
                  tags.map((tag: any) => (
                    <div key={tag.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{tag.name}</span>
                      <button
                        onClick={() => deleteTagMutation.mutate(tag.id)}
                        disabled={deleteTagMutation.isPending}
                        className="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No tags created yet</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowTagManager(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}