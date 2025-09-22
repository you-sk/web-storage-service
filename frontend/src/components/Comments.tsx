import React, { useState, useEffect } from 'react';
import { MessageCircle, Send, Edit2, Trash2, Reply, X, Check } from 'lucide-react';
import { format } from 'date-fns';

interface Comment {
  id: number;
  file_id: number;
  user_id: number;
  content: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  username: string;
  replies?: Comment[];
}

interface CommentsProps {
  fileId: number;
  isPublic?: boolean;
}

const Comments: React.FC<CommentsProps> = ({ fileId, isPublic = false }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentUserId = parseInt(localStorage.getItem('userId') || '0');

  useEffect(() => {
    fetchComments();
  }, [fileId]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/comments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      setComments(data);
    } catch (err) {
      setError('Failed to load comments');
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (parentId?: number) => {
    const content = parentId ? newComment : newComment;
    if (!content.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/files/${fileId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: content.trim(),
          parent_id: parentId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      setNewComment('');
      setReplyingTo(null);
      await fetchComments();
    } catch (err) {
      setError('Failed to add comment');
      console.error('Error adding comment:', err);
    }
  };

  const handleEditComment = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: editContent.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to edit comment');
      }

      setEditingComment(null);
      setEditContent('');
      await fetchComments();
    } catch (err) {
      setError('Failed to edit comment');
      console.error('Error editing comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      await fetchComments();
    } catch (err) {
      setError('Failed to delete comment');
      console.error('Error deleting comment:', err);
    }
  };

  const startEdit = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const CommentItem: React.FC<{ comment: Comment; depth: number }> = ({ comment, depth }) => {
    const isOwner = comment.user_id === currentUserId;
    const isEditing = editingComment === comment.id;
    const isReplying = replyingTo === comment.id;

    return (
      <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}`}>
        <div className="bg-white rounded-lg p-4 mb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="font-semibold text-sm">{comment.username}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                </span>
                {comment.updated_at !== comment.created_at && (
                  <span className="text-xs text-gray-400 ml-1">(edited)</span>
                )}
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 p-2 border rounded-lg resize-none"
                    rows={2}
                  />
                  <button
                    onClick={() => handleEditComment(comment.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="p-1 text-gray-500 hover:text-blue-600"
                  title="Reply"
                >
                  <Reply size={14} />
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={() => startEdit(comment)}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {isReplying && (
            <div className="mt-3 flex items-center gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 p-2 border rounded-lg resize-none"
                rows={2}
              />
              <button
                onClick={() => handleSubmitComment(comment.id)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Send size={16} />
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setNewComment('');
                }}
                className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {comment.replies && comment.replies.map(reply => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-4">Loading comments...</div>;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center mb-4">
        <MessageCircle className="mr-2" size={20} />
        <h3 className="text-lg font-semibold">Comments ({comments.length})</h3>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {!isPublic && (
        <div className="mb-4">
          <div className="flex items-start gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 p-3 border rounded-lg resize-none"
              rows={3}
            />
            <button
              onClick={() => handleSubmitComment()}
              className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} depth={0} />
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;