// 请求级 Trace ID 中间件
const { generateTraceId } = require('../utils/validation-error.formatter');

module.exports = function traceId(req, res, next) {
  req.traceId = generateTraceId();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
};

