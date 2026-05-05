const express = require('express');
const router = express.Router();
const { authMiddleware, adminRequired } = require('../middleware/auth');
const db = require('../config/database');

// 创建项目（仅管理员）
router.post('/init', authMiddleware, adminRequired, (req, res) => {
  try {
    const { name, nameEn, sponsor, protocolNumber, phase, therapeuticArea, principalInvestigator } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '项目名称不能为空' }
      });
    }

    const result = db.transaction(() => {
      // 创建项目
      const projectResult = db.prepare(
        'INSERT INTO projects (name, name_en, sponsor, protocol_number, phase, therapeutic_area, principal_investigator, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(name, nameEn || null, sponsor || null, protocolNumber || null, phase || null, therapeuticArea || null, principalInvestigator || null, req.user.id);

      const projectId = projectResult.lastInsertRowid;

      // 从模板复制 TMF 文件夹结构到该项目
      const templateFolders = db.prepare('SELECT * FROM folders WHERE project_id IS NULL AND is_active = 1').all();
      
      const insertFolder = db.prepare(
        'INSERT INTO folders (project_id, zone, zone_cn, zone_en, section, section_cn, section_en, artifact, artifact_cn, artifact_en, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );

      const insertMany = db.transaction((folders) => {
        for (const folder of folders) {
          insertFolder.run(
            projectId,
            folder.zone, folder.zone_cn, folder.zone_en,
            folder.section, folder.section_cn, folder.section_en,
            folder.artifact, folder.artifact_cn, folder.artifact_en,
            folder.level
          );
        }
      });

      const foldersToInsert = templateFolders.map(f => ({
        zone: f.zone, zone_cn: f.zone_cn, zone_en: f.zone_en,
        section: f.section, section_cn: f.section_cn, section_en: f.section_en,
        artifact: f.artifact, artifact_cn: f.artifact_cn, artifact_en: f.artifact_en,
        level: f.level
      }));

      if (foldersToInsert.length > 0) {
        insertMany(foldersToInsert);
      }

      // 记录操作日志
      db.prepare(
        'INSERT INTO activity_logs (user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
      ).run(req.user.id, 'create_project', 'project', projectId, `创建项目: ${name}`);

      return projectId;
    })();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result);

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '创建项目失败' }
    });
  }
});

router.get('/', authMiddleware, (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取项目列表失败' }
    });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(parseInt(req.params.id));
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '项目不存在' }
      });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取项目失败' }
    });
  }
});

// 更新项目（仅管理员）
router.put('/:id', authMiddleware, adminRequired, (req, res) => {
  try {
    const { name, nameEn, sponsor, protocolNumber, phase, therapeuticArea, principalInvestigator, status } = req.body;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(parseInt(req.params.id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '项目不存在' }
      });
    }

    db.prepare(
      'UPDATE projects SET name=?, name_en=?, sponsor=?, protocol_number=?, phase=?, therapeutic_area=?, principal_investigator=?, status=? WHERE id=?'
    ).run(name || existing.name, nameEn ?? existing.name_en, sponsor ?? existing.sponsor, protocolNumber ?? existing.protocol_number, phase ?? existing.phase, therapeuticArea ?? existing.therapeutic_area, principalInvestigator ?? existing.principal_investigator, status || existing.status, parseInt(req.params.id));

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(parseInt(req.params.id));
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '更新项目失败' }
    });
  }
});

// 删除项目（仅管理员）
router.delete('/:id', authMiddleware, adminRequired, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(parseInt(req.params.id));
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '项目不存在' }
      });
    }
    res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '删除项目失败' }
    });
  }
});

module.exports = router;
