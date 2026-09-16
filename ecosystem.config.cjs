module.exports = {
  apps: [
    {
      name: 'webapp',
      script: 'npx',
      // El binding D1 se toma de wrangler.jsonc (database_name: webapp-production)
      // para que apunte a la misma base local donde se aplican las migraciones.
      args: 'wrangler pages dev dist --local --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '450M',
    },
  ],
}