const User = require('../model/User');
const bcrypt = require('bcrypt');

const resetPassword = async (req, res) => {
    const { email, code, newPassword, confirmPassword } = req.body;

    // Validate required fields before any password checks.
    if (typeof email !== 'string' || !email.trim() || typeof code !== 'string' || !code.trim() || typeof newPassword !== 'string' || !newPassword.trim() || typeof confirmPassword !== 'string' || !confirmPassword.trim()) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Reuse the same password policy already used for registration.
    const pwdValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!pwdValid.test(newPassword)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and contain at least one letter and one number.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[\w-.]+@gmail\.com$/;

    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });

        // Use the same generic error for any invalid or expired code state.
        if (!user || !user.resetPasswordCode || !user.resetPasswordExpires) {
            return res.status(400).json({ message: 'Invalid or expired code.' });
        }

        if (Date.now() > user.resetPasswordExpires) {
            user.resetPasswordCode = undefined;
            user.resetPasswordExpires = undefined;
            await user.save();
            return res.status(400).json({ message: 'Invalid or expired code.' });
        }

        const isMatch = await bcrypt.compare(code.trim(), user.resetPasswordCode);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid or expired code.' });
        }

        // Mark the code as single-use once the password is reset.
        const hashedPwd = await bcrypt.hash(newPassword, 10);
        user.password = hashedPwd;
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({ success: 'Password has been reset successfully.' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { resetPassword };
