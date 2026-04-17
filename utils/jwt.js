import jwt from 'jsonwebtoken';

const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

const createSendToken = (user, statusCode, res) => {
  // Remove password from output
  const userWithoutPassword = { ...user.toObject ? user.toObject() : user };
  delete userWithoutPassword.password;

  // Create token
  const token = generateToken(
    { id: user._id },
    process.env.AUTH_SECRET,
    process.env.JWT_ACCESS_EXPIRY || '1d'
  );

  // Options for cookie
  const options = {
    expires: new Date(
      Date.now() + 
      (parseInt(process.env.JWT_ACCESS_EXPIRY || '1') * 24 * 60 * 60 * 1000)
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.status(statusCode).json({
    success: true,
    data: {
      user: userWithoutPassword,
      token,
    },
  });
};

export { generateToken, verifyToken, createSendToken };