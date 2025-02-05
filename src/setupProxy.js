const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://firestore.googleapis.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/v1/projects/[YOUR-PROJECT-ID]/databases/(default)/documents'
      },
    })
  );
};