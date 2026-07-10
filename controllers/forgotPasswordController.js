const User = require('../model/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const transporter = require('../config/nodemailer');

const forgotPassword = async (req, res) => {
    const email = req.body?.email;

    // Validate that an email was provided before doing any work.
    if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[\w-.]+@gmail\.com$/;

    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: 'This email is not registered.' });
        }

        // Generate a one-time reset code and store only its bcrypt hash.
        const code = crypto.randomInt(100000, 1000000).toString();
        const hashedCode = await bcrypt.hash(code, 10);

        user.resetPasswordCode = hashedCode;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Your password reset code',
            text: `Your password reset code is ${code}. It expires in 10 minutes.`,
            html: `<p>Your password reset code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`
        });

        return res.status(200).json({ message: 'A reset code has been sent successfully.', code });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { forgotPassword };
