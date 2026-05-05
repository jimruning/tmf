import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Select, message, Divider, Tag, Space } from 'antd';
import { SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../api';

const SystemSettings = ({ embedded = false }) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      if (res.data.success) {
        const settingsObj = {};
        res.data.data.forEach(s => {
          settingsObj[s.key] = s.value;
        });
        setSettings(settingsObj);
        form.setFieldsValue(settingsObj);
      }
    } catch (error) {
      console.error('获取设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      await api.post('/settings', values);
      message.success('设置保存成功');
      fetchSettings();
    } catch (error) {
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <Card
      title="系统设置"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchSettings}>刷新</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 800 }}>
        <Divider orientation="left">文件上传设置</Divider>
        <Form.Item
          name="max_file_size"
          label="最大文件大小 (MB)"
          tooltip="限制单个文件上传的最大大小"
        >
          <Input placeholder="默认 100 MB" />
        </Form.Item>
        <Form.Item
          name="allowed_extensions"
          label="允许的文件类型"
          tooltip="允许上传的文件扩展名，逗号分隔"
        >
          <Input placeholder="例: pdf,doc,docx,xls,xlsx,jpg,png" />
        </Form.Item>

        <Divider orientation="left">安全设置</Divider>
        <Form.Item
          name="session_timeout"
          label="会话超时时间 (分钟)"
          tooltip="用户无操作后自动退出的时间"
        >
          <Input placeholder="默认 30 分钟" type="number" />
        </Form.Item>
        <Form.Item
          name="password_min_length"
          label="密码最小长度"
          tooltip="用户密码的最小长度要求"
        >
          <Input placeholder="默认 6 位" type="number" />
        </Form.Item>
        <Form.Item
          name="max_login_attempts"
          label="最大登录尝试次数"
          tooltip="连续登录失败次数上限，超过后锁定账户"
        >
          <Input placeholder="默认 5 次" type="number" />
        </Form.Item>

        <Divider orientation="left">审计设置</Divider>
        <Form.Item
          name="log_retention_days"
          label="日志保留天数"
          tooltip="操作日志保留的天数，超过后将自动清理"
        >
          <Input placeholder="默认 365 天" type="number" />
        </Form.Item>
        <Form.Item
          name="require_delete_reason"
          label="删除文件必须填写原因"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Divider orientation="left">系统信息</Divider>
        <Form.Item label="系统版本">
          <Input value="TMF v1.0.0" disabled />
        </Form.Item>
        <Form.Item label="数据库状态">
          <Tag color="green">正常连接</Tag>
        </Form.Item>

        <Form.Item>
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
            保存设置
          </Button>
        </Form.Item>
      </Form>

      <Card style={{ marginTop: 24, background: '#f5f5f5' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span>提示：修改设置后即刻生效，无需重启服务</span>
        </Space>
      </Card>
    </Card>
  );

  if (embedded) {
    return content;
  }

  return <Card title="系统设置">{content}</Card>;
};

export default SystemSettings;
