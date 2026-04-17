import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Al-Quran Institute Online API',
      version: '1.0.0',
      description: 'API documentation for Al-Quran Institute Online platform',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: process.env.PRODUCTION_API_URL || 'https://your-production-url.com',
        description: 'Production server',
      },
    ],
  },
  apis: ['./routers/*.js', './models/*.js'], // files containing annotations
};

const specs = swaggerJsdoc(options);

export default specs;