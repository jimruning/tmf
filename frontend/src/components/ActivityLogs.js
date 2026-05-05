import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Card, Form, Input, Select, DatePicker, Button, message, Descriptions } from 'antd';
import { SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import api from '../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ACTION_LABELS = {
  login: '登录',
  logout: '退出登录',
  upload: '上传文件',
  download: '下载文件',
  soft_delete: '标记删除文件',
  restore: '恢复文件',
  approve: '审核通过',
  reject: '审核退回',
  create_user: '创建用户',
  update_user: '更新用户',
  reset_password: '重置密码',
  create_project: '创建项目',
  update_project: '更新项目'
};

const TARGET_TYPE_LABELS = {
  file: '文件',
  user: '用户',
  project: '项目',
  folder: '文件夹'
};

const ActivityLogs = ({ embedded = false }) => {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (error) {
      console.error('获取用户列表失败');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.action) params.action = filters.action;
      if (filters.target_type) params.target_type = filters.target_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const res = await api.get('/logs', { params });
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (error) {
      message.error('获取日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (values) => {
    const newFilters = {};
    if (values.user_id) newFilters.user_id = values.user_id;
    if (values.action) newFilters.action = values.action;
    if (values.target_type) newFilters.target_type = values.target_type;
    if (values.dateRange) {
      newFilters.start_date = values.dateRange[0].format('YYYY-MM-DD');
      newFilters.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    setFilters(newFilters);
    
    setLoading(true);
    api.get('/logs', { params: newFilters }).then(res => {
      if (res.data.success) {
        setLogs(res.data.data);
      }
    }).catch(() => {
      message.error('获取日志失败');
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
    fetchLogs();
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_, record) => (
        <span>{record.real_name || record.username || '-'}</span>
      )
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action) => (
        <Tag color="blue">{ACTION_LABELS[action] || action}</Tag>
      )
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (type) => (
        <Tag>{TARGET_TYPE_LABELS[type] || type || '-'}</Tag>
      )
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140,
      render: (text) => text || '-'
    }
  ];

  const content = (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleFilter}>
          <Form.Item name="user_id" label="用户">
            <Select allowClear placeholder="选择用户" style={{ width: 150 }}>
              {users.map(u => (
                <Option key={u.id} value={u.id}>{u.real_name || u.username}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="action" label="操作类型">
            <Select allowClear placeholder="选择操作" style={{ width: 150 }}>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="target_type" label="目标类型">
            <Select allowClear placeholder="选择类型" style={{ width: 120 }}>
              {Object.entries(TARGET_TYPE_LABELS).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="dateRange" label="时间范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title={`操作日志 (${logs.length} 条)`}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条日志` }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </>
  );

  if (embedded) {
    return content;
  }

  return <Card title="系统日志">{content}</Card>;
};

export default ActivityLogs;
