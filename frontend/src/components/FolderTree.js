import React, { useState, useEffect } from 'react';
import { Tree, Spin, message } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';
import api from '../api';

const FolderTree = ({ projectId, onSelect }) => {
  const [treeData, setTreeData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setTreeData([]);
      setLoading(false);
      return;
    }

    const fetchTree = async () => {
      setLoading(true);
      try {
        const res = await api.get('/folders/tree', { params: { project_id: projectId } });
        if (res.data.success) {
          const formatTree = (nodes) => {
            return nodes.map(node => {
              if (node.type === 'artifact') {
                return {
                  key: node.key,
                  title: node.title,
                  isLeaf: true,
                  folderId: node.folderId
                };
              }
              return {
                key: node.key,
                title: node.title,
                children: formatTree(node.children)
              };
            });
          };
          setTreeData(formatTree(res.data.data));
        }
      } catch (error) {
        message.error('获取文件夹失败');
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, [projectId]);

  const handleSelect = (selectedKeys, info) => {
    if (info.node.isLeaf && info.node.folderId) {
      onSelect({ id: info.node.folderId, title: info.node.title });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (treeData.length === 0 && !loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
        暂无文件夹
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', height: 'calc(100vh - 64px)', overflow: 'auto' }}>
      <Tree
        treeData={treeData}
        onSelect={handleSelect}
        showIcon
        defaultExpandAll={false}
        icon={(props) => {
          if (props.isLeaf) return <FileOutlined />;
          return <FolderOutlined />;
        }}
      />
    </div>
  );
};

export default FolderTree;
