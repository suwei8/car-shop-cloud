const ENV_CONFIG = {
  development: {
    BASE_URL: 'http://localhost:3000',
  },
  production: {
    BASE_URL: 'https://car-api.13982.com',
  },
};

const currentEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
export const config = ENV_CONFIG[currentEnv];
export const BASE_URL = config.BASE_URL;
