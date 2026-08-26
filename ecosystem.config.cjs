module.exports = {
  apps: [{
    name: 'wouldyoubuyit',
    script: 'npm',
    args: 'start',
    cwd: '/opt/projects/user/wouldyoubuyit',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production',
      PORT: 4003,
    },
    watch: false,
    autorestart: true,
    max_memory_restart: '512M',
  }],
};
