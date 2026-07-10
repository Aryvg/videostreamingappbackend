const User = require('../model/User');
const bcrypt = require('bcrypt');

const verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    if (typeof email !== 'string' || typeof code !== 'string' || !email.trim() || !code.trim()) {
        return res.status(400).json({ message: 'Email and code are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(400).json({ message: 'Invalid verification request.' });
        }

        if (user.isVerified) {
            return res.status(200).json({ success: 'Email is already verified.' });
        }

        if (!user.verificationCode || !user.verificationExpires || Date.now() > user.verificationExpires) {
            return res.status(400).json({ message: 'Verification code has expired. Please register again.' });
        }

        const isMatch = await bcrypt.compare(code, user.verificationCode);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationExpires = undefined;
        user.pendingDeleteAt = undefined;
        await user.save();

        return res.status(200).json({ success: 'Email verified successfully. You can now log in.' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { verifyEmail };
