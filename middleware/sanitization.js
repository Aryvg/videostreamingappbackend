// Centralized sanitization and validation middleware for reuse
const { body, validationResult } = require('express-validator');

// Employees sanitization
const employeeSanitization = [
    body('firstname').trim().escape(),
    body('lastname').trim().escape(),
    body('job').trim().escape(),
    body('address').trim().escape(),
    body('comments').optional().customSanitizer(value => {
        if (!value) return value;
        let arr = value;
        if (typeof value === 'string') {
            try { arr = JSON.parse(value); } catch (e) { arr = [value]; }
        }
        if (!Array.isArray(arr)) return arr;
        return arr.map(v => typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v);
    }),
    body('skills').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    })
];

// UploadIntoMainPage sanitization
const uploadIntoMainPageSanitization = [
    body('title').trim().escape(),
    body('shortDescription').trim().escape(),
    body('fullDescription').trim().escape()
];

// Practice sanitization (for practiceController2 and practiceController)
const practiceSanitization = [
    body('name').optional().trim().escape(),
    body('email').optional().trim().escape(),
    body('job').optional().trim().escape(),
    body('practiceInfo').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    }),
    body('userInfo').optional().customSanitizer(value => {
        if (!value) return value;
        let obj = value;
        if (typeof value === 'string') {
            try { obj = JSON.parse(value); } catch (e) { return value; }
        }
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return obj;
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const v = obj[key];
                sanitized[key] = typeof v === 'string' ? v.replace(/[<>&"'/]/g, s => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&#39;', '/': '&#x2F;' }[s])) : v;
            }
        }
        return sanitized;
    })
];

// Centralized validation error handler
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

module.exports = {
    employeeSanitization,
    uploadIntoMainPageSanitization,
    practiceSanitization,
    handleValidationErrors
};
