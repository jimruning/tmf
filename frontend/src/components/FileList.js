import React, { useState, useEffect } from 'react';
import { Table, Button, Popconfirm, message, Tag, Space, Tooltip, Modal, Input } from 'antd';
import { DownloadOutlined, StopOutlined, CheckOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import api from '../api';

const STATUS_MAP = {
  uploaded: { color: 'default', text: '已上传' },
  approved: { color: 'success', text: '已审核' },
  rejected: { color: 'error', text: '已退回' },
  invalid: { color: 'default', text: '已标注无效' }
};

// 角色可上传区域映射（与后端 roles.js 保持一致）
const ROLE_UPLOAD_ZONES = {
  admin: '所有区域',
  pi: 'Zone 1/2/4/7/8',
  sub_i: 'Zone 4/8',
  crc: 'Zone 4/5/7/8',
  cra: 'Zone 1/6/7/10',
  dm: 'Zone 3/5/9',
  pm: 'Zone 1/2/10/11',
  qa: 'Zone 2/10/11',
  user: 'Zone 4/7/8'
};

const FileList = ({ folderId, folderName, projectId, refresh, currentZone }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invalidModalVisible, setInvalidModalVisible] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [invalidReason, setInvalidReason] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const canMarkInvalid = ['admin', 'pi', 'pm', 'cra', 'crc', 'dm', 'sub_i'].includes(currentUser.role);
  const canReview = ['admin', 'pi', 'pm'].includes(currentUser.role);
  const canUpload = ['admin', 'pi', 'cra', 'crc', 'dm', 'pm', 'sub_i'].includes(currentUser.role);

  useEffect(() => {
    fetchFiles();
  }, [folderId, refresh]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/files', { params: { folder_id: folderId } });
      if (res.data.success) {
        setFiles(res.data.data);
      }
    } catch (error) {
      message.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id) => {
    window.open(`/api/files/${id}/download`, '_blank');
  };

  const handleMarkInvalid = async () => {
    try {
      const res = await api.put(`/files/${selectedFileId}/invalidate`, { reason: invalidReason });
      if (res.data.success) {
        message.success('文件已标注为无效（文件永久保留）');
        setInvalidModalVisible(false);
        setInvalidReason('');
        fetchFiles();
      }
    } catch (error) {
      message.error(error.response?.data?.error?.message || '操作失败');
    }
  };

  const openInvalidModal = (id) => {
    setSelectedFileId(id);
    setInvalidReason('');
    setInvalidModalVisible(true);
  };

  const handleReview = async (id, approved) => {
    try {
      const res = await api.post(`/files/${id}/review`, { approved });
      if (res.data.success) {
        message.success(approved ? '文件审核通过' : '文件已退回');
        fetchFiles();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'original_name',
      key: 'original_name',
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const s = STATUS_MAP[status] || STATUS_MAP.uploaded;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => size ? `${(size / 1024).toFixed(1)} KB` : '-',
    },
    {
      title: '上传时间',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      width: 180,
    },
    {
      title: '上传者',
      dataIndex: 'uploader_real_name',
      key: 'uploader_real_name',
      width: 120,
      render: (name, record) => name || record.uploader_name,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id)}
          />
          {canReview && record.status !== 'approved' && record.status !== 'invalid' && (
            <>
              <Popconfirm title="确认审核通过？" onConfirm={() => handleReview(record.id, true)}>
                <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }} />
              </Popconfirm>
              <Popconfirm title="确认退回此文件？" onConfirm={() => handleReview(record.id, false)}>
                <Button type="link" size="small" icon={<CloseOutlined />} style={{ color: '#ff4d4f' }} />
              </Popconfirm>
            </>
          )}
          {canMarkInvalid && record.status !== 'invalid' && (
            <Popconfirm
              title="确认标注此文件为无效？（文件将永久保留在系统中）"
              onConfirm={() => openInvalidModal(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {canUpload && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <FileUpload folderId={folderId} onSuccess={fetchFiles} />
            <Tooltip title={`您的角色 (${currentUser.role}) 可上传区域：${ROLE_UPLOAD_ZONES[currentUser.role] || '无权限'}`}>
              <InfoCircleOutlined style={{ marginLeft: 8, color: '#999', cursor: 'help' }} />
            </Tooltip>
          </div>
        </div>
      )}
      <Table
        columns={columns}
        dataSource={files}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无文件' }}
      />

      <Modal
        title="标注文件为无效"
        open={invalidModalVisible}
        onOk={handleMarkInvalid}
        onCancel={() => setInvalidModalVisible(false)}
        okText="确认标注"
        cancelText="取消"
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          标注为无效后，文件将<strong>永久保留</strong>在系统中，但不再作为有效文档使用。
        </p>
        <Input.TextArea
          rows={4}
          placeholder="请输入标注无效的原因（必填）"
          value={invalidReason}
          onChange={(e) => setInvalidReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default FileList;
