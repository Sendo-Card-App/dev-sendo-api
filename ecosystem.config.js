module.exports = {
  apps: [
    {
      name: "sendo-api-test",
      script: "dist/server.js",
      instances: 1,               
      exec_mode: "cluster",
      env: {
        PORT: 3001,
        NODE_ENV: "development"
      },
      env_production: {
        PORT: 3001,
        NODE_ENV: "production"
      }
    },
  ]
};