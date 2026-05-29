const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../lib/errors");
const SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError("No token provided");
    }
    try {
        // req.user = jwt.verify(authHeader.split(" ") [1], SECRET, { algorithms: [HS256] });
        req.user = jwt.verify(authHeader.split(" ") [1], SECRET);
        next();
    } catch(err) {
        req.log.warn({}, "Error authenticating");
        throw new ForbiddenError("Invalid or expired token");
    }
}
     
module.exports = authenticate;