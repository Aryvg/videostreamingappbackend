const User = require('../model/User');

const handleLogout = async (req, res) => {
    // On client, also delete the accessToken

    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); //No content
    const refreshToken = cookies.jwt;

    // Is refreshToken in db?
    const foundUser = await User.findOne({ refreshToken }).exec();// find which user has the refersh token above from the db
    if (!foundUser) {
        res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });
        return res.sendStatus(204);
        //make samsite:none and secure:true when you deploy
    }// if there is no one in the db with the refreshToken, remove the refreshToken from browser

    
    foundUser.refreshToken = '';// if user exists in the db with the refreshtoken, remove this refreshToken from the db
    const result = await foundUser.save();// update db
    console.log(result);

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });// ensures browser deletes refreshToken
    res.sendStatus(204);// logout successful
}

module.exports = { handleLogout }