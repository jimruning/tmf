import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, message, Modal } from 'antd';
import { ProjectOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../api';

const { TextArea } = Input;

const ProjectInitPage = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await api.post('/projects/init', values);
      if (res.data.success) {
        message.success('项目创建成功，TMF 文件夹结构已自动生成');
        form.resetFields();
        if (onSuccess) onSuccess(res.data.data);
        if (onClose) onClose();
      }
    } catch (error) {
      message.error(error.response?.data?.error?.message || '创建项目失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={<><ProjectOutlined /> 初始化新项目</>}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ marginTop: 24 }}
      >
        <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
          <Input placeholder="例如：XXX 药物 III 期临床试验" />
        </Form.Item>
        <Form.Item name="nameEn" label="项目名称（英文）">
          <Input placeholder="e.g. Phase III Clinical Trial of XXX" />
        </Form.Item>
        <Form.Item name="protocolNumber" label="方案编号">
          <Input placeholder="例如：PROT-2024-001" />
        </Form.Item>
        <Form.Item name="sponsor" label="申办方">
          <Input placeholder="申办方名称" />
        </Form.Item>
        <Form.Item name="phase" label="试验阶段">
          <Select placeholder="请选择试验阶段" allowClear>
            <Select.Option value="I">I 期</Select.Option>
            <Select.Option value="II">II 期</Select.Option>
            <Select.Option value="III">III 期</Select.Option>
            <Select.Option value="IV">IV 期</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="therapeuticArea" label="治疗领域">
          <Input placeholder="例如：肿瘤学、心血管" />
        </Form.Item>
        <Form.Item name="principalInvestigator" label="主要研究者（PI）">
          <Input placeholder="PI 姓名" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            <ProjectOutlined /> 创建项目并生成 TMF 结构
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectInitPage;
