const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

router.get('/tree', authMiddleware, (req, res) => {
  try {
    const { project_id } = req.query;
    
    let query = 'SELECT * FROM folders WHERE is_active = 1';
    const params = [];
    
    if (project_id) {
      query += ' AND project_id = ?';
      params.push(parseInt(project_id));
    } else {
      query += ' AND project_id IS NULL';
    }
    
    query += ' ORDER BY zone, section, artifact';
    
    const folders = db.prepare(query).all(...params);

    const tree = [];
    const zoneMap = new Map();
    const sectionMap = new Map();

    folders.forEach(folder => {
      if (!zoneMap.has(folder.zone)) {
        const title = folder.zone_cn ? `${folder.zone_cn} / ${folder.zone_en}` : folder.zone_en;
        const zoneNode = {
          key: `zone-${folder.zone}`,
          title,
          type: 'zone',
          children: [],
          zoneCn: folder.zone_cn,
          zoneEn: folder.zone_en
        };
        zoneMap.set(folder.zone, zoneNode);
        tree.push(zoneNode);
      }

      const sectionKey = `${folder.zone}-${folder.section}`;
      if (!sectionMap.has(sectionKey)) {
        const title = folder.section_cn ? `${folder.section_cn} / ${folder.section_en}` : folder.section_en;
        const sectionNode = {
          key: `section-${sectionKey}`,
          title,
          type: 'section',
          children: [],
          sectionCn: folder.section_cn,
          sectionEn: folder.section_en
        };
        sectionMap.set(sectionKey, sectionNode);
        zoneMap.get(folder.zone).children.push(sectionNode);
      }

      const artifactTitle = folder.artifact_cn ? `${folder.artifact_cn} / ${folder.artifact_en}` : folder.artifact_en;
      sectionMap.get(sectionKey).children.push({
        key: `artifact-${folder.id}`,
        title: artifactTitle,
        type: 'artifact',
        id: folder.id,
        folderId: folder.id,
        artifactCn: folder.artifact_cn,
        artifactEn: folder.artifact_en
      });
    });

    res.json({ success: true, data: tree });
  } catch (error) {
    console.error('Get folder tree error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取文件夹树失败' }
    });
  }
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(req.params.id);
    if (!folder) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '文件夹不存在' }
      });
    }
    res.json({ success: true, data: folder });
  } catch (error) {
    console.error('Get folder error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '获取文件夹失败' }
    });
  }
});

module.exports = router;
