import React, { useState, useEffect, useRef } from 'react';
import { useCommon } from '../contexts/CommonContext';

const FileManager = ({ taskId, isOpen, onClose, onFileChange }) => {
  const {
    uploadFileToTask,
    getTaskFiles,
    downloadFile,
    deleteFile,
    updateFileName,
    shareFileWithTaskUsers,
    canUploadFiles,
    showGoogleAuthModal,
    handleGoogleAuth,
    toast,
  } = useCommon();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const fileInputRef = useRef(null);

  // Load files when modal opens
  useEffect(() => {
    if (isOpen && taskId) {
      loadFiles();
    }
  }, [isOpen, taskId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await getTaskFiles(taskId);
      if (result.success) {
        setFiles(result.data);
        // Notify parent component about file changes
        onFileChange && onFileChange();
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    if (!canUploadFiles()) {
      toast.error('Cần xác thực Google Drive trước khi upload file');
      return;
    }

    setUploading(true);
    const uploadPromises = selectedFiles.map(async (file) => {
      try {
        const result = await uploadFileToTask(taskId, file);
        if (result.success) {
          return result.data;
        }
        // Nếu cần xác thực lại, dừng tất cả các upload
        if (result.needReauth) {
          throw new Error('need_reauth');
        }
        return null;
      } catch (error) {
        if (error.message === 'need_reauth') {
          throw error; // Re-throw để dừng tất cả các upload
        }
        console.error('Error uploading file:', file.name, error);
        toast.error(`Lỗi upload file ${file.name}`);
        return null;
      }
    });

    try {
      const uploadResults = await Promise.all(uploadPromises);
      const successfulUploads = uploadResults.filter(
        (result) => result !== null
      );

      if (successfulUploads.length > 0) {
        await loadFiles(); // This will trigger onFileChange
      }
    } catch (error) {
      if (error.message === 'need_reauth') {
        // Token đã hết hạn và đang chuyển hướng đến trang xác thực
        // Không cần hiển thị thông báo lỗi vì đã có toast ở uploadFileToTask
        return;
      }
      console.error('Error in batch upload:', error);
      toast.error('Có lỗi xảy ra khi upload files');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (file) => {
    try {
      await downloadFile(file._id, file.name);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa file này?')) return;

    try {
      const result = await deleteFile(fileId);
      if (result.success) {
        await loadFiles(); // This will trigger onFileChange
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleRename = async (fileId) => {
    if (!newFileName.trim()) {
      toast.error('Tên file không được để trống');
      return;
    }

    try {
      const result = await updateFileName(fileId, newFileName);
      if (result.success) {
        setEditingFileId(null);
        setNewFileName('');
        await loadFiles(); // This will trigger onFileChange
      }
    } catch (error) {
      console.error('Error renaming file:', error);
    }
  };

  const handleShare = async (fileId) => {
    try {
      const result = await shareFileWithTaskUsers(fileId, taskId);
      if (result.success) {
        // toast.success('Đã chia sẻ file với các thành viên trong task');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
    }
  };

  const startEditing = (file) => {
    setEditingFileId(file._id);
    setNewFileName(file.name);
  };

  const cancelEditing = () => {
    setEditingFileId(null);
    setNewFileName('');
  };

  const getFileIcon = (type) => {
    switch (type) {
      case 'image':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'doc':
        return '📝';
      default:
        return '📁';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openGoogleAuth = () => {
    handleGoogleAuth();
  };

  if (!isOpen) return null;

  return (
    <div className='file-manager-overlay'>
      <div className='file-manager-modal'>
        <div className='file-manager-header'>
          <h3>Quản lý tệp đính kèm</h3>
          <button className='close-btn' onClick={onClose}>
            <i className='fas fa-times'></i>
          </button>
        </div>

        <div className='file-manager-body'>
          {/* Upload section */}
          <div className='upload-section'>
            {canUploadFiles() ? (
              <div>
                <input
                  ref={fileInputRef}
                  type='file'
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id='file-upload'
                />
                <label htmlFor='file-upload' className='upload-btn'>
                  <i className='fas fa-upload'></i>
                  {uploading ? 'Đang upload...' : 'Chọn file để upload'}
                </label>
                {uploading && (
                  <div className='upload-progress'>Đang upload file...</div>
                )}
              </div>
            ) : (
              <div className='google-auth-required'>
                <p>Cần xác thực Google Drive để upload file</p>
                <button className='auth-btn' onClick={openGoogleAuth}>
                  <i className='fab fa-google-drive'></i>
                  Xác thực Google Drive
                </button>
              </div>
            )}
          </div>

          {/* Files list */}
          <div className='files-list'>
            {loading ? (
              <div className='loading'>Đang tải danh sách file...</div>
            ) : files.length === 0 ? (
              <div className='no-files'>Chưa có file nào được upload</div>
            ) : (
              <div className='files-grid'>
                {files.map((file) => (
                  <div key={file._id} className='file-item'>
                    <div className='file-icon'>{getFileIcon(file.type)}</div>

                    <div className='file-info'>
                      {editingFileId === file._id ? (
                        <div className='file-rename'>
                          <input
                            type='text'
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRename(file._id);
                              } else if (e.key === 'Escape') {
                                cancelEditing();
                              }
                            }}
                            autoFocus
                          />
                          <div className='rename-actions'>
                            <button
                              className='save-btn'
                              onClick={() => handleRename(file._id)}
                            >
                              <i className='fas fa-check'></i>
                            </button>
                            <button
                              className='cancel-btn'
                              onClick={cancelEditing}
                            >
                              <i className='fas fa-times'></i>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className='file-name' title={file.name}>
                          {file.name}
                        </div>
                      )}

                      <div className='file-meta'>
                        <span className='file-size'>
                          {formatFileSize(file.size)}
                        </span>
                        <span className='file-type'>{file.type}</span>
                      </div>
                    </div>

                    <div className='file-actions'>
                      <button
                        className='action-btn download-btn'
                        onClick={() => handleDownload(file)}
                        title='Tải xuống'
                      >
                        <i className='fas fa-download'></i>
                      </button>

                      <button
                        className='action-btn view-btn'
                        onClick={() => window.open(file.url, '_blank')}
                        title='Xem trên Google Drive'
                      >
                        <i className='fas fa-external-link-alt'></i>
                      </button>

                      {/* <button
                        className='action-btn share-btn'
                        onClick={() => handleShare(file._id)}
                        title='Chia sẻ với thành viên task'
                      >
                        <i className='fas fa-share'></i>
                      </button> */}

                      <button
                        className='action-btn rename-btn'
                        onClick={() => startEditing(file)}
                        title='Đổi tên'
                      >
                        <i className='fas fa-edit'></i>
                      </button>

                      <button
                        className='action-btn delete-btn'
                        onClick={() => handleDelete(file._id)}
                        title='Xóa'
                      >
                        <i className='fas fa-trash'></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileManager;
