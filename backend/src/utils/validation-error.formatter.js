/**
 * 统一验证错误格式化工具
 * 输出标准结构: { field, code, message, hint, value }
 */
const crypto = require('crypto');

const SENSITIVE_FIELDS = [
  'password', 'newPassword', 'oldPassword', 'confirmPassword',
  'token', 'authorization', 'auth', 'secret'
];

const JOI_TYPE_CODE_MAP = {
  'any.required': 'FIELD_REQUIRED',
  'string.base': 'TYPE_STRING_REQUIRED',
  'string.min': 'STRING_TOO_SHORT',
  'string.max': 'STRING_TOO_LONG',
  'string.email': 'EMAIL_INVALID',
  'string.pattern.base': 'PATTERN_NOT_MATCH',
  'string.uri': 'URL_INVALID',
  'number.base': 'TYPE_NUMBER_REQUIRED',
  'number.min': 'NUMBER_TOO_SMALL',
  'number.max': 'NUMBER_TOO_LARGE',
  'number.positive': 'NUMBER_NOT_POSITIVE',
  'date.base': 'DATE_INVALID',
  'date.min': 'DATE_TOO_EARLY',
  'date.max': 'DATE_TOO_LATE',
  'array.min': 'ARRAY_MIN_ITEMS',
  'any.only': 'VALUE_NOT_IN_ALLOWED_SET',
  'alternatives.match': 'ALTERNATIVE_NOT_MATCHED'
};

const CODE_HINT_MAP = {
  FIELD_REQUIRED: '请填写此字段',
  STRING_TOO_SHORT: '请输入更长的内容',
  STRING_TOO_LONG: '内容过长，请精简',
  EMAIL_INVALID: '请输入有效邮箱，例如 user@example.com',
  URL_INVALID: '请输入以 http:// 或 https:// 开头的地址',
  PATTERN_NOT_MATCH: '格式不符合要求',
  VALUE_NOT_IN_ALLOWED_SET: '请选择列表中的有效值',
  NUMBER_TOO_SMALL: '数值过小',
  NUMBER_TOO_LARGE: '数值过大',
  ARRAY_MIN_ITEMS: '请至少添加一项',
  DATE_TOO_EARLY: '日期太早',
  DATE_TOO_LATE: '日期过晚'
};

function sanitizeValue(field, value) {
  if (value === undefined || value === null) return value;
  const lower = String(field).toLowerCase();
  if (SENSITIVE_FIELDS.some(f => lower.includes(f))) return '[REDACTED]';
  if (typeof value === 'string' && value.length > 200) return value.slice(0,200) + '…';
  return value;
}

function mapJoiDetail(detail) {
  const type = detail.type;
  const code = JOI_TYPE_CODE_MAP[type] || 'UNKNOWN_VALIDATION_ERROR';
  const field = detail.path?.join('.') || detail.context?.key || 'unknown';
  return {
    field,
    code,
    message: detail.message,
    hint: CODE_HINT_MAP[code] || undefined,
    value: sanitizeValue(field, detail.context?.value)
  };
}

function formatJoiErrors(details = []) { return details.map(mapJoiDetail); }

function ensureStandardErrors(errors = []) {
  return errors.map(err => {
    const field = err.field || 'unknown';
    let code = err.code;
    if (!code) {
      if (/必填|required/i.test(err.message)) code = 'FIELD_REQUIRED';
      else if (/长度|short|min/i.test(err.message)) code = 'STRING_TOO_SHORT';
      else if (/超过|long|max/i.test(err.message)) code = 'STRING_TOO_LONG';
      else if (/邮箱|email/i.test(err.message)) code = 'EMAIL_INVALID';
      else if (/url/i.test(err.message)) code = 'URL_INVALID';
      else code = 'UNKNOWN_VALIDATION_ERROR';
    }
    return {
      field,
      code,
      message: err.message,
      hint: CODE_HINT_MAP[code] || undefined,
      value: sanitizeValue(field, err.value)
    };
  });
}

function generateTraceId() { return crypto.randomUUID(); }

module.exports = { formatJoiErrors, ensureStandardErrors, generateTraceId };

