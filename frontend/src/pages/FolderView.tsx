import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fileService, folderService, tagService } from '../services/api'
import FilePreview from '../components/FilePreview'
import { Folder, File as FileIcon, Plus, Trash2, Edit2, MoveIcon, Home, ChevronRight } from 'lucide-react'

export default function FolderView() {
  const { folderId = 'root' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)
  const [newFolderModal, setNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameModal, setRenameModal] = useState<{ id: string; name: string; type: 'folder' | 'file' } | null>(null)
  const [renameName, setRenameName] = useState('')
  const [moveModal, setMoveModal] = useState<{ id: string; name: string; type: 'file' | 'folder' } | null>(null)
  const [selectedMoveTarget, setSelectedMoveTarget] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<any | null>(null)

  const { data: folderData, isLoading } = useQuery({
    queryKey: ['folder', folderId],
    queryFn: async () => {
      return folderService.getFolderContents(folderId)
    },
  })

  const { data: allFolders = [] } = useQuery({
    queryKey: ['all-folders'],
    queryFn: async () => {
      const response = await folderService.getFolders()
      return response.folders
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const actualFolderId = folderId === 'root' ? null : folderId
      return fileService.upload(file, undefined, actualFolderId || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      setSelectedFile(null)
    },
  })

  const uploadMultipleMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const actualFolderId = folderId === 'root' ? null : folderId
      return fileService.uploadMultiple(files, undefined, actualFolderId || undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      setSelectedFiles([])
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const parentId = folderId === 'root' ? null : folderId
      return folderService.createFolder(name, parentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      queryClient.invalidateQueries({ queryKey: ['all-folders'] })
      setNewFolderModal(false)
      setNewFolderName('')
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return folderService.deleteFolder(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      queryClient.invalidateQueries({ queryKey: ['all-folders'] })
      setDeleteConfirm(null)
    },
  })

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return fileService.deleteFile(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      setDeleteConfirm(null)
    },
  })

  const renameFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return folderService.updateFolder(id, name)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      queryClient.invalidateQueries({ queryKey: ['all-folders'] })
      setRenameModal(null)
      setRenameName('')
    },
  })

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, targetId }: { id: string; targetId: string | null }) => {
      return folderService.moveFolder(id, targetId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      queryClient.invalidateQueries({ queryKey: ['all-folders'] })
      setMoveModal(null)
      setSelectedMoveTarget(null)
    },
  })

  const moveFileMutation = useMutation({
    mutationFn: async ({ id, targetId }: { id: string; targetId: string | null }) => {
      return fileService.moveFile(id, targetId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder', folderId] })
      setMoveModal(null)
      setSelectedMoveTarget(null)
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleMultipleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setSelectedFiles(Array.from(files))
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

  const handleDownload = async (fileId: string, filename: string) => {
    await fileService.downloadFile(fileId, filename)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim())
    }
  }

  const handleDelete = () => {
    if (deleteConfirm) {
      if (deleteConfirm.type === 'folder') {
        deleteFolderMutation.mutate(deleteConfirm.id)
      } else {
        deleteFileMutation.mutate(deleteConfirm.id)
      }
    }
  }

  const handleRename = () => {
    if (renameModal && renameName.trim()) {
      if (renameModal.type === 'folder') {
        renameFolderMutation.mutate({ id: renameModal.id, name: renameName.trim() })
      }
    }
  }

  const handleMove = () => {
    if (moveModal) {
      if (moveModal.type === 'folder') {
        moveFolderMutation.mutate({ id: moveModal.id, targetId: selectedMoveTarget })
      } else {
        moveFileMutation.mutate({ id: moveModal.id, targetId: selectedMoveTarget })
      }
    }
  }

  // Build folder tree for move modal
  const buildFolderTree = (folders: any[], parentId: string | null = null, excludeId?: string): any[] => {
    return folders
      .filter(f => f.parent_id === parentId && f.id !== excludeId)
      .map(folder => ({
        ...folder,
        children: buildFolderTree(folders, folder.id, excludeId)
      }))
  }

  if (isLoading) return <div className="p-8">Loading...</div>

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <button
            onClick={() => navigate('/dashboard/folders')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <Home className="h-4 w-4" />
            <span className="ml-1">Home</span>
          </button>
          {folderData?.breadcrumbs?.map((crumb: any, index: number) => (
            <div key={crumb.id} className="flex items-center">
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => navigate(`/dashboard/folders/${crumb.id}`)}
                className="ml-2 text-gray-600 hover:text-gray-900"
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Actions Bar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {folderData?.folder ? folderData.folder.name : 'Files & Folders'}
          </h2>
          <button
            onClick={() => setNewFolderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Folder
          </button>
        </div>

        {/* Upload Section */}
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Selected {selectedFiles.length} file(s)
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
        </div>

        {/* Folders */}
        {folderData?.subfolders && folderData.subfolders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Folders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {folderData.subfolders.map((folder: any) => (
                <div
                  key={folder.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onDoubleClick={() => navigate(`/dashboard/folders/${folder.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1" onClick={() => navigate(`/dashboard/folders/${folder.id}`)}>
                      <Folder className="h-8 w-8 text-blue-500 mr-3" />
                      <div>
                        <h4 className="font-semibold">{folder.name}</h4>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(folder.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameModal({ id: folder.id, name: folder.name, type: 'folder' })
                          setRenameName(folder.name)
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600"
                        title="Rename"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMoveModal({ id: folder.id, name: folder.name, type: 'folder' })
                        }}
                        className="p-1 text-gray-500 hover:text-green-600"
                        title="Move"
                      >
                        <MoveIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirm({ id: folder.id, name: folder.name, type: 'folder' })
                        }}
                        className="p-1 text-gray-500 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {folderData?.files && folderData.files.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Files</h3>
            <div className="grid gap-4">
              {folderData.files.map((file: any) => (
                <div key={file.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center flex-1">
                      <FileIcon className="h-8 w-8 text-gray-500 mr-3" />
                      <div>
                        <h4 className="font-semibold">{file.original_name}</h4>
                        <p className="text-sm text-gray-600">
                          Size: {formatFileSize(file.size)} | Type: {file.mimetype}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded: {new Date(file.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="px-3 py-1 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleDownload(file.id, file.original_name)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => setMoveModal({ id: file.id, name: file.original_name, type: 'file' })}
                        className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                      >
                        Move
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: file.id, name: file.original_name, type: 'file' })}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!folderData?.subfolders || folderData.subfolders.length === 0) &&
         (!folderData?.files || folderData.files.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            <Folder className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>This folder is empty</p>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setNewFolderModal(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {createFolderMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Rename {renameModal.type}</h3>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="New name"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRenameModal(null)
                  setRenameName('')
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameName.trim() || renameFolderMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {renameFolderMutation.isPending ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Move {moveModal.name}</h3>
            <div className="mb-4">
              <div
                className={`p-3 border rounded cursor-pointer mb-2 ${selectedMoveTarget === null ? 'bg-blue-50 border-blue-500' : ''}`}
                onClick={() => setSelectedMoveTarget(null)}
              >
                <div className="flex items-center">
                  <Home className="h-4 w-4 mr-2" />
                  Root Folder
                </div>
              </div>
              {buildFolderTree(allFolders, null, moveModal.type === 'folder' ? moveModal.id : undefined).map((folder: any) => (
                <div key={folder.id} className="ml-4">
                  <div
                    className={`p-3 border rounded cursor-pointer mb-2 ${selectedMoveTarget === folder.id ? 'bg-blue-50 border-blue-500' : ''}`}
                    onClick={() => setSelectedMoveTarget(folder.id)}
                  >
                    <div className="flex items-center">
                      <Folder className="h-4 w-4 mr-2" />
                      {folder.name}
                    </div>
                  </div>
                  {folder.children?.map((child: any) => (
                    <div key={child.id} className="ml-4">
                      <div
                        className={`p-3 border rounded cursor-pointer mb-2 ${selectedMoveTarget === child.id ? 'bg-blue-50 border-blue-500' : ''}`}
                        onClick={() => setSelectedMoveTarget(child.id)}
                      >
                        <div className="flex items-center">
                          <Folder className="h-4 w-4 mr-2" />
                          {child.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMoveModal(null)
                  setSelectedMoveTarget(null)
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMove}
                disabled={moveFolderMutation.isPending || moveFileMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {moveFolderMutation.isPending || moveFileMutation.isPending ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">
              {deleteConfirm.type === 'folder' ?
                `「${deleteConfirm.name}」フォルダを削除しますか？フォルダ内のすべてのファイルとサブフォルダも削除されます。` :
                `「${deleteConfirm.name}」をゴミ箱に移動しますか？ゴミ箱から復元または完全削除できます。`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteFolderMutation.isPending || deleteFileMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleteFolderMutation.isPending || deleteFileMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}