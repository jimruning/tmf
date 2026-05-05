const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供认证令牌'
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '无效的认证令牌格式'
        }
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '认证令牌已过期'
        }
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: '无效的认证令牌'
      }
    });
  }
};

const adminRequired = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '需要管理员权限'
      }
    });
  }
  next();
};

module.exports = { authMiddleware, adminRequired };
