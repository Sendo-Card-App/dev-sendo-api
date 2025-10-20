module.exports = {
  apps: [{
    name: "sendo-api-test",
    script: "dist/server.js",
    env: {
      PORT: 3001,
      NODE_ENV: "development"
    },
    env_production: {
      PORT: 3001,
      NODE_ENV: "production"
    }
  }]
};