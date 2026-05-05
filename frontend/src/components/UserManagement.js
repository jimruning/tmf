import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space, Tag, Tooltip, Card } from 'antd';
import { PlusOutlined, EditOutlined, KeyOutlined, CheckCircleOutlined, CloseCircleOutlined, UnlockOutlined } from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const ROLE_OPTIONS = [
  { value: 'admin', label: '系统管理员' },
  { value: 'pi', label: '主要研究者 (PI)' },
  { value: 'sub_i', label: '助理研究者 (Sub-I)' },
  { value: 'crc', label: '临床协调员 (CRC)' },
  { value: 'cra', label: '临床监查员 (CRA)' },
  { value: 'dm', label: '数据管理员 (DM)' },
  { value: 'pm', label: '项目经理 (PM)' },
  { value: 'qa', label: '质量保证 (QA)' },
  { value: 'user', label: '普通用户' }
];

const ROLE_LABELS = {
  admin: '系统管理员',
  pi: '主要研究者 (PI)',
  sub_i: '助理研究者 (Sub-I)',
  crc: '临床协调员 (CRC)',
  cra: '临床监查员 (CRA)',
  dm: '数据管理员 (DM)',
  pm: '项目经理 (PM)',
  qa: '质量保证 (QA)',
  user: '普通用户'
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'sponsor', label: '申办方' },
  { value: 'cro', label: 'CRO' },
  { value: 'site', label: '研究中心' },
  { value: 'vendor', label: '第三方供应商' },
  { value: 'internal', label: '内部员工' }
];

const ACCOUNT_TYPE_LABELS = {
  sponsor: '申办方',
  cro: 'CRO',
  site: '研究中心',
  vendor: '第三方供应商',
  internal: '内部员工'
};

const UserManagement = ({ visible, onClose, embedded = false }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPwdModal, setResetPwdModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    if (visible || embedded) {
      fetchUsers();
    }
  }, [visible, embedded]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, values);
        message.success('用户更新成功');
      } else {
        await api.post('/users', values);
        message.success('用户创建成功');
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error(error.response?.data?.error?.message || '操作失败');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: user.is_active ? 0 : 1 });
      message.success(user.is_active ? '用户已失活' : '用户已激活');
      fetchUsers();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleResetPassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      await api.post(`/users/${selectedUser.id}/reset-password`, { newPassword: values.newPassword });
      message.success('密码初始化成功');
      setResetPwdModal(false);
      pwdForm.resetFields();
    } catch (error) {
      message.error('密码初始化失败');
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalVisible(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '姓名', dataIndex: 'real_name', key: 'real_name', width: 100 },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (role) => <Tag color="blue">{ROLE_LABELS[role] || role}</Tag>
    },
    {
      title: '账号类型',
      dataIndex: 'account_type',
      key: 'account_type',
      width: 120,
      render: (type) => <Tag color="orange">{ACCOUNT_TYPE_LABELS[type] || type}</Tag>
    },
    { title: '职称', dataIndex: 'title', key: 'title', width: 120 },
    { title: '所属机构', dataIndex: 'organization', key: 'organization', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '激活' : '失活'}</Tag>
    },
    { title: '最后登录', dataIndex: 'last_login', key: 'last_login', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Tooltip title="编辑用户信息">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="初始化密码">
            <Button size="small" icon={<KeyOutlined />} onClick={() => { setSelectedUser(record); setResetPwdModal(true); }} />
          </Tooltip>
          {record.username !== 'admin' && (
            <Tooltip title={record.is_active ? '失活用户' : '激活用户'}>
              <Popconfirm
                title={`确认${record.is_active ? '失活' : '激活'}此用户？`}
                onConfirm={() => handleToggleActive(record)}
              >
                <Button
                  size="small"
                  icon={record.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                  type={record.is_active ? 'default' : 'primary'}
                  danger={record.is_active}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const userTableContent = (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建用户</Button>
        <div style={{ color: '#999', fontSize: 12 }}>
          提示：点击"激活/失活"按钮可切换用户登录状态，点击"初始化密码"可重置用户密码
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 个用户` }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '创建用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="realName" label="真实姓名">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select>
              {ROLE_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="accountType" label="账号类型" rules={[{ required: true, message: '请选择账号类型' }]}>
            <Select>
              {ACCOUNT_TYPE_OPTIONS.map(opt => (
                <Option key={opt.value} value={opt.value}>{opt.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="职称">
            <Input />
          </Form.Item>
          <Form.Item name="organization" label="所属机构">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`初始化密码 - ${selectedUser?.username}`}
        open={resetPwdModal}
        onCancel={() => setResetPwdModal(false)}
        onOk={handleResetPassword}
        okText="初始化"
        cancelText="取消"
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          请为用户 <strong>{selectedUser?.username}</strong> ({ROLE_LABELS[selectedUser?.role] || selectedUser?.role}) 设置新密码：
        </p>
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  if (embedded) {
    return <Card title="用户管理" style={{ margin: 0 }}>{userTableContent}</Card>;
  }

  return (
    <Modal title="用户管理" open={visible} onCancel={onClose} footer={null} width={1400}>
      {userTableContent}
    </Modal>
  );
};

export default UserManagement;
