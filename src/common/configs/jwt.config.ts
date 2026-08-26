export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'default_strong_secret_key',
  expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '604800', 10),
}
