import React, { useState, useEffect } from 'react';
import { Layout, Avatar, Button, message, Space, Select, Empty, Tag, Menu } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  DashboardOutlined,
  TeamOutlined,
  FileOutlined,
  SettingOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import FolderTree from '../components/FolderTree';
import FileList from '../components/FileList';
import ProjectInitPage from '../components/ProjectInitPage';
import UserManagement from '../components/UserManagement';
import ActivityLogs from '../components/ActivityLogs';
import SystemSettings from '../components/SystemSettings';
import api from '../api';

const { Header, Sider, Content } = Layout;

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

const DashboardPage = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [refreshFiles, setRefreshFiles] = useState(false);
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [activeMenu, setActiveMenu] = useState('file');
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('currentProjectId', selectedProject.id);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      if (res.data.success) {
        setProjects(res.data.data);
        if (res.data.data.length > 0) {
          const savedId = localStorage.getItem('currentProjectId');
          const project = res.data.data.find(p => p.id == savedId) || res.data.data[0];
          setSelectedProject(project);
        }
      }
    } catch (error) {
      message.error('获取项目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentProjectId');
    message.success('已退出登录');
    window.location.href = '/login';
  };

  const handleProjectCreated = (project) => {
    setProjects(prev => [project, ...prev]);
    setSelectedProject(project);
    setSelectedFolder(null);
    message.success(`项目"${project.name}"创建成功，TMF 文件夹结构已自动生成`);
  };

  const handleProjectChange = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProject(project);
    setSelectedFolder(null);
  };

  // 管理员菜单
  const adminMenuItems = [
    { key: 'users', icon: <TeamOutlined />, label: '用户管理' },
    { key: 'logs', icon: <FileTextOutlined />, label: '系统日志' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' }
  ];

  const menuItems = [
    {
      key: 'file',
      icon: <FileOutlined />,
      label: '文件管理'
    },
    ...(user.role === 'admin' ? adminMenuItems : [])
  ];

  const renderContent = () => {
    switch (activeMenu) {
      case 'file':
        if (!selectedProject) {
          return user.role === 'admin' ? (
            <Empty
              description="暂无项目，请先创建一个项目"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setProjectModalVisible(true)}>
                创建第一个项目
              </Button>
            </Empty>
          ) : (
            <Empty
              description="暂无可用项目，请联系管理员创建"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          );
        }
        return selectedFolder ? (
          <FileList
            folderId={selectedFolder.id}
            folderName={selectedFolder.title}
            projectId={selectedProject.id}
            refresh={refreshFiles}
          />
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '100px 0',
            color: '#999',
            fontSize: '16px'
          }}>
            <FolderOpenOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>请从左侧选择一个文件夹</div>
          </div>
        );
      case 'users':
        return user.role === 'admin' ? <UserManagement embedded /> : null;
      case 'logs':
        return user.role === 'admin' ? <ActivityLogs embedded /> : null;
      case 'settings':
        return user.role === 'admin' ? <SystemSettings embedded /> : null;
      default:
        return null;
    }
  };

  if (loading) return null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 10
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>TMF 文档管理系统</div>
        <Space>
          <Select
            value={selectedProject?.id}
            onChange={handleProjectChange}
            style={{ width: 200 }}
            placeholder="选择项目"
          >
            {projects.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
            ))}
          </Select>
          {user.role === 'admin' && (
            <Button icon={<PlusOutlined />} onClick={() => setProjectModalVisible(true)}>
              新建项目
            </Button>
          )}
          <Tag color="blue">{ROLE_LABELS[user.role] || user.role}</Tag>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <span>{user.real_name || user.username}</span>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', height: 'calc(100vh - 64px)' }}>
          <Menu
            mode="inline"
            selectedKeys={[activeMenu]}
            items={menuItems}
            onClick={({ key }) => {
              setActiveMenu(key);
              if (key === 'file') setSelectedFolder(null);
            }}
            style={{ borderRight: 0, marginTop: 8 }}
          />
          {activeMenu === 'file' && selectedProject && (
            <div style={{ borderTop: '1px solid #f0f0f0', height: 'calc(100% - 48px)', overflow: 'auto' }}>
              <FolderTree projectId={selectedProject.id} onSelect={setSelectedFolder} />
            </div>
          )}
        </Sider>
        <Content style={{ padding: '24px', background: '#f5f5f5', height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          {renderContent()}
        </Content>
      </Layout>
      <ProjectInitPage
        visible={projectModalVisible}
        onClose={() => setProjectModalVisible(false)}
        onSuccess={handleProjectCreated}
      />
    </Layout>
  );
};

export default DashboardPage;
