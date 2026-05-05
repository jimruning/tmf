import React, { useState, useEffect } from 'react';
import { Layout, Menu, Card, Statistic, Row, Col, Table, Tag, Button, message } from 'antd';
import { UserOutlined, FolderOutlined, FileOutlined, ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import UserManagement from '../components/UserManagement';
import api from '../api';

const { Sider, Content } = Layout;

const AdminPanel = () => {
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [stats, setStats] = useState({ users: 0, projects: 0, files: 0, folders: 0, pendingReviews: 0, recentUploads: 0 });
  const [recentFiles, setRecentFiles] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      message.error('权限不足');
      navigate('/');
      return;
    }
    fetchStats();
    fetchRecentData();
  }, [currentUser.role, navigate]);

  const fetchStats = async () => {
    try {
      const [usersRes, projectsRes] = await Promise.all([
        api.get('/users'),
        api.get('/projects')
      ]);

      if (usersRes.data.success && projectsRes.data.success) {
        setStats({
          users: usersRes.data.data.length,
          projects: projectsRes.data.data.length,
          files: 0,
          folders: 0,
          pendingReviews: 0,
          recentUploads: 0
        });
      }
    } catch (error) {
      console.error('获取统计数据失败', error);
    }
  };

  const fetchRecentData = async () => {
    try {
      const [filesRes, usersRes] = await Promise.all([
        api.get('/files'),
        api.get('/users')
      ]);

      if (filesRes.data.success) {
        setRecentFiles(filesRes.data.data.slice(0, 5));
      }
      if (usersRes.data.success) {
        setRecentUsers(usersRes.data.data.slice(0, 5));
      }
    } catch (error) {
      console.error('获取最近数据失败', error);
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <ProjectOutlined />, label: '仪表盘' },
    { key: 'users', icon: <UserOutlined />, label: '用户管理' },
  ];

  const menuClick = ({ key }) => {
    if (key === 'users') {
      setUserModalVisible(true);
    } else {
      setSelectedMenu(key);
    }
  };

  const roleLabels = {
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

  const fileColumns = [
    { title: '文件名', dataIndex: 'original_name', key: 'original_name', ellipsis: true },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '上传者', dataIndex: 'uploader_name', key: 'uploader_name', width: 100 },
    { title: '上传时间', dataIndex: 'uploaded_at', key: 'uploaded_at', width: 180 },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      render: (status) => (
        <Tag color={status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default'}>
          {status === 'approved' ? '已通过' : status === 'rejected' ? '已退回' : '待审核'}
        </Tag>
      )
    }
  ];

  const userColumns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'real_name', key: 'real_name' },
    { 
      title: '角色', 
      dataIndex: 'role', 
      key: 'role', 
      render: (role) => <Tag color="blue">{roleLabels[role] || role}</Tag> 
    },
    { 
      title: '状态', 
      dataIndex: 'is_active', 
      key: 'is_active', 
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? '激活' : '失活'}</Tag> 
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Sider width={200} style={{ background: '#fff' }}>
        <div style={{ padding: '24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0 }}>管理面板</h3>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedMenu]}
          items={menuItems}
          onClick={menuClick}
          style={{ borderRight: 0 }}
        />
        <div style={{ padding: 16 }}>
          <Button type="primary" block onClick={() => navigate('/')}>
            返回主页
          </Button>
        </div>
      </Sider>
      <Content style={{ padding: 24 }}>
        {selectedMenu === 'dashboard' && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card>
                  <Statistic title="用户总数" value={stats.users} prefix={<UserOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="项目总数" value={stats.projects} prefix={<ProjectOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="待审核文件" value={stats.pendingReviews} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="最近上传" value={stats.recentUploads} prefix={<FileOutlined />} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="最近上传文件" extra={<Button type="link" onClick={() => navigate('/')}>查看全部</Button>}>
                  <Table 
                    columns={fileColumns} 
                    dataSource={recentFiles} 
                    rowKey="id" 
                    pagination={false} 
                    size="small"
                    locale={{ emptyText: '暂无文件' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="最近活跃用户" extra={<Button type="link" onClick={() => setUserModalVisible(true)}>管理用户</Button>}>
                  <Table 
                    columns={userColumns} 
                    dataSource={recentUsers} 
                    rowKey="id" 
                    pagination={false} 
                    size="small"
                    locale={{ emptyText: '暂无用户' }}
                  />
                </Card>
              </Col>
            </Row>
          </>
        )}

        <UserManagement
          visible={userModalVisible}
          onClose={() => setUserModalVisible(false)}
        />
      </Content>
    </Layout>
  );
};

export default AdminPanel;
