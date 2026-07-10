const User = require('../model/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const handleLogin = async (req, res) => {
    const { username, password, user, pwd } = req.body;
    const loginUsername = username || user;
    const loginPassword = password || pwd;

    if (!loginUsername || !loginPassword) {
        return res.status(400).json({ 'message': 'Username and password are required.' });
    }

    // Validate username length
    if (loginUsername.length > 50) {
        return res.status(400).json({ message: 'Username must be 50 characters or less.' });
    }

    const foundUser = await User.findOne({
        $or: [{ username: loginUsername }, { email: loginUsername }]
    }).exec();
    if (!foundUser) return res.sendStatus(401); //Unauthorized 
    // evaluate password 
    const match = await bcrypt.compare(loginPassword, foundUser.password);
    if (match) {
        if (!foundUser.isVerified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        const roles = Object.values(foundUser.roles).filter(Boolean);// find the role of the user like user or admin or editor
        
        const accessToken = jwt.sign(// jswt.sign means create a jwt token
            {
                "UserInfo": {// let this token that gets created contain the username and role of the user
                    "username": foundUser.username,
                    "roles": roles
                }
            },
            process.env.ACCESS_TOKEN_SECRET,// used to lock or protect the token so that no body can fake it or change it. so no body has to see the one we have in .env
            { expiresIn: '15m' }
        );// so this in genral creates an acess token like eyjh....

        const refreshToken = jwt.sign(
            { "username": foundUser.username },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '1d' }
        );
        // Saving refreshToken with current user
        foundUser.refreshToken = refreshToken;// here server stores refreshtoken in db to check if the user is still valid or logged out. if the person is valid, the refresh token exists as refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey..' in the db but if the user has logged out or is not valid, it becomes refreshToken:'' in the db.
        const result = await foundUser.save();// saves updated user in db
        console.log(result);
        console.log(roles);
        

        res.cookie('jwt', refreshToken, { httpOnly: true, sameSite: 'None', secure: true, maxAge:  24 * 60 * 60 * 1000 });
        
        // Send authorization roles and access token to user
        res.json({ roles, accessToken });// sends data like roles and accessToken from server to frontend

    } else {
        res.sendStatus(401);
    }
}

module.exports = { handleLogin };