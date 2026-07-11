const nodemailer = require('nodemailer');
const dns = require('dns');

// Render doesn't route outbound IPv6 to Gmail properly — force IPv4 lookups
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4, // extra safety net: force IPv4 for this connection specifically
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports = transporter;
