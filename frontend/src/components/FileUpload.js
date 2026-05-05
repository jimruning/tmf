import React, { useState } from 'react';
import { Upload, Button, message } from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../api';

const { Dragger } = Upload;

const FileUpload = ({ folderId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);

  const uploadProps = {
    name: 'file',
    multiple: false,
    beforeUpload: (file) => {
      if (file.size > 100 * 1024 * 1024) {
        message.error('文件大小不能超过100MB');
        return false;
      }
      return true;
    },
    customRequest: async ({ file, onSuccess: uploadSuccess, onError }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_id', folderId);

      setUploading(true);
      try {
        const res = await api.post('/files/upload', formData);
        if (res.data.success) {
          message.success(`${file.name} 上传成功`);
          uploadSuccess(res.data);
          if (onSuccess) onSuccess();
        }
      } catch (error) {
        message.error(error.response?.data?.error?.message || '上传失败');
        onError(error);
      } finally {
        setUploading(false);
      }
    },
  };

  return (
    <Dragger {...uploadProps} disabled={!folderId || uploading}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
      <p className="ant-upload-hint">支持单个文件，最大100MB</p>
    </Dragger>
  );
};

export default FileUpload;
