const User = require('../model/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const transporter = require('../config/nodemailer');
//to remove duplicate error start from here
const mongoose = require('mongoose');

const removeStaleVideoIdIndex = async () => {
    try {
        const collection = mongoose.connection.collection('users');
        const indexes = await collection.indexes();
        const videoIdIndex = indexes.find((index) => index.name === 'videoId_1');

        if (videoIdIndex) {
            await collection.dropIndex('videoId_1');
            console.log('Dropped stale videoId index from users collection');
        }
    } catch (err) {
        console.error('Could not remove stale videoId index:', err.message);
    }
};
//stop here

const sendVerificationCode = async (user) => {
    const code = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = await bcrypt.hash(code, 10);

    // Store only the bcrypt hash, never the plain code.
    user.verificationCode = hashedCode;
    user.verificationExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Verify your email',
            text: `Your verification code is ${code}. It expires in 15 minutes.`,
            html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`
        });
    } catch (err) {
        console.error('Verification email failed:', err.message);
    }
};

const checkEmailAvailability = async (req, res) => {
    const user = String(req.query.user || '').trim().toLowerCase();

    if (!user) {
        return res.status(400).json({ available: false, message: 'Email is required.' });
    }

    const duplicate = await User.findOne({
        $or: [{ username: user }, { email: user }],
    }).lean().exec();

    if (!duplicate) {
        return res.json({ available: true, message: 'Email is available.' });
    }

    if (duplicate.isVerified) {
        return res.json({ available: false, message: 'Email is already taken.' });
    }

    return res.json({ available: true, message: 'Email is registered but unverified.' });
};

const handleNewUser = async (req, res) => {
    const { user, pwd, confirmPassword, firstname, lastname, age, profilePhoto, country } = req.body;
    if (!user || !pwd || !confirmPassword || !firstname || !lastname || !age || !profilePhoto || !country) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if passwords match
    if (pwd !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Username validation
    if (user.length > 50) {
        return res.status(400).json({ message: 'Username must be 50 characters or less.' });
    }

    // Age must be a number between 8 and 120
    const ageNum = Number(age);
    if (isNaN(ageNum)) {
        return res.status(400).json({ message: 'Age must be a number.' });
    }
    if (ageNum < 8 || ageNum > 120) {
        return res.status(400).json({ message: 'Age must be between 8 and 120.' });
    }

    // Password must be at least 8 characters and contain at least one letter and one number
    const pwdValid = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!pwdValid.test(pwd)) {
        return res.status(400).json({ message: 'Password must be at least 8 characters and contain at least one letter and one number.' });
    }

    // Email format and domain validation
    const emailRegex = /^[\w-.]+@gmail\.com$/;
    if (!emailRegex.test(user)) {
        return res.status(400).json({ message: 'Email must be a valid @gmail.com address.' });
    }

    // Country validation (using a simple list of countries)
    const validCountries = [
        'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
        'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
    ];
    if (!validCountries.includes(country)) {
        return res.status(400).json({ message: 'Country is not valid.' });
    }

    // check for duplicate usernames or emails in the db
    const normalizedUser = user.trim().toLowerCase();
    const duplicate = await User.findOne({
        $or: [{ username: normalizedUser }, { email: normalizedUser }],
    }).exec();

    if (duplicate) {
        if (duplicate.isVerified) {
            return res.status(409).json({ message: 'User already exists.' });
        }

        const hashedPwd = await bcrypt.hash(pwd, 10);
        duplicate.username = normalizedUser;
        duplicate.email = normalizedUser;
        duplicate.password = hashedPwd;
        duplicate.firstname = firstname;
        duplicate.lastname = lastname;
        duplicate.profilePhoto = profilePhoto;
        duplicate.age = ageNum;
        duplicate.country = country;
        duplicate.pendingDeleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await duplicate.save();

        await sendVerificationCode(duplicate);
        return res.status(409).json({
            message: 'Account pending verification. A new verification code has been sent to your email.'
        });
    }

    try {
        await removeStaleVideoIdIndex();

        // encrypt the password
        const hashedPwd = await bcrypt.hash(pwd, 10);

        // create and store the new user
        const result = await User.create({
            "username": user,
            "password": hashedPwd,
            "email": user,
            "firstname": firstname,
            "lastname": lastname,
            "profilePhoto": profilePhoto,
            "age": ageNum,
            "country": country,
            "pendingDeleteAt": new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        await sendVerificationCode(result);
        console.log(result);
        res.status(201).json({ 'success': `New user ${user} created! A verification code has been sent to your email.` });
    } catch (err) {
        if (err?.code === 11000 && String(err?.message || '').includes('videoId')) {
            await removeStaleVideoIdIndex();

            try {
                const hashedPwd = await bcrypt.hash(pwd, 10);
                const result = await User.create({
                    "username": user,
                    "password": hashedPwd,
                    "email": user,
                    "firstname": firstname,
                    "lastname": lastname,
                    "profilePhoto": profilePhoto,
                    "age": ageNum,
                    "country": country,
                    "pendingDeleteAt": new Date(Date.now() + 24 * 60 * 60 * 1000)
                });

                await sendVerificationCode(result);
                console.log(result);
                return res.status(201).json({ 'success': `New user ${user} created! A verification code has been sent to your email.` });
            } catch (retryErr) {
                return res.status(500).json({ 'message': retryErr.message });
            }
        }

        res.status(500).json({ 'message': err.message });
    }
}

module.exports = { checkEmailAvailability, handleNewUser };
