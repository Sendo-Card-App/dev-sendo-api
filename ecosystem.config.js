module.exports = {
  apps: [
    {
      name: "sendo-api-test",
      script: "dist/server.js",
      instances: 2,               
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
    {
      name: "sendo-scheduler",
      script: "dist/scheduler.js",
      instances: 1,               
      exec_mode: "fork",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};