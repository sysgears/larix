const swaggerJsDoc = require('swagger-jsdoc');
const pkgJson = require('../package.json');

const config = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: { title: pkgJson.name, version: pkgJson.version, description: pkgJson.description }
  },
  apis: ['!(node_modules)/**/*.js', '!(node_modules)/**/*.ts']
};

module.exports = () => {
  return {
    code: 'module.exports = ' + JSON.stringify(swaggerJsDoc(config)) + ';\n'
  }
};