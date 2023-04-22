const parseCookieValue = (value) => {
  const decoded = decodeURIComponent(value);
  if (decoded.startsWith('j:')) {
    return JSON.parse(decoded.substring(2), (key, value) => {
      const date = new Date(value);
      if ((date !== "Invalid Date") && !isNaN(new Date(date))) {
        return date;
      } else {
        return value;
      }
    });
  }
  return decoded;
}

const parseCookies = (req, res, next) => {
  const cookieString = req.headers.cookie;
  try {
    const result = {};
    cookieString.split('; ').forEach(pair => {
      const [key, value] = pair.split('=');
      result[parseCookieValue(key)] = parseCookieValue(value);
    });
    req.cookies = result;
  } catch (e) {
    req.cookies = {};
  }
  next();
};

module.exports = parseCookies;