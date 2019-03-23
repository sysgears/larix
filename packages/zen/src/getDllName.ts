import * as humps from 'humps';

import { Builder } from './Builder';

const getDllName = (builder: Builder) => {
  const dllName = `vendor_${humps.camelize(
    builder.require('./package.json').name + '-' + (builder.parent ? builder.parent.name : builder.name)
  )}`;
  return dllName;
};

export default getDllName;
